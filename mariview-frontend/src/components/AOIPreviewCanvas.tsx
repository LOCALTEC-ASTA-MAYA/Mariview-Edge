import { useEffect, useRef } from 'react';
import { Card } from './ui/card';

interface AOIArea {
  id: number;
  name: string;
  type: string;
  coordinates: Array<{ lat: number; lng: number }>;
  area: number;
  priority: string;
  detections: number;
  notes: string;
}

interface AOIPreviewCanvasProps {
  areas: AOIArea[];
  width?: number;
  height?: number;
}

export default function AOIPreviewCanvas({ areas, width = 800, height = 500 }: AOIPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    drawCanvas();
  }, [areas]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    drawBackground(ctx);

    if (areas.length === 0) return;

    // Draw AOI polygons
    areas.forEach((area, index) => {
      const points = coordinatesToCanvasPoints(area.coordinates);
      const color = getAreaColor(area.priority, index);
      drawPolygon(ctx, points, color, area.name, area.id);
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

    // Simulated map features
    ctx.fillStyle = 'rgba(15, 76, 117, 0.2)';
    ctx.fillRect(80, 60, 180, 120);
    ctx.fillRect(450, 200, 200, 150);
    
    ctx.fillStyle = 'rgba(33, 166, 141, 0.15)';
    ctx.fillRect(280, 280, 160, 100);
    ctx.fillRect(600, 90, 140, 160);

    // Simulated roads
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2 + 50);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2 + 80, height);
    ctx.stroke();
  };

  const coordinatesToCanvasPoints = (coordinates: Array<{ lat: number; lng: number }>): Array<{ x: number; y: number }> => {
    if (coordinates.length === 0) return [];

    // Find bounds
    const lats = coordinates.map(c => c.lat);
    const lngs = coordinates.map(c => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const padding = 60;
    const usableWidth = width - (padding * 2);
    const usableHeight = height - (padding * 2);

    // Convert to canvas coordinates
    return coordinates.map(coord => {
      const x = padding + ((coord.lng - minLng) / (maxLng - minLng || 1)) * usableWidth;
      const y = padding + ((maxLat - coord.lat) / (maxLat - minLat || 1)) * usableHeight;
      return { x, y };
    });
  };

  const getAreaColor = (priority: string, index: number): string => {
    if (priority === 'High') return '#ef4444';
    if (priority === 'Medium') return '#D4E268';
    if (priority === 'Low') return '#21A68D';
    
    const colors = ['#ef4444', '#21A68D', '#0F4C75', '#D4E268', '#8b5cf6'];
    return colors[index % colors.length];
  };

  const drawPolygon = (ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, color: string, name: string, id: number) => {
    if (points.length < 3) return;

    // Draw filled polygon
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();

    // Fill with semi-transparent color
    ctx.fillStyle = color + '33'; // 20% opacity
    ctx.fill();

    // Draw border
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw vertices
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Calculate center for label
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    // Draw ID badge
    ctx.beginPath();
    ctx.arc(centerX, centerY, 16, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw ID number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id.toString(), centerX, centerY);

    // Draw name label
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const textWidth = ctx.measureText(name).width;
    ctx.fillRect(centerX - textWidth / 2 - 8, centerY + 20, textWidth + 16, 24);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(centerX - textWidth / 2 - 8, centerY + 20, textWidth + 16, 24);

    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, centerX, centerY + 32);
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
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span className="text-muted-foreground">High Priority</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#D4E268' }}></div>
              <span className="text-muted-foreground">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#21A68D' }}></div>
              <span className="text-muted-foreground">Low</span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded px-3 py-2 text-xs z-10">
          <div className="text-muted-foreground">Total Areas</div>
          <div className="text-lg mt-1" style={{ color: '#21A68D' }}>{areas.length}</div>
        </div>
      </div>
    </div>
  );
}
