import os
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

import cv2
import json
import time
import subprocess
import asyncio
from ultralytics import YOLO
from nats.aio.client import Client as NATS

async def main():
    nc = NATS()
    await nc.connect("nats://locallitix-backbone:4222")
    js = nc.jetstream()
    
    model = YOLO('yolov8n.pt')

    input_rtsp = "rtsp://locallitix-video:8554/drone"
    output_rtsp = "rtsp://locallitix-video:8554/dashboard"
    
    cap = cv2.VideoCapture(input_rtsp)
    while not cap.isOpened():
        time.sleep(2)
        cap.open(input_rtsp)

    width, height, fps = 640, 480, 15

    ffmpeg_cmd = [
        'ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
        '-pix_fmt', 'bgr24', '-s', f"{width}x{height}", '-r', str(fps),
        '-i', '-', '-c:v', 'libx264', '-preset', 'ultrafast', 
        '-rtsp_transport', 'tcp', '-f', 'rtsp', output_rtsp
    ]
    process = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

    frame_count = 0
    last_boxes = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        frame = cv2.resize(frame, (width, height))

        if frame_count % 3 == 0:
            results = model(frame, verbose=False, conf=0.5)
            last_boxes = []
            
            for r in results:
                for box in r.boxes:
                    b = box.xyxy[0].tolist()
                    label = model.names[int(box.cls)]
                    conf = float(box.conf)
                    
                    last_boxes.append({"b": b, "label": label, "conf": conf})

                    payload = json.dumps({
                        "flight_id": "DRONE-ALPHA",
                        "type": label,
                        "conf": conf,
                        "bbox": {"x1": b[0], "y1": b[1], "x2": b[2], "y2": b[3]}
                    }).encode()
                    
                    await js.publish("VISION.ai_vessel.bbox.detected", payload)

        for obj in last_boxes:
            b = obj["b"]
            label = obj["label"]
            conf = obj["conf"]
            cv2.rectangle(frame, (int(b[0]), int(b[1])), (int(b[2]), int(b[3])), (0, 255, 0), 2)
            cv2.putText(frame, f"{label.upper()} | {conf:.2f}", (int(b[0]), int(b[1])-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        try:
            process.stdin.write(frame.tobytes())
        except Exception:
            break

    cap.release()
    process.stdin.close()
    process.wait()
    await nc.close()

if __name__ == '__main__':
    asyncio.run(main())