package database

import (
	"log"
	"time"

	"locallitix-core/internal/domain"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB is the global database instance, accessible by resolvers
var DB *gorm.DB

func InitPostgres(dsn string) *gorm.DB {
	var db *gorm.DB
	var err error

	for i := 0; i < 20; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			log.Println("[DB] PostgreSQL is Ready!")
			break
		}
		log.Printf(" [DB] Waiting for PostgreSQL to boot... (%d/20)", i+1)
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Fatalf("[DB] Failed to connect to PostgreSQL: %v", err)
	}

	err = db.AutoMigrate(
		&domain.User{},
		&domain.Asset{},
		&domain.Mission{},
		&domain.Snapshot{},
		&domain.PreFlightCheck{},
		&domain.MissionArchive{},
	)
	if err != nil {
		log.Fatalf(" [DB] Migration failed: %v", err)
	}

	DB = db
	return db
}