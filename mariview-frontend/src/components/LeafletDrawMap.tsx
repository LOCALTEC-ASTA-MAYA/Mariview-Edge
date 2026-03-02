import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface AISMarker {
  id: string;
  name: string;
  position: [number, number];
  type: string;
  speed: number;
}

interface ADSBMarker {
  id: string;
  name: string;
  position: [number, number];
  altitude: number;
  speed: number;
  heading: number;
}

interface LeafletDrawMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  onAreaDrawn?: (coordinates: { lat: number; lng: number }[], description: string) => void;
  aisMarkers?: AISMarker[];
  adsbMarkers?: ADSBMarker[];
  showAIS?: boolean;
  showADSB?: boolean;
  showENC?: boolean;
  height?: string;
}

export default function LeafletDrawMap({
  center = [-6.2088, 106.8456], // Jakarta
  zoom = 13,
  className = '',
  onAreaDrawn,
  aisMarkers,
  adsbMarkers,
  showAIS = false,
  showADSB = false,
  showENC = false,
  height = '500px'
}: LeafletDrawMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const drawnLayersRef = useRef<L.FeatureGroup | null>(null);
  const drawingModeRef = useRef<'polygon' | 'rectangle' | null>(null);
  const tempMarkers = useRef<L.CircleMarker[]>([]);
  const tempPolyline = useRef<L.Polyline | null>(null);
  const polygonPoints = useRef<L.LatLng[]>([]);

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
        attribution: '&copy; OpenStreetMap contributors',
        className: 'map-tiles',
      }).addTo(mapRef.current);

      // Add drawn layers group
      drawnLayersRef.current = new L.FeatureGroup();
      drawnLayersRef.current.addTo(mapRef.current);

      // Add zoom control
      L.control.zoom({
        position: 'bottomright'
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
            ctx.globalAlpha = 0.2;

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

      setIsMapReady(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Add ENC layer
  const encLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (showENC && !encLayerRef.current) {
      // Add OpenSeaMap layer (ENC - Electronic Navigational Charts)
      encLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenSeaMap contributors',
        opacity: 0.8,
      }).addTo(map);
    } else if (!showENC && encLayerRef.current) {
      map.removeLayer(encLayerRef.current);
      encLayerRef.current = null;
    }
  }, [showENC, isMapReady]);

  // Expose drawing methods via window for external control
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Handle polygon drawing
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (drawingModeRef.current !== 'polygon') return;

      polygonPoints.current.push(e.latlng);

      // Add marker
      const marker = L.circleMarker(e.latlng, {
        radius: 5,
        fillColor: '#21A68D',
        color: '#21A68D',
        weight: 2,
        fillOpacity: 1
      }).addTo(map);
      tempMarkers.current.push(marker);

      // Draw temporary polyline
      if (tempPolyline.current) {
        map.removeLayer(tempPolyline.current);
      }
      if (polygonPoints.current.length > 1) {
        tempPolyline.current = L.polyline(polygonPoints.current, {
          color: '#21A68D',
          weight: 2,
          dashArray: '5, 5'
        }).addTo(map);
      }
    };

    map.on('click', handleMapClick);

    // Store methods on window for external control
    (window as any).leafletDrawMap = {
      startPolygon: () => {
        drawingModeRef.current = 'polygon';
        polygonPoints.current = [];
        tempMarkers.current = [];
      },
      finishPolygon: () => {
        if (polygonPoints.current.length >= 3) {
          // Remove temporary elements
          tempMarkers.current.forEach(m => map.removeLayer(m));
          if (tempPolyline.current) map.removeLayer(tempPolyline.current);

          // Create polygon
          const polygon = L.polygon(polygonPoints.current, {
            color: '#21A68D',
            fillColor: '#21A68D',
            fillOpacity: 0.2,
            weight: 2
          });
          if (drawnLayersRef.current) {
            drawnLayersRef.current.addLayer(polygon);
          }

          // Calculate bounds and notify parent
          const bounds = polygon.getBounds();
          const coordinates = polygonPoints.current.map(p => ({ lat: p.lat, lng: p.lng }));
          const description = `Area: ${polygonPoints.current.length} points - Bounds: ${bounds.getSouth().toFixed(4)},${bounds.getWest().toFixed(4)} to ${bounds.getNorth().toFixed(4)},${bounds.getEast().toFixed(4)}`;

          if (onAreaDrawn) {
            onAreaDrawn(coordinates, description);
          }
        }
        drawingModeRef.current = null;
        polygonPoints.current = [];
        tempMarkers.current = [];
      },
      drawRectangle: () => {
        const center = map.getCenter();
        const bounds = map.getBounds();
        const latDiff = (bounds.getNorth() - bounds.getSouth()) * 0.1;
        const lngDiff = (bounds.getEast() - bounds.getWest()) * 0.1;

        const rectangleBounds: [number, number][] = [
          [center.lat - latDiff, center.lng - lngDiff],
          [center.lat + latDiff, center.lng + lngDiff]
        ];

        const rectangle = L.rectangle(rectangleBounds, {
          color: '#21A68D',
          fillColor: '#21A68D',
          fillOpacity: 0.2,
          weight: 2
        });
        if (drawnLayersRef.current) {
          drawnLayersRef.current.addLayer(rectangle);
        }

        // Notify parent
        const rectBounds = rectangle.getBounds();
        const coordinates = [
          { lat: rectBounds.getSouth(), lng: rectBounds.getWest() },
          { lat: rectBounds.getNorth(), lng: rectBounds.getWest() },
          { lat: rectBounds.getNorth(), lng: rectBounds.getEast() },
          { lat: rectBounds.getSouth(), lng: rectBounds.getEast() }
        ];
        const description = `Rectangle Area - Bounds: ${rectBounds.getSouth().toFixed(4)},${rectBounds.getWest().toFixed(4)} to ${rectBounds.getNorth().toFixed(4)},${rectBounds.getEast().toFixed(4)}`;

        if (onAreaDrawn) {
          onAreaDrawn(coordinates, description);
        }
      },
      clear: () => {
        if (drawnLayersRef.current) {
          drawnLayersRef.current.clearLayers();
        }
        tempMarkers.current.forEach(m => map.removeLayer(m));
        if (tempPolyline.current) map.removeLayer(tempPolyline.current);
        tempMarkers.current = [];
        polygonPoints.current = [];
        drawingModeRef.current = null;
      }
    };

    return () => {
      map.off('click', handleMapClick);
      delete (window as any).leafletDrawMap;
    };
  }, [onAreaDrawn, isMapReady]);

  // Add AIS markers
  useEffect(() => {
    if (!mapRef.current || !aisMarkers || !showAIS) return;

    const map = mapRef.current;

    // Clear existing AIS markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.icon && (layer.options.icon as any).options?.className?.includes('ais-icon')) {
        map.removeLayer(layer);
      }
    });

    // Add new AIS markers
    aisMarkers.forEach(marker => {
      const icon = L.divIcon({
        className: 'ais-icon',
        html: `<div style="background-color: #21A68D; color: white; border-radius: 50%; width: 10px; height: 10px; display: flex; align-items: center; justify-content: center; font-size: 8px;">${marker.speed.toFixed(1)}</div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      const aisMarker = L.marker(marker.position, { icon }).addTo(map);
      aisMarker.bindPopup(`<b>${marker.name}</b><br>Type: ${marker.type}<br>Speed: ${marker.speed.toFixed(1)} knots`);
    });
  }, [aisMarkers, showAIS, isMapReady]);

  // Add ADSB markers
  useEffect(() => {
    if (!mapRef.current || !adsbMarkers || !showADSB) return;

    const map = mapRef.current;

    // Clear existing ADSB markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer.options.icon && (layer.options.icon as any).options?.className?.includes('adsb-icon')) {
        map.removeLayer(layer);
      }
    });

    // Add new ADSB markers
    adsbMarkers.forEach(marker => {
      const icon = L.divIcon({
        className: 'adsb-icon',
        html: `<div style="background-color: #21A68D; color: white; border-radius: 50%; width: 10px; height: 10px; display: flex; align-items: center; justify-content: center; font-size: 8px;">${marker.speed.toFixed(1)}</div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      const adsbMarker = L.marker(marker.position, { icon }).addTo(map);
      adsbMarker.bindPopup(`<b>${marker.name}</b><br>Altitude: ${marker.altitude.toFixed(0)} ft<br>Speed: ${marker.speed.toFixed(1)} knots<br>Heading: ${marker.heading.toFixed(0)}°`);
    });
  }, [adsbMarkers, showADSB, isMapReady]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={{ height, width: '100%' }}
      />
      <style>{`
        .map-tiles {
          filter: brightness(0.6) contrast(1.2) saturate(0.8);
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

        .ais-icon {
          border-radius: 50%;
          width: 10px;
          height: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: white;
          background-color: #21A68D;
        }

        .adsb-icon {
          border-radius: 50%;
          width: 10px;
          height: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: white;
          background-color: #21A68D;
        }
      `}</style>
    </>
  );
}
