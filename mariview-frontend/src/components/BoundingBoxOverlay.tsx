import { useRef, useEffect, useCallback } from 'react';
import type { VisionDetection } from '../hooks/useVisionWebSocket';

/**
 * Color map for detection classes — matches the C4I tactical theme.
 */
const CLASS_COLORS: Record<string, string> = {
    illegal_fishing_vessel: '#ef4444', // red
    cargo_vessel: '#22c55e',           // green
    patrol_boat: '#3b82f6',            // blue
    speedboat: '#f97316',              // orange
    fishing_net: '#a855f7',            // purple
    hull_number: '#06b6d4',            // cyan
    vessel_name_plate: '#14b8a6',      // teal
    oil_spill: '#dc2626',              // dark red
    floating_debris: '#eab308',        // yellow
    person_on_deck: '#ec4899',         // pink
    swimmer_in_water: '#f43f5e',       // rose
};

const DEFAULT_COLOR = '#21A68D';

interface BoundingBoxOverlayProps {
    /** Current detections to render */
    detections: VisionDetection[];
    /** Source resolution [width, height] from the YOLO model (fallback if no videoRef) */
    sourceResolution?: [number, number];
    /** Optional ref to the HTML5 video element — for precise scaling from native resolution */
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    /** Extra CSS class for the canvas container */
    className?: string;
}

/**
 * BoundingBoxOverlay — draws AI detection bounding boxes on an HTML5 canvas.
 * Must be absolutely positioned over a video feed element.
 *
 * When a `videoRef` is provided, the canvas sizes itself to the video's
 * rendered clientWidth/clientHeight and scales bboxes from the video's
 * native videoWidth/videoHeight. This guarantees pixel-perfect alignment
 * regardless of CSS transforms like object-cover or scale.
 */
export default function BoundingBoxOverlay({
    detections,
    sourceResolution = [1920, 1080],
    videoRef,
    className = '',
}: BoundingBoxOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const detectionsRef = useRef(detections);
    detectionsRef.current = detections;

    // Draw function — reads video/container size, scales bbox coords, draws
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const video = videoRef?.current;

        // Determine canvas dimensions and source (YOLO) resolution
        // When videoRef is available, use the video's ACTUAL rendered + native dimensions
        const elementW = video ? video.clientWidth : container.clientWidth;
        const elementH = video ? video.clientHeight : container.clientHeight;
        const nativeW = video?.videoWidth || sourceResolution[0];
        const nativeH = video?.videoHeight || sourceResolution[1];

        // Match canvas pixel buffer to rendered size (high-DPI aware)
        const dpr = window.devicePixelRatio || 1;
        canvas.width = elementW * dpr;
        canvas.height = elementH * dpr;
        ctx.scale(dpr, dpr);

        // Clear previous frame
        ctx.clearRect(0, 0, elementW, elementH);

        // Compute the ACTUAL rendered video area inside the element.
        // When object-contain is used, the video is letterboxed — we must
        // account for the black bars (padding) so bboxes align to the
        // actual video content, not the element edges.
        const elementAspect = elementW / elementH;
        const videoAspect = nativeW / nativeH;

        let renderW: number, renderH: number, offsetX: number, offsetY: number;

        if (videoAspect > elementAspect) {
            // Video is wider than element → black bars on top/bottom (pillarbox → actually letterbox)
            renderW = elementW;
            renderH = elementW / videoAspect;
            offsetX = 0;
            offsetY = (elementH - renderH) / 2;
        } else {
            // Video is taller than element → black bars on left/right (pillarbox)
            renderH = elementH;
            renderW = elementH * videoAspect;
            offsetX = (elementW - renderW) / 2;
            offsetY = 0;
        }

        // Scale factors: YOLO coords (native resolution) → rendered pixels
        const scaleX = renderW / nativeW;
        const scaleY = renderH / nativeH;

        detectionsRef.current.forEach((det) => {
            const [x1, y1, x2, y2] = det.bbox;
            const sx = x1 * scaleX + offsetX;
            const sy = y1 * scaleY + offsetY;
            const sw = (x2 - x1) * scaleX;
            const sh = (y2 - y1) * scaleY;

            const color = CLASS_COLORS[det.class] || DEFAULT_COLOR;

            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, sw, sh);

            // Draw semi-transparent fill
            ctx.fillStyle = color + '15'; // ~8% opacity
            ctx.fillRect(sx, sy, sw, sh);

            // Draw label background
            const label = `${det.class.replace(/_/g, ' ')} ${Math.round(det.confidence * 100)}%`;
            ctx.font = 'bold 10px monospace';
            const textMetrics = ctx.measureText(label);
            const labelH = 14;
            const labelW = textMetrics.width + 8;

            ctx.fillStyle = color + 'CC'; // ~80% opacity
            ctx.fillRect(sx, sy - labelH, labelW, labelH);

            // Draw label text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, sx + 4, sy - 3);

            // Draw corner brackets for tactical look
            const bracketLen = Math.min(sw, sh) * 0.15;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;

            // Top-left
            ctx.beginPath();
            ctx.moveTo(sx, sy + bracketLen);
            ctx.lineTo(sx, sy);
            ctx.lineTo(sx + bracketLen, sy);
            ctx.stroke();

            // Top-right
            ctx.beginPath();
            ctx.moveTo(sx + sw - bracketLen, sy);
            ctx.lineTo(sx + sw, sy);
            ctx.lineTo(sx + sw, sy + bracketLen);
            ctx.stroke();

            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(sx, sy + sh - bracketLen);
            ctx.lineTo(sx, sy + sh);
            ctx.lineTo(sx + bracketLen, sy + sh);
            ctx.stroke();

            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(sx + sw - bracketLen, sy + sh);
            ctx.lineTo(sx + sw, sy + sh);
            ctx.lineTo(sx + sw, sy + sh - bracketLen);
            ctx.stroke();
        });
    }, [sourceResolution, videoRef]);

    // Redraw whenever detections change
    useEffect(() => {
        draw();
    }, [detections, draw]);

    // Auto-clear canvas when detections go stale (no new data within 500ms)
    // This prevents old bounding boxes from ghosting on screen
    useEffect(() => {
        const timer = setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 500);
        return () => clearTimeout(timer);
    }, [detections]);

    // ResizeObserver — redraw when container resizes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => draw());
        observer.observe(container);
        return () => observer.disconnect();
    }, [draw]);

    // Listen for video metadata load so we get correct videoWidth/videoHeight
    useEffect(() => {
        const video = videoRef?.current;
        if (!video) return;

        const onMeta = () => draw();
        video.addEventListener('loadedmetadata', onMeta);
        // If metadata already loaded, draw immediately
        if (video.readyState >= 1) draw();

        return () => video.removeEventListener('loadedmetadata', onMeta);
    }, [videoRef, draw]);

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 pointer-events-none ${className}`}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ imageRendering: 'crisp-edges' }}
            />
        </div>
    );
}

