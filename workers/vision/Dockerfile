FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (FFmpeg + OpenCV native libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (leverage Docker cache)
COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# Pre-download YOLOv8 nano model so first run is instant
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy application code
COPY mock_yolo.py .
COPY virtual_drone.py .

# Default: run the virtual drone simulator
# Override with CMD to run mock_yolo.py instead
CMD ["python", "-u", "virtual_drone.py"]
