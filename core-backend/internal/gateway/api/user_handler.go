package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"locallitix-core/internal/infrastructure/auth"
)

type CreateUserRequest struct {
	Username  string `json:"username"`
	Email     string `json:"email"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Password  string `json:"password"`
	Role      string `json:"role"`
}

type UserResponse struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	Email     string   `json:"email"`
	FirstName string   `json:"firstName"`
	LastName  string   `json:"lastName"`
	Roles     []string `json:"roles"`
	Enabled   bool     `json:"enabled"`
	CreatedAt int64    `json:"createdTimestamp,omitempty"`
}

// UserManagementHandler handles /api/admin/users
// Gated by COMMANDER role
func UserManagementHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract and validate COMMANDER role from JWT cookie
		claims, err := auth.ExtractCookieClaims(r)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !auth.HasRole(claims, "COMMANDER") {
			http.Error(w, "Forbidden: COMMANDER role required", http.StatusForbidden)
			return
		}

		// Route based on method and path
		path := strings.TrimPrefix(r.URL.Path, "/api/admin/users")
		path = strings.TrimSuffix(path, "/")

		switch {
		case r.Method == http.MethodGet && path == "":
			listUsers(w, r)
		case r.Method == http.MethodPost && path == "":
			createUser(w, r)
		case r.Method == http.MethodDelete && path != "":
			userID := strings.TrimPrefix(path, "/")
			deleteUser(w, r, userID)
		default:
			http.Error(w, "Not found", http.StatusNotFound)
		}
	}
}

func listUsers(w http.ResponseWriter, r *http.Request) {
	adminToken, err := auth.GetAdminToken()
	if err != nil {
		log.Printf("[USER_MGMT] Failed to get admin token: %v", err)
		http.Error(w, "Failed to connect to IAM", http.StatusInternalServerError)
		return
	}

	adminURL := os.Getenv("KEYCLOAK_ADMIN_URL")
	if adminURL == "" {
		adminURL = "http://locallitix-keycloak:8080/admin/realms/locallitix"
	}

	req, _ := http.NewRequest("GET", adminURL+"/users?max=100", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[USER_MGMT] Failed to list users: %v", err)
		http.Error(w, "Failed to list users", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("[USER_MGMT] Keycloak returned %d: %s", resp.StatusCode, string(body))
		http.Error(w, "Failed to list users", http.StatusInternalServerError)
		return
	}

	// Parse Keycloak users and enrich with roles
	var kcUsers []map[string]interface{}
	json.Unmarshal(body, &kcUsers)

	var users []UserResponse
	for _, kcu := range kcUsers {
		user := UserResponse{
			ID:        fmt.Sprintf("%v", kcu["id"]),
			Username:  fmt.Sprintf("%v", kcu["username"]),
			Email:     safeString(kcu["email"]),
			FirstName: safeString(kcu["firstName"]),
			LastName:  safeString(kcu["lastName"]),
			Enabled:   kcu["enabled"] == true,
		}
		if ts, ok := kcu["createdTimestamp"].(float64); ok {
			user.CreatedAt = int64(ts)
		}

		// Fetch roles for this user
		roles, _ := getUserRoles(adminToken, adminURL, user.ID)
		user.Roles = roles

		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func createUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" || req.Role == "" {
		http.Error(w, "All fields are required", http.StatusBadRequest)
		return
	}

	adminToken, err := auth.GetAdminToken()
	if err != nil {
		log.Printf("[USER_MGMT] Failed to get admin token: %v", err)
		http.Error(w, "Failed to connect to IAM", http.StatusInternalServerError)
		return
	}

	adminURL := os.Getenv("KEYCLOAK_ADMIN_URL")
	if adminURL == "" {
		adminURL = "http://locallitix-keycloak:8080/admin/realms/locallitix"
	}

	// Create user in Keycloak
	kcUser := map[string]interface{}{
		"username":      req.Username,
		"email":         req.Email,
		"firstName":     req.FirstName,
		"lastName":      req.LastName,
		"enabled":       true,
		"emailVerified": true,
		"credentials": []map[string]interface{}{
			{
				"type":      "password",
				"value":     req.Password,
				"temporary": false,
			},
		},
	}

	payload, _ := json.Marshal(kcUser)

	httpReq, _ := http.NewRequest("POST", adminURL+"/users", strings.NewReader(string(payload)))
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		log.Printf("[USER_MGMT] Failed to create user: %v", err)
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[USER_MGMT] Keycloak create user returned %d: %s", resp.StatusCode, string(body))
		if resp.StatusCode == http.StatusConflict {
			http.Error(w, "User already exists", http.StatusConflict)
		} else {
			http.Error(w, "Failed to create user", http.StatusInternalServerError)
		}
		return
	}

	// Extract user ID from Location header
	location := resp.Header.Get("Location")
	parts := strings.Split(location, "/")
	userID := parts[len(parts)-1]

	// Assign realm role
	if req.Role != "" {
		assignRoleToUser(adminToken, adminURL, userID, req.Role)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":      userID,
		"message": "User created successfully",
	})
}

func deleteUser(w http.ResponseWriter, r *http.Request, userID string) {
	adminToken, err := auth.GetAdminToken()
	if err != nil {
		log.Printf("[USER_MGMT] Failed to get admin token: %v", err)
		http.Error(w, "Failed to connect to IAM", http.StatusInternalServerError)
		return
	}

	adminURL := os.Getenv("KEYCLOAK_ADMIN_URL")
	if adminURL == "" {
		adminURL = "http://locallitix-keycloak:8080/admin/realms/locallitix"
	}

	httpReq, _ := http.NewRequest("DELETE", adminURL+"/users/"+userID, nil)
	httpReq.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		log.Printf("[USER_MGMT] Failed to delete user: %v", err)
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[USER_MGMT] Keycloak delete returned %d: %s", resp.StatusCode, string(body))
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "User deleted successfully",
	})
}

// getUserRoles fetches realm role mappings for a user
func getUserRoles(adminToken, adminURL, userID string) ([]string, error) {
	req, _ := http.NewRequest("GET", adminURL+"/users/"+userID+"/role-mappings/realm", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var roleMappings []map[string]interface{}
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &roleMappings)

	var roles []string
	for _, rm := range roleMappings {
		name := fmt.Sprintf("%v", rm["name"])
		// Filter out Keycloak internal roles
		if name != "offline_access" && name != "uma_authorization" && !strings.HasPrefix(name, "default-roles") {
			roles = append(roles, name)
		}
	}
	return roles, nil
}

// assignRoleToUser assigns a realm role to a user
func assignRoleToUser(adminToken, adminURL, userID, roleName string) {
	// First, get the role representation
	req, _ := http.NewRequest("GET", adminURL+"/roles/"+roleName, nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[USER_MGMT] Failed to get role: %v", err)
		return
	}
	defer resp.Body.Close()

	var role map[string]interface{}
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &role)

	// Assign the role
	roles := []map[string]interface{}{role}
	payload, _ := json.Marshal(roles)

	assignReq, _ := http.NewRequest("POST",
		adminURL+"/users/"+userID+"/role-mappings/realm",
		strings.NewReader(string(payload)),
	)
	assignReq.Header.Set("Authorization", "Bearer "+adminToken)
	assignReq.Header.Set("Content-Type", "application/json")

	assignResp, err := http.DefaultClient.Do(assignReq)
	if err != nil {
		log.Printf("[USER_MGMT] Failed to assign role: %v", err)
		return
	}
	defer assignResp.Body.Close()

	if assignResp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(assignResp.Body)
		log.Printf("[USER_MGMT] Role assignment returned %d: %s", assignResp.StatusCode, string(body))
	}
}

func safeString(v interface{}) string {
	if v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}
