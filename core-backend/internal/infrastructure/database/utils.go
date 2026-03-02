package database

import (
	"time"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
)

func InfluxPoint(measurement string, tags map[string]string, fields map[string]interface{}, t time.Time) *write.Point {
	return influxdb2.NewPoint(measurement, tags, fields, t)
}