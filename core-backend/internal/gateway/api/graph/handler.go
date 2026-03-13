package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"locallitix-core/internal/domain"
	"locallitix-core/internal/infrastructure/auth"
	"locallitix-core/internal/infrastructure/database"
	influxclient "locallitix-core/pkg/influxclient"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"gorm.io/gorm"
)

// influxClient is set from main.go during initialization.
var influxClient *influxclient.Client

// activeRecordings tracks running ffmpeg DVR processes by mission ID.
// Stored value: *exec.Cmd
var activeRecordings sync.Map

// SetInfluxClient injects the Phase 2 InfluxDB client for resolvers to use.
func SetInfluxClient(c *influxclient.Client) {
	influxClient = c
}

// GraphQLRequest represents an incoming GraphQL request
type GraphQLRequest struct {
	Query         string                 `json:"query"`
	OperationName string                 `json:"operationName"`
	Variables     map[string]interface{} `json:"variables"`
}

// GraphQLResponse represents a GraphQL response
type GraphQLResponse struct {
	Data   interface{}    `json:"data,omitempty"`
	Errors []GraphQLError `json:"errors,omitempty"`
}

type GraphQLError struct {
	Message string `json:"message"`
}

// Handler returns the main GraphQL HTTP handler
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req GraphQLRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, "Invalid request body")
			return
		}

		data, err := executeQuery(r.Context(), req)
		if err != nil {
			writeError(w, err.Error())
			return
		}

		resp := GraphQLResponse{Data: data}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

func writeError(w http.ResponseWriter, msg string) {
	resp := GraphQLResponse{
		Errors: []GraphQLError{{Message: msg}},
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK) // GraphQL always returns 200
	json.NewEncoder(w).Encode(resp)
}

func executeQuery(ctx context.Context, req GraphQLRequest) (map[string]interface{}, error) {
	query := strings.TrimSpace(req.Query)
	result := make(map[string]interface{})

	if strings.HasPrefix(query, "query") || strings.HasPrefix(query, "{") {
		return resolveQueries(ctx, query, req.Variables)
	}

	if strings.HasPrefix(query, "mutation") {
		return resolveMutations(ctx, query, req.Variables)
	}

	return result, fmt.Errorf("unsupported operation")
}

// ===================================================
// QUERY RESOLVERS
// ===================================================

func resolveQueries(ctx context.Context, query string, variables map[string]interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	db := database.DB

	// Extract authenticated user for RBAC filtering
	currentUser, _ := getDBUser(ctx, db)

	if containsField(query, "getMissions") {
		missions, err := queryMissions(db, variables, currentUser)
		if err != nil {
			return nil, err
		}
		result["getMissions"] = missions
	}

	if containsField(query, "getMissionById") {
		mission, err := queryMissionByID(db, variables)
		if err != nil {
			return nil, err
		}
		result["getMissionById"] = mission
	}

	if containsField(query, "getAssets") {
		assets, err := queryAssets(db, variables)
		if err != nil {
			return nil, err
		}
		result["getAssets"] = assets
	}

	if containsField(query, "getAssetById") {
		asset, err := queryAssetByID(db, variables)
		if err != nil {
			return nil, err
		}
		result["getAssetById"] = asset
	}

	if containsField(query, "getAISVessels") {
		vessels, err := queryAISVessels(influxClient)
		if err != nil {
			log.Printf("[GQL] getAISVessels error: %v", err)
			// Return empty array instead of failing the whole query
			result["getAISVessels"] = []Vessel{}
		} else {
			result["getAISVessels"] = vessels
		}
	}

	if containsField(query, "getLiveDrones") {
		drones, err := queryLiveDrones(influxClient)
		if err != nil {
			log.Printf("[GQL] getLiveDrones error: %v", err)
			result["getLiveDrones"] = []LiveDrone{}
		} else {
			result["getLiveDrones"] = drones
		}
	}

	if containsField(query, "getLiveFlights") {
		flights, err := queryLiveFlights(influxClient)
		if err != nil {
			log.Printf("[GQL] getLiveFlights error: %v", err)
			result["getLiveFlights"] = []Flight{}
		} else {
			result["getLiveFlights"] = flights
		}
	}

	if containsField(query, "getCurrentUser") {
		// Placeholder — in production, extract from context
		result["getCurrentUser"] = nil
	}

	if containsField(query, "getPilots") {
		pilots, err := queryPilots(db, variables)
		if err != nil {
			log.Printf("[GQL] getPilots error: %v", err)
			result["getPilots"] = []domain.User{}
		} else {
			result["getPilots"] = pilots
		}
	}

	return result, nil
}

