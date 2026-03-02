import { useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { MapPin, Navigation } from 'lucide-react';

interface Waypoint {
  id: number;
  lat: number;
  lng: number;
  time: string;
  label: string;
  type: 'start' | 'waypoint' | 'end';
  altitude?: number;
}

interface FlightPathCanvasProps {
  waypoints: Waypoint[];
  width?: number;
  height?: number;
}

export default function FlightPathCanvas({ waypoints, width = 800, height = 400 }: FlightPathCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawFlightPath();
  }, [waypoints]);

  const drawFlightPath = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    drawBackground(ctx);

    if (waypoints.length === 0) return;

    // Convert lat/lng to canvas coordinates
    const points = waypointsToCanvasPoints(waypoints);

    // Draw flight path
    drawPath(ctx, points);

    // Draw waypoints
    points.forEach((point, index) => {
      const waypoint = waypoints[index];
      drawWaypoint(ctx, point, waypoint);
    });
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0f1a');
    gradient.addColorStop(1, '#0f1419');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    const gridSize = 40;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Simulated map features (roads, areas)
    ctx.fillStyle = 'rgba(15, 76, 117, 0.2)';
    ctx.fillRect(50, 50, 200, 100);
    ctx.fillRect(400, 180, 180, 120);
    
    ctx.fillStyle = 'rgba(33, 166, 141, 0.15)';
    ctx.fillRect(250, 220, 150, 100);
    ctx.fillRect(600, 80, 120, 140);

    // Simulated water bodies
    ctx.fillStyle = 'rgba(15, 76, 117, 0.3)';
    ctx.beginPath();
    ctx.arc(150, 300, 60, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(650, 280, 50, 0, 2 * Math.PI);
    ctx.fill();
  };

  const waypointsToCanvasPoints = (waypoints: Waypoint[]): Array<{ x: number; y: number }> => {
    if (waypoints.length === 0) return [];

    // Find bounds
    const lats = waypoints.map(w => w.lat);
    const lngs = waypoints.map(w => w.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const padding = 80;
    const usableWidth = width - (padding * 2);
    const usableHeight = height - (padding * 2);

    // Convert to canvas coordinates
    return waypoints.map(wp => {
      const x = padding + ((wp.lng - minLng) / (maxLng - minLng)) * usableWidth;
      const y = padding + ((maxLat - wp.lat) / (maxLat - minLat)) * usableHeight;
      return { x, y };
    });
  };

  const drawPath = (ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return;

    // Draw dashed line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#21A68D';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw solid background line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = 'rgba(33, 166, 141, 0.3)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Draw direction arrows
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      drawArrow(ctx, p1.x, p1.y, p2.x, p2.y);
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLength = 8;
    const arrowWidth = 6;

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowLength, -arrowWidth);
    ctx.lineTo(-arrowLength, arrowWidth);
    ctx.closePath();
    
    ctx.fillStyle = '#21A68D';
    ctx.fill();
    ctx.restore();
  };

  const drawWaypoint = (ctx: CanvasRenderingContext2D, point: { x: number; y: number }, waypoint: Waypoint) => {
    const isStart = waypoint.type === 'start';
    const isEnd = waypoint.type === 'end';
    
    const color = isStart ? '#22c55e' : isEnd ? '#ef4444' : '#21A68D';
    const radius = isStart || isEnd ? 10 : 8;

    // Draw range circle for start and end
    if (isStart || isEnd) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 30, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.05;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw waypoint circle
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw start indicator
    if (isStart) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', point.x, point.y);
    }

    // Draw label
    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(waypoint.label, point.x, point.y - radius - 8);

    // Draw time
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(waypoint.time, point.x, point.y + radius + 4);
  };

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="relative rounded-lg border border-border overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto bg-[#0a0f1a]"
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm border border-border rounded px-3 py-2 text-xs z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
              <span className="text-muted-foreground">Start</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#21A68D] border-2 border-white"></div>
              <span className="text-muted-foreground">Waypoint</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div>
              <span className="text-muted-foreground">End</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded px-3 py-2 text-xs z-10">
          <div className="text-muted-foreground">Total Waypoints</div>
          <div className="text-lg mt-1" style={{ color: '#21A68D' }}>{waypoints.length}</div>
        </div>
      </div>

      {/* Waypoint Details */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {waypoints.map((waypoint) => {
          const color = waypoint.type === 'start' ? '#22c55e' : waypoint.type === 'end' ? '#ef4444' : '#21A68D';
          return (
            <Card key={waypoint.id} className="p-2 bg-muted/30 border-border">
              <div className="flex items-start gap-2">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {waypoint.type === 'start' ? '▲' : waypoint.id}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{waypoint.label}</p>
                  <p className="text-xs text-muted-foreground">{waypoint.time}</p>
                  {waypoint.altitude !== undefined && (
                    <p className="text-xs" style={{ color: '#21A68D' }}>Alt: {waypoint.altitude}m</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
