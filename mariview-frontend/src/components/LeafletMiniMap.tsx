import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface LeafletMiniMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  coordinates?: { lat: number; lng: number }[];
}

export default function LeafletMiniMap({
  center = [-6.2088, 106.8456],
  zoom = 13,
  className = '',
  coordinates = []
}: LeafletMiniMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      }).setView(center, zoom);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        className: 'map-tiles',
      }).addTo(mapRef.current);

      // Add grid overlay
      const GridLayerClass = L.GridLayer.extend({
        createTile: function (coords: any) {
          const tile = document.createElement('canvas');
          const ctx = tile.getContext('2d');
          const tileSize = this.getTileSize();

          tile.width = tileSize.x;
          tile.height = tileSize.y;

          if (ctx) {
            ctx.strokeStyle = '#21A68D';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.15;

            for (let x = 0; x <= tileSize.x; x += tileSize.x / 4) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, tileSize.y);
              ctx.stroke();
            }

            for (let y = 0; y <= tileSize.y; y += tileSize.y / 4) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(tileSize.x, y);
              ctx.stroke();
            }
          }

          return tile;
        }
      });

      const gridLayer = new (GridLayerClass as any)({ opacity: 1, zIndex: 400 });
      gridLayer.addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update polygon when coordinates change
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing polygon
    if (polygonRef.current) {
      mapRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    // Add new polygon if coordinates exist
    if (coordinates && coordinates.length > 0) {
      const latlngs = coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);

      polygonRef.current = L.polygon(latlngs, {
        color: '#21A68D',
        fillColor: '#21A68D',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(mapRef.current);

      // Fit bounds to show the polygon
      const bounds = polygonRef.current.getBounds();
      mapRef.current.fitBounds(bounds, { padding: [10, 10] });
    }
  }, [coordinates]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={{ height: '150px', width: '100%' }}
      />
      <style>{`
        .map-tiles {
          filter: brightness(0.6) contrast(1.2) saturate(0.8);
        }
      `}</style>
    </>
  );
}
