package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	KeycloakID string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"keycloakId"`
	Name       string    `gorm:"type:varchar(100);not null" json:"name"`
	Role       string    `gorm:"type:varchar(50);not null" json:"role"`
	Email      string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	Status     string    `gorm:"type:varchar(20);default:'OFFLINE'" json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type Asset struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Type        string    `gorm:"type:varchar(50);not null" json:"type"`
	Category    string    `gorm:"type:varchar(50);not null" json:"category"`
	Status      string    `gorm:"type:varchar(20);default:'STANDBY'" json:"status"`
	Battery     float64   `json:"battery"`
	LastService time.Time `json:"lastService"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Mission struct {
	ID              uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MissionCode     string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"missionCode"`
	Name            string         `gorm:"type:varchar(150);not null" json:"name"`
	Category        string         `gorm:"type:varchar(100);not null" json:"category"`
	Status          string         `gorm:"type:varchar(20);default:'PENDING'" json:"status"`
	AreaPolygon     string         `gorm:"type:text" json:"areaPolygon"`
	Duration        int            `json:"duration"`
	CoverageArea    float64        `json:"coverageArea"`
	TotalDetections int            `json:"totalDetections"`
	AssetID         uuid.UUID      `gorm:"type:uuid;not null" json:"assetId"`
	Asset           Asset          `gorm:"foreignKey:AssetID" json:"asset"`
	PilotID         uuid.UUID      `gorm:"type:uuid;not null" json:"pilotId"`
	Pilot           User           `gorm:"foreignKey:PilotID" json:"pilot"`
	Snapshots       []Snapshot     `gorm:"foreignKey:MissionID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"snapshots"`
	TeamMemberIDs   string         `gorm:"type:text;default:'[]'" json:"teamMemberIds"`
	VideoPath       string         `gorm:"type:text" json:"videoPath"`
	StartedAt       *time.Time     `json:"startedAt"`
	EndedAt         *time.Time     `json:"endedAt"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type PreFlightCheck struct {
	MissionID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"missionId"`
	Mission          Mission    `gorm:"foreignKey:MissionID" json:"-"`
	HullIntegrity    bool       `json:"hullIntegrity"`
	SonarSystem      bool       `json:"sonarSystem"`
	BatteryConn      bool       `json:"batteryConn"`
	Thruster         bool       `json:"thruster"`
	DepthSensor      bool       `json:"depthSensor"`
	WaterproofSeals  bool       `json:"waterproofSeals"`
	NavigationSystem bool       `json:"navigationSystem"`
	Communication    bool       `json:"communication"`
	VerifiedAt       *time.Time `json:"verifiedAt"`
}

type MissionArchive struct {
	MissionID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"missionId"`
	TotalDistance    float64   `json:"totalDistance"`
	TotalDuration   int       `json:"totalDuration"`
	TotalDetections int       `json:"totalDetections"`
	VideoArchiveURL string    `json:"videoArchiveUrl"`
	TelemetryExport string    `json:"telemetryExport"`
}

type VisionPayload struct {
	FlightID string  `json:"flight_id"`
	Type     string  `json:"type"`
	Conf     float64 `json:"conf"`
	BBox     struct {
		X1 float64 `json:"x1"`
		Y1 float64 `json:"y1"`
		X2 float64 `json:"x2"`
		Y2 float64 `json:"y2"`
	} `json:"bbox"`
}

// Snapshot stores AI detection results (CLIP classification + YOLO confidence)
// tied to a specific mission. Cascade-deleted when mission is removed.
type Snapshot struct {
	ID             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MissionID      uuid.UUID `gorm:"type:uuid;not null;index" json:"missionId"`
	TrackID        int       `json:"trackId"`
	Classification string    `gorm:"type:varchar(100)" json:"classification"`
	Confidence     float64   `json:"confidence"`
	SnapshotURL    string    `gorm:"type:text" json:"snapshotUrl"`
	BboxX1         float64   `json:"bboxX1"`
	BboxY1         float64   `json:"bboxY1"`
	BboxX2         float64   `json:"bboxX2"`
	BboxY2         float64   `json:"bboxY2"`
	DetectedAt     time.Time `json:"detectedAt"`
	CreatedAt      time.Time `json:"createdAt"`
}