// getDBUser extracts the authenticated user from the request context.
// Returns nil if unauthenticated (graceful — allows public queries if needed).
func getDBUser(ctx context.Context, db *gorm.DB) (*domain.User, error) {
	claimsVal := ctx.Value(auth.ContextKeyUser)
	if claimsVal == nil {
		return nil, fmt.Errorf("unauthenticated")
	}

	// jwt.MapClaims is map[string]interface{} — extract "sub" (Keycloak user ID)
	claims, ok := claimsVal.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims type")
	}

	keycloakID, _ := claims["sub"].(string)
	if keycloakID == "" {
		return nil, fmt.Errorf("no sub claim")
	}

	var user domain.User
	if err := db.Where("keycloak_id = ?", keycloakID).First(&user).Error; err != nil {
		// Demo fallback: if user isn't synced to Postgres, return a dummy COMMANDER
		log.Printf("[AUTH] User keycloak_id=%s not in DB — using demo fallback (COMMANDER)", keycloakID)
		return &domain.User{
			KeycloakID: keycloakID,
			Name:       "Demo Commander",
			Role:       "COMMANDER",
			Email:      "demo@locallitix.io",
			Status:     "ONLINE",
		}, nil
	}
	return &user, nil
}

// hasRole checks if the user's role matches any of the given roles (case-insensitive)
func hasRole(userRole string, roles ...string) bool {
	for _, r := range roles {
		if strings.EqualFold(userRole, r) {
			return true
		}
	}
	return false
}

func queryMissions(db *gorm.DB, variables map[string]interface{}, currentUser *domain.User) ([]domain.Mission, error) {
	var missions []domain.Mission
	q := db.Preload("Asset").Preload("Pilot").Preload("Snapshots").Order("created_at DESC")

	if status, ok := variables["status"].(string); ok && status != "" {
		q = q.Where("status = ?", status)
	}

	// RBAC filtering
	if currentUser != nil {
		if hasRole(currentUser.Role, "COMMANDER", "ADMIN") {
			// Full access — no filter
		} else if hasRole(currentUser.Role, "PILOT") {
			// Pilot sees missions they pilot OR are a team member of
			userID := currentUser.ID.String()
			q = q.Where("pilot_id = ? OR team_member_ids LIKE ?", currentUser.ID, "%"+userID+"%")
		} else {
			// Operator/Analyst/Technician — only missions they're team members of
			userID := currentUser.ID.String()
			q = q.Where("team_member_ids LIKE ?", "%"+userID+"%")
		}
	}

	if err := q.Find(&missions).Error; err != nil {
		log.Printf("[GQL] Failed to query missions: %v", err)
		return nil, fmt.Errorf("failed to fetch missions")
	}
	return missions, nil
}

func queryMissionByID(db *gorm.DB, variables map[string]interface{}) (*domain.Mission, error) {
	id, ok := variables["id"].(string)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	var mission domain.Mission
	if err := db.Preload("Asset").Preload("Pilot").Preload("Snapshots").First(&mission, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("mission not found")
	}
	return &mission, nil
}

func queryAssets(db *gorm.DB, variables map[string]interface{}) ([]domain.Asset, error) {
	var assets []domain.Asset
	q := db.Order("created_at DESC")

	if category, ok := variables["category"].(string); ok && category != "" {
		q = q.Where("category = ?", category)
	}

	if err := q.Find(&assets).Error; err != nil {
		log.Printf("[GQL] Failed to query assets: %v", err)
		return nil, fmt.Errorf("failed to fetch assets")
	}
	return assets, nil
}

func queryAssetByID(db *gorm.DB, variables map[string]interface{}) (*domain.Asset, error) {
	id, ok := variables["id"].(string)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	var asset domain.Asset
	if err := db.First(&asset, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("asset not found")
	}
	return &asset, nil
}

func queryPilots(db *gorm.DB, variables map[string]interface{}) ([]domain.User, error) {
	var users []domain.User
	q := db.Order("name ASC")

	if role, ok := variables["role"].(string); ok && role != "" {
		q = q.Where("role = ?", role)
	}

	if err := q.Find(&users).Error; err != nil {
		log.Printf("[GQL] Failed to query pilots: %v", err)
		return nil, fmt.Errorf("failed to fetch pilots")
	}
	return users, nil
}

// ===================================================
// MUTATION RESOLVERS
// ===================================================

