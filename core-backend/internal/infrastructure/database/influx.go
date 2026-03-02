package database

import (
	"log"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

type InfluxClient struct {
	Client   influxdb2.Client
	WriteAPI api.WriteAPI
}

func InitInflux(url string, token string, org string, bucket string) *InfluxClient {
	client := influxdb2.NewClient(url, token)
	writeAPI := client.WriteAPI(org, bucket)

	errorsCh := writeAPI.Errors()
	go func() {
		for err := range errorsCh {
			log.Printf("%v", err)
		}
	}()

	return &InfluxClient{
		Client:   client,
		WriteAPI: writeAPI,
	}
}