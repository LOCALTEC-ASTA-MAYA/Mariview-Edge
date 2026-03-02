import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface AOIArea {
  id: number;
  name: string;
  type: string;
  coordinates: { lat: number; lng: number }[];
  area: number;
  priority: string;
  detections: number;
  notes: string;
}

interface LeafletAOIMapProps {
  center?: [number, number];
  zoom?: number;
  areas: AOIArea[];
  className?: string;
}

// Custom Grid Layer
const createGridLayer = () => {
  return L.GridLayer.extend({
    createTile: function (coords: any) {
      const tile = document.createElement('canvas');
      const ctx = tile.getContext('2d');
      const tileSize = this.getTileSize();

      tile.width = tileSize.x;
      tile.height = tileSize.y;

      if (ctx) {
        // Draw grid lines
        ctx.strokeStyle = '#21A68D';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;

        // Vertical lines
        for (let x = 0; x <= tileSize.x; x += tileSize.x / 4) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, tileSize.y);
          ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= tileSize.y; y += tileSize.y / 4) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(tileSize.x, y);
          ctx.stroke();
        }

        // Draw thicker border lines
        ctx.strokeStyle = '#21A68D';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(0, 0, tileSize.x, tileSize.y);
      }

      return tile;
    }
  });
};

export default function LeafletAOIMap({
  center = [-6.5625, 106.8942], // Sentul, Bogor
  zoom = 13,
  areas = [],
  className = ''
}: LeafletAOIMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonsRef = useRef<L.Polygon[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView(center, zoom);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: 'map-tiles',
      }).addTo(mapRef.current);

      // Add grid layer
      const GridLayerClass = createGridLayer();
      const gridLayer = new (GridLayerClass as any)({
        opacity: 1,
        zIndex: 400
      });
      gridLayer.addTo(mapRef.current);

      // Add zoom control to bottom right
      L.control.zoom({
        position: 'bottomright'
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update AOI polygons
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing polygons
    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Add new polygons
    areas.forEach((area, index) => {
      if (!mapRef.current) return;

      const color = area.priority === 'High' ? '#ef4444' : area.priority === 'Medium' ? '#f59e0b' : '#22c55e';

      const latlngs = area.coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);

      const polygon = L.polygon(latlngs, {
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(mapRef.current);

      // Add popup
      polygon.bindPopup(`
        <div style="font-family: 'Bai Jamjuree', sans-serif; min-width: 200px;">
          <div style="font-weight: 600; color: ${color}; margin-bottom: 8px; font-size: 14px;">${area.name}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Type:</strong> ${area.type}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Area:</strong> ${area.area} km²
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Priority:</strong> <span style="color: ${color};">${area.priority}</span>
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Detections:</strong> ${area.detections}
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 6px; font-style: italic;">
            ${area.notes}
          </div>
        </div>
      `);

      // Add label at centroid
      const bounds = polygon.getBounds();
      const center = bounds.getCenter();

      const label = L.marker(center, {
        icon: L.divIcon({
          className: 'aoi-label',
          html: `
            <div style="
              background: ${color};
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              font-family: 'Bai Jamjuree', sans-serif;
            ">
              ${area.name}
            </div>
          `,
          iconSize: [0, 0],
        })
      }).addTo(mapRef.current);

      polygonsRef.current.push(polygon);
    });

    // Fit bounds to show all areas
    if (areas.length > 0 && mapRef.current) {
      const allCoords = areas.flatMap(area =>
        area.coordinates.map(coord => [coord.lat, coord.lng] as [number, number])
      );
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [areas]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
      />
      <style>{`
        .map-tiles {
          filter: brightness(0.6) contrast(1.2) saturate(0.8);
        }

        .leaflet-popup-content-wrapper {
          background: #1a1f2e;
          color: white;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .leaflet-popup-tip {
          background: #1a1f2e;
        }

        .leaflet-control-zoom {
          border: none !important;
        }

        .leaflet-control-zoom a {
          background: rgba(26, 31, 46, 0.9) !important;
          backdrop-filter: blur(8px);
          color: white !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 18px !important;
        }

        .leaflet-control-zoom a:hover {
          background: #21A68D !important;
          border-color: #21A68D !important;
        }

        .leaflet-control-attribution {
          background: rgba(26, 31, 46, 0.8) !important;
          color: rgba(255,255,255,0.6) !important;
          font-size: 10px !important;
        }

        .leaflet-control-attribution a {
          color: #21A68D !important;
        }

        .aoi-label {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </>
  );
}