func resolveMutations(ctx context.Context, query string, variables map[string]interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	db := database.DB

	if containsField(query, "createMission") {
		mission, err := mutateCreateMission(db, variables)
		if err != nil {
			return nil, err
		}
		result["createMission"] = mission
	}

	if containsField(query, "updateMissionStatus") {
		mission, err := mutateUpdateMissionStatus(db, variables)
		if err != nil {
			return nil, err
		}
		result["updateMissionStatus"] = mission
	}

	if containsField(query, "startMission") {
		mission, err := mutateStartMission(db, variables)
		if err != nil {
			return nil, err
		}
		result["startMission"] = mission
	}

	if containsField(query, "abortMission") {
		mission, err := mutateAbortMission(db, variables)
		if err != nil {
			return nil, err
		}
		result["abortMission"] = mission
	}

	if containsField(query, "deleteMission") {
		ok, err := mutateDeleteMission(db, variables)
		if err != nil {
			return nil, err
		}
		result["deleteMission"] = ok
	}

	if containsField(query, "submitPreFlightCheck") {
		check, err := mutateSubmitPreFlight(db, variables)
		if err != nil {
			return nil, err
		}
		result["submitPreFlightCheck"] = check
	}

	if containsField(query, "deleteAllMissions") {
		ok, err := mutateDeleteAllMissions(db)
		if err != nil {
			return nil, err
		}
		result["deleteAllMissions"] = ok
	}

	return result, nil
}

func mutateCreateMission(db *gorm.DB, variables map[string]interface{}) (*domain.Mission, error) {
	input, ok := variables["input"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("input is required")
	}

	assetID, err := uuid.Parse(fmt.Sprintf("%v", input["assetId"]))
	if err != nil {
		return nil, fmt.Errorf("invalid assetId")
	}

	pilotID, err := uuid.Parse(fmt.Sprintf("%v", input["pilotId"]))
	if err != nil {
		return nil, fmt.Errorf("invalid pilotId")
	}

	duration := 0
	if d, ok := input["duration"].(float64); ok {
		duration = int(d)
	}

	teamMemberIDs := "[]"
	if t, ok := input["teamMemberIds"].(string); ok && t != "" {
		teamMemberIDs = t
	}

	// ALWAYS auto-generate missionCode: MSN-YYYY-NNNNN (sequential per year)
	year := time.Now().Year()
	var count int64
	db.Model(&domain.Mission{}).Where("EXTRACT(YEAR FROM created_at) = ?", year).Count(&count)
	missionCode := fmt.Sprintf("MSN-%d-%05d", year, count+1)
	log.Printf("[GQL] Generated missionCode: %s (year=%d, existing=%d)", missionCode, year, count)

	mission := domain.Mission{
		MissionCode:   missionCode,
		Name:          fmt.Sprintf("%v", input["name"]),
		Category:      fmt.Sprintf("%v", input["category"]),
		AreaPolygon:   fmt.Sprintf("%v", input["areaPolygon"]),
		Duration:      duration,
		AssetID:       assetID,
		PilotID:       pilotID,
		TeamMemberIDs: teamMemberIDs,
		Status:        "PENDING",
	}

	if err := db.Create(&mission).Error; err != nil {
		log.Printf("[GQL] Failed to create mission: %v", err)
		return nil, fmt.Errorf("failed to create mission")
	}

	// Reload with associations
	db.Preload("Asset").Preload("Pilot").First(&mission, "id = ?", mission.ID)
	return &mission, nil
}

func mutateUpdateMissionStatus(db *gorm.DB, variables map[string]interface{}) (*domain.Mission, error) {
	id, ok := variables["id"].(string)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}
	status, ok := variables["status"].(string)
	if !ok {
		return nil, fmt.Errorf("status is required")
	}

	var mission domain.Mission
	if err := db.First(&mission, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("mission not found")
	}

	mission.Status = status

	// On COMPLETED: calculate duration + total detections
	if strings.ToUpper(status) == "COMPLETED" {
		now := time.Now()
		mission.EndedAt = &now

		// Calculate EXACT duration in seconds for precise DVR slicing
		var durationSecs float64
		if mission.StartedAt != nil {
			durationSecs = now.Sub(*mission.StartedAt).Seconds()
			// Store as whole seconds in the duration column (was minutes — now seconds)
			mission.Duration = int(math.Ceil(durationSecs))
			if mission.Duration < 1 {
				mission.Duration = 1
			}
			log.Printf("[GQL] Mission %s completed — exact duration: %.1fs (%d stored)",
				mission.MissionCode, durationSecs, mission.Duration)
		}

		// Count snapshots for this mission
		var snapCount int64
		db.Model(&domain.Snapshot{}).Where("mission_id = ?", mission.ID).Count(&snapCount)
		mission.TotalDetections = int(snapCount)
		log.Printf("[GQL] Mission %s — total detections: %d", mission.MissionCode, mission.TotalDetections)

		// === DVR ENGINE: Stop recording and upload to MinIO ===
		if mission.VideoPath == "" {
			// Pass startedAt so DVR can compute exact segment length
			videoPath := stopAndUploadDVR(id, mission.StartedAt, &now)
			mission.VideoPath = videoPath
			log.Printf("[GQL] Mission %s — video path: %s", mission.MissionCode, videoPath)
		}
	}

	db.Save(&mission)
	db.Preload("Asset").Preload("Pilot").Preload("Snapshots").First(&mission, "id = ?", mission.ID)
	return &mission, nil
}

