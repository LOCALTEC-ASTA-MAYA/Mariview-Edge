#!/bin/bash
set -e

if ! command -v docker &> /dev/null; then
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    exit 1
fi

mkdir -p data/nats
mkdir -p data/postgres
mkdir -p data/influx

docker-compose down --remove-orphans
docker-compose build
docker-compose up -d

exit 0