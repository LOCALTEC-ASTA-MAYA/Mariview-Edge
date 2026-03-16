package database

import (
	"log"

	"locallitix-core/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SeedDefaults populates pilots (Users) and assets (Drones) if the tables are
// empty. This ensures the Create Mission wizard can reference valid Postgres
// UUIDs on first boot. Called once from main.go after InitPostgres.
func SeedDefaults(db *gorm.DB) {
	seedPilots(db)
	seedAssets(db)
}

func seedPilots(db *gorm.DB) {
	var count int64
	db.Model(&domain.User{}).Count(&count)
	if count > 0 {
		log.Printf("[SEED] Users table already has %d rows — skipping seed", count)
		return
	}

	pilots := []domain.User{
		{
			ID:         uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567801"),
			KeycloakID: "kc-sarah-chen",
			Name:       "Sarah Chen",
			Role:       "Pilot",
			Email:      "sarah.chen@mariview.id",
			Status:     "AVAILABLE",
		},
		{
			ID:         uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567802"),
			KeycloakID: "kc-john-anderson",
			Name:       "John Anderson",
			Role:       "Pilot",
			Email:      "john.anderson@mariview.id",
			Status:     "AVAILABLE",
		},
		{
			ID:         uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567803"),
			KeycloakID: "kc-emily-davis",
			Name:       "Emily Davis",
			Role:       "Camera Operator",
			Email:      "emily.davis@mariview.id",
			Status:     "AVAILABLE",
		},
	}

	for _, p := range pilots {
		if err := db.Create(&p).Error; err != nil {
			log.Printf("[SEED] Failed to seed pilot %s: %v", p.Name, err)
		} else {
			log.Printf("[SEED] ✅ Pilot seeded: %s (ID: %s)", p.Name, p.ID)
		}
	}
}

func seedAssets(db *gorm.DB) {
	var count int64
	db.Model(&domain.Asset{}).Count(&count)
	if count > 0 {
		log.Printf("[SEED] Assets table already has %d rows — skipping seed", count)
		return
	}

	assets := []domain.Asset{
		// UAV
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567801"),
			Name: "Pyrhos X V1", Type: "Aerial Quadcopter", Category: "UAV",
			Status: "STANDBY", Battery: 100, Serial: "PXV1-2024-001",
			Location: "Hangar A", FlightHours: 245, TotalOps: 89,
		},
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567802"),
			Name: "AR-2 Aerial", Type: "Tactical Drone", Category: "UAV",
			Status: "STANDBY", Battery: 95, Serial: "AR2-2024-003",
			Location: "Hangar B", FlightHours: 156, TotalOps: 54,
		},
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567810"),
			Name: "Ephyros Alpha", Type: "High Altitude", Category: "UAV",
			Status: "STANDBY", Battery: 78, Serial: "EPA-2024-004",
			Location: "Charging Station", FlightHours: 312, TotalOps: 102,
		},
		// AUV
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567803"),
			Name: "AquaScan Alpha", Type: "Survey AUV", Category: "AUV",
			Status: "STANDBY", Battery: 92, Serial: "ASA-2024-001",
			Location: "Dock A", FlightHours: 123, TotalOps: 34, MaxDepth: 500,
		},
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567811"),
			Name: "DeepSeeker Pro", Type: "Deep Sea AUV", Category: "AUV",
			Status: "STANDBY", Battery: 78, Serial: "DSP-2024-002",
			Location: "Maintenance Bay", FlightHours: 289, TotalOps: 56, MaxDepth: 1000,
		},
		// VEHICLE
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567804"),
			Name: "Mobile Command Unit", Type: "Command Vehicle", Category: "VEHICLE",
			Status: "STANDBY", Fuel: 85, Plate: "B 1234 XYZ",
			Location: "Base Garage", Mileage: 12500,
		},
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567812"),
			Name: "Field Support Truck", Type: "Support Vehicle", Category: "VEHICLE",
			Status: "STANDBY", Fuel: 92, Plate: "B 5678 ABC",
			Location: "Tanjung Priok", Mileage: 8900,
		},
		// ACCESSORY
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567805"),
			Name: "LiPo Battery 6S", Type: "Battery", Category: "ACCESSORY",
			Status: "STANDBY", Quantity: 24,
			Capacity: "22000mAh", Voltage: "22.2V",
		},
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567813"),
			Name: "Gimbal Camera 4K", Type: "Camera", Category: "ACCESSORY",
			Status: "STANDBY", Quantity: 6,
			Capacity: "4K 60fps", Voltage: "CMOS",
		},
		{
			ID: uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567814"),
			Name: "Carbon Fiber Propeller Set", Type: "Propeller", Category: "ACCESSORY",
			Status: "STANDBY", Quantity: 32,
			Capacity: "15 inch", Voltage: "Carbon Fiber",
		},
	}

	for _, a := range assets {
		if err := db.Create(&a).Error; err != nil {
			log.Printf("[SEED] Failed to seed asset %s: %v", a.Name, err)
		} else {
			log.Printf("[SEED] ✅ Asset seeded: %s (ID: %s, Cat: %s)", a.Name, a.ID, a.Category)
		}
	}
}