func mutateStartMission(db *gorm.DB, variables map[string]interface{}) (*domain.Mission, error) {
	id, ok := variables["id"].(string)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	var mission domain.Mission
	if err := db.First(&mission, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("mission not found")
	}

	now := time.Now()
	mission.Status = "LIVE"
	mission.StartedAt = &now
	db.Save(&mission)

	// === DVR ENGINE: Spawn ffmpeg to record in real-time ===
	// In REAL mode: Python worker (virtual_drone.py) handles DVR recording
	// via cv2.VideoWriter — no dummy FFmpeg needed here.
	droneMode := os.Getenv("DRONE_MODE")
	if droneMode == "real" {
		log.Printf("[DVR] REAL MODE — skipping FFmpeg dummy DVR (Python worker records live RTSP)")
	} else {
		// VIRTUAL mode: spawn ffmpeg to copy drone.mp4 in real-time
		// NOTE: no -t flag here — we don't know duration at start time.
		// stopAndUploadDVR will re-slice the file with exact -t duration on completion.
		outFile := fmt.Sprintf("/tmp/mission_%s_raw.mp4", id)
		cmd := exec.Command("ffmpeg",
			"-y",                  // overwrite output
			"-re",                 // real-time input speed
			"-stream_loop", "-1", // loop forever — we'll cut to exact duration on stop
			"-i", "/app/drone.mp4", // source
			"-c", "copy",          // stream copy (no re-encode)
			outFile,
		)
		cmd.Stdout = nil
		cmd.Stderr = nil
		if err := cmd.Start(); err != nil {
			log.Printf("[DVR] WARNING: ffmpeg failed to start for mission %s: %v", id, err)
		} else {
			log.Printf("[DVR] Recording started (looping) → %s (pid=%d)", outFile, cmd.Process.Pid)
			activeRecordings.Store(id, cmd)
			go func() {
				cmd.Wait()
				log.Printf("[DVR] ffmpeg process exited for mission %s", id)
			}()
		}
	}

	db.Preload("Asset").Preload("Pilot").Preload("Snapshots").First(&mission, "id = ?", mission.ID)
	return &mission, nil
}

func mutateAbortMission(db *gorm.DB, variables map[string]interface{}) (*domain.Mission, error) {
	id, ok := variables["id"].(string)
	if !ok {
		return nil, fmt.Errorf("id is required")
	}

	var mission domain.Mission
	if err := db.First(&mission, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("mission not found")
	}

	now := time.Now()
	mission.Status = "ABORTED"
	mission.EndedAt = &now
	db.Save(&mission)
	db.Preload("Asset").Preload("Pilot").Preload("Snapshots").First(&mission, "id = ?", mission.ID)
	return &mission, nil
}

func mutateSubmitPreFlight(db *gorm.DB, variables map[string]interface{}) (*domain.PreFlightCheck, error) {
	input, ok := variables["input"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("input is required")
	}

	missionID, err := uuid.Parse(fmt.Sprintf("%v", input["missionId"]))
	if err != nil {
		return nil, fmt.Errorf("invalid missionId")
	}

	now := time.Now()
	check := domain.PreFlightCheck{
		MissionID:        missionID,
		HullIntegrity:    boolVal(input["hullIntegrity"]),
		SonarSystem:      boolVal(input["sonarSystem"]),
		BatteryConn:      boolVal(input["batteryConn"]),
		Thruster:         boolVal(input["thruster"]),
		DepthSensor:      boolVal(input["depthSensor"]),
		WaterproofSeals:  boolVal(input["waterproofSeals"]),
		NavigationSystem: boolVal(input["navigationSystem"]),
		Communication:    boolVal(input["communication"]),
		VerifiedAt:       &now,
	}

	result := db.Where("mission_id = ?", missionID).FirstOrCreate(&check)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to submit pre-flight check")
	}

	// If existed, update it
	if result.RowsAffected == 0 {
		db.Model(&check).Updates(check)
	}

	return &check, nil
}

