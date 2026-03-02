import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Square, Trash2, Edit, Hand, ZoomIn, ZoomOut } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface AOIPolygon {
  id: string;
  points: Point[];
  color: string;
  name: string;
  completed: boolean;
}

interface EditableAOICanvasProps {
  width?: number;
  height?: number;
  onAreasChange?: (areas: AOIPolygon[]) => void;
}

export default function EditableAOICanvas({ width = 800, height = 500, onAreasChange }: EditableAOICanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [areas, setAreas] = useState<AOIPolygon[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [mode, setMode] = useState<'draw' | 'edit' | 'pan'>('pan');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ areaId: string; pointIndex: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPoint, setDragPoint] = useState<{ areaId: string; pointIndex: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<Point | null>(null);

  const colors = ['#ef4444', '#21A68D', '#0F4C75', '#D4E268', '#8b5cf6'];

  useEffect(() => {
    drawCanvas();
  }, [areas, currentPolygon, hoveredPoint, scale, offset]);

  useEffect(() => {
    if (onAreasChange) {
      onAreasChange(areas.filter(a => a.completed));
    }
  }, [areas]);

  useEffect(() => {
    // Initial draw on mount
    const timer = setTimeout(() => {
      drawCanvas();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Save context state
    ctx.save();

    // Apply transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw background pattern
    drawBackground(ctx);

    // Draw completed areas
    areas.forEach((area) => {
      if (area.points.length > 0) {
        drawPolygon(ctx, area.points, area.color, area.completed, area.id === selectedArea);
      }
    });

    // Draw current polygon being drawn
    if (currentPolygon.length > 0) {
      drawPolygon(ctx, currentPolygon, colors[areas.length % colors.length], false, true);
    }

    // Draw control points for editing
    if (mode === 'edit' && selectedArea) {
      const area = areas.find(a => a.id === selectedArea);
      if (area) {
        drawControlPoints(ctx, area.points, area.id);
      }
    }

    // Restore context state
    ctx.restore();
  };

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // Grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
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

    // Map-like features (simulated)
    ctx.fillStyle = 'rgba(15, 76, 117, 0.2)';
    ctx.fillRect(100, 100, 200, 150);
    ctx.fillRect(400, 200, 150, 180);
    
    ctx.fillStyle = 'rgba(33, 166, 141, 0.15)';
    ctx.fillRect(250, 280, 180, 120);
  };

  const drawPolygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string, completed: boolean, isActive: boolean) => {
    if (points.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    if (completed) {
      ctx.closePath();
      ctx.fillStyle = color + '33'; // 20% opacity
      ctx.fill();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.stroke();

    // Draw vertices
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const drawControlPoints = (ctx: CanvasRenderingContext2D, points: Point[], areaId: string) => {
    points.forEach((point, index) => {
      const isHovered = hoveredPoint?.areaId === areaId && hoveredPoint?.pointIndex === index;
      
      ctx.beginPath();
      ctx.arc(point.x, point.y, isHovered ? 8 : 6, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? '#D4E268' : '#21A68D';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    
    return { x, y };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'pan') return;

    const point = getCanvasPoint(e);

    if (mode === 'draw') {
      setCurrentPolygon([...currentPolygon, point]);
    } else if (mode === 'edit' && selectedArea) {
      // Check if clicking on existing area to select it
      const clickedArea = areas.find(area => isPointInPolygon(point, area.points));
      if (clickedArea) {
        setSelectedArea(clickedArea.id);
      }
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === 'draw' && currentPolygon.length >= 3) {
      // Complete the polygon
      const newArea: AOIPolygon = {
        id: `area-${Date.now()}`,
        points: [...currentPolygon],
        color: colors[areas.length % colors.length],
        name: `Zone ${areas.length + 1}`,
        completed: true,
      };
      setAreas([...areas, newArea]);
      setCurrentPolygon([]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    if (mode === 'pan') {
      setIsDragging(true);
      setPanStart(point);
    } else if (mode === 'edit' && selectedArea) {
      // Check if clicking on a control point
      const area = areas.find(a => a.id === selectedArea);
      if (area) {
        const pointIndex = area.points.findIndex(p => 
          Math.hypot(p.x - point.x, p.y - point.y) < 10 / scale
        );
        if (pointIndex !== -1) {
          setDragPoint({ areaId: selectedArea, pointIndex });
          setIsDragging(true);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    if (mode === 'pan' && isDragging && panStart) {
      const dx = (point.x - panStart.x) * scale;
      const dy = (point.y - panStart.y) * scale;
      setOffset({ x: offset.x + dx, y: offset.y + dy });
      setPanStart(point);
    } else if (mode === 'edit' && isDragging && dragPoint) {
      // Update point position
      setAreas(areas.map(area => {
        if (area.id === dragPoint.areaId) {
          const newPoints = [...area.points];
          newPoints[dragPoint.pointIndex] = point;
          return { ...area, points: newPoints };
        }
        return area;
      }));
    } else if (mode === 'edit' && selectedArea) {
      // Check if hovering over a control point
      const area = areas.find(a => a.id === selectedArea);
      if (area) {
        const pointIndex = area.points.findIndex(p => 
          Math.hypot(p.x - point.x, p.y - point.y) < 10 / scale
        );
        if (pointIndex !== -1) {
          setHoveredPoint({ areaId: selectedArea, pointIndex });
        } else {
          setHoveredPoint(null);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragPoint(null);
    setPanStart(null);
  };

  const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const deleteArea = (areaId: string) => {
    setAreas(areas.filter(a => a.id !== areaId));
    if (selectedArea === areaId) {
      setSelectedArea(null);
    }
  };

  const clearAll = () => {
    setAreas([]);
    setCurrentPolygon([]);
    setSelectedArea(null);
  };

  const handleZoomIn = () => {
    setScale(Math.min(scale * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(Math.max(scale / 1.2, 0.5));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'pan' ? 'default' : 'outline'}
              onClick={() => setMode('pan')}
              className={mode === 'pan' ? 'bg-[#21A68D]' : ''}
            >
              <Hand className="w-4 h-4 mr-2" />
              Pan
            </Button>
            <Button
              size="sm"
              variant={mode === 'draw' ? 'default' : 'outline'}
              onClick={() => setMode('draw')}
              className={mode === 'draw' ? 'bg-[#21A68D]' : ''}
            >
              <Square className="w-4 h-4 mr-2" />
              Draw Zone
            </Button>
            <Button
              size="sm"
              variant={mode === 'edit' ? 'default' : 'outline'}
              onClick={() => setMode('edit')}
              className={mode === 'edit' ? 'bg-[#21A68D]' : ''}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearAll}
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </Card>

      {/* Canvas */}
      <div className="relative rounded-lg border border-border overflow-hidden bg-[#0a0f1a]">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair"
          style={{ 
            width: '100%', 
            height: 'auto',
            cursor: mode === 'pan' ? 'grab' : mode === 'draw' ? 'crosshair' : 'pointer'
          }}
        />

        {/* Instructions overlay */}
        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border border-border rounded px-3 py-2 text-xs max-w-xs">
          {mode === 'draw' && (
            <div>
              <p className="font-semibold" style={{ color: '#21A68D' }}>Draw Mode</p>
              <p className="text-muted-foreground mt-1">Click to add points. Double-click to complete zone.</p>
            </div>
          )}
          {mode === 'edit' && (
            <div>
              <p className="font-semibold" style={{ color: '#21A68D' }}>Edit Mode</p>
              <p className="text-muted-foreground mt-1">Click and drag points to edit zones.</p>
            </div>
          )}
          {mode === 'pan' && (
            <div>
              <p className="font-semibold" style={{ color: '#21A68D' }}>Pan Mode</p>
              <p className="text-muted-foreground mt-1">Click and drag to pan the map.</p>
            </div>
          )}
        </div>

        {/* Zoom level indicator */}
        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm border border-border rounded px-2 py-1 text-xs">
          Zoom: {(scale * 100).toFixed(0)}%
        </div>
      </div>

      {/* Areas List */}
      {areas.length > 0 && (
        <Card className="p-3 bg-muted/30">
          <h4 className="text-sm mb-2" style={{ color: '#21A68D' }}>Defined Zones ({areas.length})</h4>
          <div className="space-y-2">
            {areas.map((area) => (
              <div
                key={area.id}
                className={`flex items-center justify-between p-2 rounded border ${
                  selectedArea === area.id ? 'border-[#21A68D] bg-[#21A68D]/10' : 'border-border'
                }`}
                onClick={() => setSelectedArea(area.id)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: area.color }}
                  />
                  <div>
                    <p className="text-sm">{area.name}</p>
                    <p className="text-xs text-muted-foreground">{area.points.length} points</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteArea(area.id);
                  }}
                  className="text-red-500 hover:bg-red-500 hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
