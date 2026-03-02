# LOCALLITIX CORE

---

## Setup

1. Clone repositori

2. Berikan hak akses eksekusi pada skrip (Linux/Mac):

```bash
chmod +x scripts/setup.sh
```

3. Jalankan Bash Script:

```bash
./scripts/setup.sh
```
---

### 2. KREDENSIAL DEFAULT

Seluruh sistem menggunakan kata sandi terpusat untuk fase Development/Staging.

| Layanan | URL / Port | Username | Password |
|--------|------------|----------|----------|
| Keycloak Admin | http://localhost:8081 | admin | admin |
| App Login (Komandan) | via Frontend / API | komandan | komandan123 |
| App Login (Pilot) | via Frontend / API | pilot_alpha | pilot123 |
| InfluxDB (Telemetry) | http://localhost:8086 | admin | supersecretpassword |
| PostgreSQL (GORM) | localhost:5432 | root | supersecretpassword |

---

## 3. NATS

### NATS JetStream

- Client Port: `4222`
- Management Port: `8222`
- Stream Name: `VISION_STREAM`
- Target Subject AI:
  ```
  VISION.ai_vessel.bbox.detected
  ```

> Gunakan format ini jika menambah AI Worker baru.

---

### Frontend Endpoints (API Contract)

- **Live Video Feed (RTSP)**
  ```
  rtsp://localhost:8554/dashboard
  ```

- **Live Target Telemetry (WebSocket)**
  ```
  ws://localhost:8080/ws/vision
  ```

- **GraphQL Gateway**
  ```
  http://localhost:8080/query
  ```
  _(Under Construction)_

---

## 4. SIMULASI OPERASI (TESTING)

Jika tidak ada drone fisik yang terhubung, Anda bisa mensimulasikan aliran data (video + koordinat AI) dengan menembakkan video MP4 lokal ke dalam sistem.

Jalankan perintah berikut:

```bash
ffmpeg -re -stream_loop -1 -i nama_video_test.mp4 \\
  -c:v copy -an -rtsp_transport tcp -f rtsp \\
  rtsp://localhost:8554/drone
```

---