func mutateDeleteMission(db *gorm.DB, variables map[string]interface{}) (bool, error) {
	id, ok := variables["id"].(string)
	if !ok {
		return false, fmt.Errorf("id is required")
	}

	var mission domain.Mission
	if err := db.First(&mission, "id = ?", id).Error; err != nil {
		return false, fmt.Errorf("mission not found")
	}

	// Block deletion of live missions
	if mission.Status == "LIVE" {
		return false, fmt.Errorf("cannot delete a LIVE mission")
	}

	if err := db.Delete(&mission).Error; err != nil {
		return false, fmt.Errorf("failed to delete mission: %v", err)
	}
	return true, nil
}

func mutateDeleteAllMissions(db *gorm.DB) (bool, error) {
	// Delete all snapshots first (safety net even with CASCADE)
	if err := db.Exec("DELETE FROM snapshots").Error; err != nil {
		log.Printf("[GQL] Failed to delete snapshots: %v", err)
	}
	// Hard-delete all missions (bypass soft-delete)
	if err := db.Exec("DELETE FROM missions").Error; err != nil {
		log.Printf("[GQL] Failed to delete all missions: %v", err)
		return false, fmt.Errorf("failed to delete all missions")
	}
	// Also clear pre-flight checks and archives
	db.Exec("DELETE FROM pre_flight_checks")
	db.Exec("DELETE FROM mission_archives")
	log.Println("[GQL] ✅ All missions, snapshots, pre-flight checks, and archives wiped")
	return true, nil
}


func fallbackVideoURL() string {
	return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
}

