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
		{
			ID:       uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567801"),
			Name:     "Pyrhos X V1",
			Type:     "Quadcopter",
			Category: "UAV",
			Status:   "STANDBY",
			Battery:  100,
		},
		{
			ID:       uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567802"),
			Name:     "AR-2 Aerial",
			Type:     "Fixed Wing",
			Category: "UAV",
			Status:   "STANDBY",
			Battery:  85,
		},
		{
			ID:       uuid.MustParse("b1b2c3d4-e5f6-7890-abcd-ef1234567803"),
			Name:     "AquaScan Alpha",
			Type:     "Submersible",
			Category: "AUV",
			Status:   "STANDBY",
			Battery:  92,
		},
	}

	for _, a := range assets {
		if err := db.Create(&a).Error; err != nil {
			log.Printf("[SEED] Failed to seed asset %s: %v", a.Name, err)
		} else {
			log.Printf("[SEED] ✅ Asset seeded: %s (ID: %s)", a.Name, a.ID)
		}
	}
}