// stopAndUploadDVR gracefully terminates the ffmpeg DVR process for a mission,
// slices the raw recording to the EXACT flight duration, uploads to MinIO,
// and returns the public video URL.
func stopAndUploadDVR(missionID string, startedAt *time.Time, endedAt *time.Time) string {
	droneMode := os.Getenv("DRONE_MODE")

	// ── REAL MODE: Python worker already wrote the file via cv2.VideoWriter ──
	// No FFmpeg process to kill. Just find the recording and upload.
	if droneMode == "real" {
		log.Printf("[DVR] REAL MODE — skipping FFmpeg teardown (Python worker owns recording)")

		// Python writes: /recordings/output.mp4 (symlink to annotated_YYYYMMDD_HHMMSS.mp4)
		uploadFile := "/recordings/output.mp4"
		if _, err := os.Stat(uploadFile); os.IsNotExist(err) {
			// Fallback: find latest .mp4 in /recordings
			log.Printf("[DVR] REAL: output.mp4 not found — scanning /recordings/ for latest MP4")
			uploadFile = findLatestRecording("/recordings")
			if uploadFile == "" {
				log.Printf("[DVR] REAL: No recording found in /recordings — returning fallback")
				return fallbackVideoURL()
			}
		}
		log.Printf("[DVR] REAL: Using Python recording: %s", uploadFile)
		return uploadFileToMinIO(missionID, uploadFile)
	}

	// ── VIRTUAL MODE: Two-step: stop raw loop → re-slice to exact duration ──
	rawFile := fmt.Sprintf("/tmp/mission_%s_raw.mp4", missionID)
	outFile := fmt.Sprintf("/tmp/mission_%s.mp4", missionID)

	// --- Step 1: SIGINT the looping FFmpeg to finalize the raw file ---
	if raw, ok := activeRecordings.Load(missionID); ok {
		cmd := raw.(*exec.Cmd)
		if cmd.Process != nil {
			if err := cmd.Process.Signal(syscall.SIGINT); err != nil {
				log.Printf("[DVR] ffmpeg already exited for mission %s: %v", missionID, err)
			} else {
				log.Printf("[DVR] Sent SIGINT to ffmpeg (pid=%d) for mission %s", cmd.Process.Pid, missionID)
				done := make(chan error, 1)
				go func() { done <- cmd.Wait() }()
				select {
				case <-done:
					log.Printf("[DVR] ffmpeg exited cleanly for mission %s", missionID)
				case <-time.After(5 * time.Second):
					log.Printf("[DVR] ffmpeg timeout — force killing for mission %s", missionID)
					cmd.Process.Kill()
				}
			}
		}
		activeRecordings.Delete(missionID)
	} else {
		log.Printf("[DVR] No active recording for mission %s — may have exited naturally", missionID)
	}

	// --- Step 2: Re-slice to EXACT duration using -t flag ---
	// Calculate exact seconds from startedAt → endedAt
	var durationSecs float64 = 0
	if startedAt != nil && endedAt != nil {
		durationSecs = endedAt.Sub(*startedAt).Seconds()
	}

	uploadFile := outFile
	if _, err := os.Stat(rawFile); err == nil && durationSecs > 0 {
		log.Printf("[DVR] Re-slicing %s → %s (duration=%.1fs)", rawFile, outFile, durationSecs)
		sliceCmd := exec.Command("ffmpeg",
			"-y",
			"-i", rawFile,
			"-t", fmt.Sprintf("%.3f", durationSecs), // exact flight duration
			"-c:v", "copy",
			"-c:a", "copy",
			outFile,
		)
		sliceCmd.Stdout = nil
		sliceCmd.Stderr = nil
		if err := sliceCmd.Run(); err != nil {
			log.Printf("[DVR] Re-slice failed for mission %s: %v — uploading raw", missionID, err)
			uploadFile = rawFile // fallback: upload the unsliced raw
		} else {
			log.Printf("[DVR] Re-slice complete: %s (%.1fs)", outFile, durationSecs)
			os.Remove(rawFile) // clean up raw after successful slice
		}
	} else if _, err := os.Stat(rawFile); err == nil {
		// durationSecs is 0 (startedAt missing) — just upload raw as-is
		log.Printf("[DVR] No duration info — uploading raw recording: %s", rawFile)
		uploadFile = rawFile
	} else {
		// Raw file not found — try Python recording or test.mp4 fallback
		log.Printf("[DVR] Raw recording not found at %s — checking /recordings/", rawFile)
		uploadFile = findLatestRecording("/recordings")
		if uploadFile == "" {
			log.Printf("[DVR] No recording found — falling back to test.mp4")
			uploadFile = "/app/test.mp4"
		}
	}

	url := uploadFileToMinIO(missionID, uploadFile)

	// --- Step 3: Clean up temp files ---
	if uploadFile == outFile {
		os.Remove(outFile)
	}
	os.Remove(rawFile) // always clean raw (may already be gone if slice succeeded)
	log.Printf("[DVR] Upload complete for mission %s → %s", missionID, url)

	return url
}

// findLatestRecording returns the most recently modified .mp4 file in dir, or "".
func findLatestRecording(dir string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	var latest string
	var latestMod int64
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".mp4" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Unix() > latestMod {
			latestMod = info.ModTime().Unix()
			latest = filepath.Join(dir, e.Name())
		}
	}
	return latest
}

// uploadFileToMinIO uploads any local file to the mission-recordings MinIO bucket.
func uploadFileToMinIO(missionID, filePath string) string {
	endpoint := os.Getenv("MINIO_ENDPOINT")
	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	secretKey := os.Getenv("MINIO_SECRET_KEY")
	if endpoint == "" {
		endpoint = "locallitix-minio:9000"
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: false,
	})
	if err != nil {
		log.Printf("[MinIO] Client error: %v", err)
		return fallbackVideoURL()
	}

	bucket := "mission-recordings"
	ctx := context.Background()

	exists, _ := client.BucketExists(ctx, bucket)
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("[MinIO] Bucket create error: %v", err)
			return fallbackVideoURL()
		}
		policy := `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::mission-recordings/*"]}]}`
		client.SetBucketPolicy(ctx, bucket, policy)
	}

	objectName := fmt.Sprintf("mission-%s.mp4", missionID)
	_, err = client.FPutObject(ctx, bucket, objectName, filePath, minio.PutObjectOptions{
		ContentType: "video/mp4",
	})
	if err != nil {
		log.Printf("[MinIO] Upload failed: %v", err)
		return fallbackVideoURL()
	}

	publicHost := strings.Replace(endpoint, "locallitix-minio", "localhost", 1)
	url := fmt.Sprintf("http://%s/%s/%s", publicHost, bucket, objectName)
	log.Printf("[MinIO] Uploaded %s → %s", filePath, url)
	return url
}

// ===================================================
// HELPERS
// ===================================================

func containsField(query, field string) bool {
	return strings.Contains(query, field)
}

func boolVal(v interface{}) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}
