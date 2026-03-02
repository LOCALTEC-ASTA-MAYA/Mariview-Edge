import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface DroneMarker {
  id: string;
  position: [number, number];
  name: string;
  status: 'active' | 'warning' | 'critical';
  color: string;
}

interface AISMarker {
  id: string;
  name: string;
  position: [number, number];
  type: string;
  speed: number;
  heading?: number;
  course?: number;
  status?: string;
}

interface ADSBMarker {
  id: string;
  name: string;
  callsign?: string;
  position: [number, number];
  altitude: number;
  speed: number;
  heading?: number;
}

interface ENCMarker {
  id: string;
  type: string;
  subType?: string;
  name: string;
  position: [number, number];
  color: string;
  description: string;
  lightCharacter?: string;
}

interface Geofence {
  id: string;
  bounds: [[number, number], [number, number]];
  color: string;
  name: string;
  dashed?: boolean;
}

interface WeatherMarker {
  id: string;
  position: [number, number];
  type: string;
  value: string;
  unit: string;
  temp: number;
  description: string;
}

interface AnomalyMarker {
  id: string;
  position: [number, number];
  type: string;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  drones?: DroneMarker[];
  aisMarkers?: AISMarker[];
  adsbMarkers?: ADSBMarker[];
  encMarkers?: ENCMarker[];
  anomalies?: AnomalyMarker[];
  weatherMarkers?: WeatherMarker[];
  geofences?: Geofence[];
  showENC?: boolean;
  showAIS?: boolean;
  showADSB?: boolean;
  showWeather?: boolean;
  className?: string;
  onDroneClick?: (droneId: string) => void;
  mapView?: 'kupang' | 'indonesia';
  onMapViewChange?: (view: 'kupang' | 'indonesia') => void;
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
        ctx.strokeStyle = '#21A68D';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.15;

        for (let x = 0; x <= tileSize.x; x += tileSize.x / 8) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, tileSize.y);
          ctx.stroke();
        }

        for (let y = 0; y <= tileSize.y; y += tileSize.y / 8) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(tileSize.x, y);
          ctx.stroke();
        }

        ctx.strokeStyle = '#21A68D';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.25;
        ctx.strokeRect(0, 0, tileSize.x, tileSize.y);
      }

      return tile;
    }
  });
};

export default function LeafletMap({
  center = [-6.5625, 106.8942],
  zoom = 13,
  height = '100%',
  drones = [],
  aisMarkers = [],
  adsbMarkers = [],
  encMarkers = [],
  anomalies = [],
  geofences = [],
  showENC = false,
  showAIS = false,
  showADSB = false,
  showWeather = false,
  weatherMarkers = [],
  className = '',
  onDroneClick,
  mapView = 'indonesia',
  onMapViewChange
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const areasRef = useRef<L.Rectangle[]>([]);
  const encLayerRef = useRef<L.TileLayer | null>(null);
  const weatherLayerRef = useRef<L.TileLayer | null>(null);

  const isManualViewRef = useRef(false);
  const lastMapViewRef = useRef(mapView);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView(center, zoom);

      // Listen for manual movement
      mapRef.current.on('movestart', (e) => {
        // If it was triggered by user (not by code), set manual mode
        // Note: Leaflet fires movestart for setView too, so we need a way to distinguish
        // But usually checking if it's currently animating via code works
      });

      // Simpler approach: if user drags or zooms, set manual mode
      mapRef.current.on('dragstart zoomstart', () => {
        isManualViewRef.current = true;
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20,
        className: 'map-tiles',
      }).addTo(mapRef.current);

      const GridLayerClass = createGridLayer();
      const gridLayer = new (GridLayerClass as any)({
        opacity: 0.3,
        zIndex: 400
      });
      gridLayer.addTo(mapRef.current);

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

  useEffect(() => {
    if (!mapRef.current) return;

    // If mapView mode changed (e.g. from 'indonesia' to 'kupang'), force center and resume auto-center
    if (mapView !== lastMapViewRef.current) {
      isManualViewRef.current = false;
      lastMapViewRef.current = mapView;
      mapRef.current.setView(center, zoom, { animate: true, duration: 1.5 });
      return;
    }

    // Only auto-center if the user hasn't taken manual control
    if (!isManualViewRef.current) {
      mapRef.current.setView(center, zoom, { animate: true, duration: 1 });
    }
  }, [center, zoom, mapView]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (showENC) {
      if (!encLayerRef.current) {
        encLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          opacity: 0.8,
          zIndex: 500
        }).addTo(mapRef.current);
      }
    } else {
      if (encLayerRef.current) {
        mapRef.current.removeLayer(encLayerRef.current);
        encLayerRef.current = null;
      }
    }
  }, [showENC]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (showWeather) {
      if (!weatherLayerRef.current) {
        // Temperature layer overlay (using OpenWeatherMap public tiles if possible, or generic dark overlay)
        weatherLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          opacity: 0.15,
          className: 'weather-overlay-layer',
          zIndex: 450
        }).addTo(mapRef.current);

        // Add a CSS filter to the layer to make it look "stormy" or "atmospheric"
        if (!document.getElementById('weather-filter-style')) {
          const style = document.createElement('style');
          style.id = 'weather-filter-style';
          style.innerHTML = `
            .weather-overlay-layer {
              filter: hue-rotate(180deg) saturate(2) brightness(0.8) !important;
            }
          `;
          document.head.appendChild(style);
        }
      }
    } else {
      if (weatherLayerRef.current) {
        mapRef.current.removeLayer(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
    }
  }, [showWeather]);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    areasRef.current.forEach(a => a.remove());
    areasRef.current = [];

    // Drones
    drones.forEach(drone => {
      const icon = L.divIcon({
        className: 'custom-drone-marker',
        html: `
            <div class="drone-marker-container" style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
              <div class="drone-pulse" style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(33, 166, 141, 0.15); animation: pulse-ring 2s infinite;"></div>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 10;">
                <!-- Arms -->
                <path d="M6 6l12 12M18 6L6 18" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round"/>
                <!-- Rotors/Motors -->
                <circle cx="5" cy="5" r="3.2" fill="#1e293b" stroke="white" stroke-width="1.2"/>
                <circle cx="19" cy="5" r="3.2" fill="#1e293b" stroke="white" stroke-width="1.2"/>
                <circle cx="5" cy="19" r="3.2" fill="#1e293b" stroke="white" stroke-width="1.2"/>
                <circle cx="19" cy="19" r="3.2" fill="#1e293b" stroke="white" stroke-width="1.2"/>
                <!-- Body -->
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#1e293b" stroke="white" stroke-width="1.5"/>
                <!-- Camera/Sensor -->
                <circle cx="12" cy="12" r="1.2" fill="#22c55e"/>
                <!-- Heading Indicator -->
                <path d="M12 7l1.5 2h-3L12 7z" fill="#21A68D"/>
              </svg>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker(drone.position, { icon }).addTo(mapRef.current!).bindPopup(`<b>${drone.name}</b>`);
      markersRef.current.push(marker);
    });

    // AIS
    if (showAIS) {
      aisMarkers.forEach(ais => {
        // Marine Traffic Color Scheme
        let color = '#9ca3af'; // Default Grey (Unknown)
        const type = ais.type.toLowerCase();

        if (type.includes('cargo') || type.includes('container') || type.includes('bulk')) {
          color = '#22c55e'; // Green
        } else if (type.includes('tanker')) {
          color = '#ef4444'; // Red
        } else if (type.includes('passenger') || type.includes('ferry')) {
          color = '#3b82f6'; // Blue
        } else if (type.includes('fishing')) {
          color = '#f97316'; // Orange
        } else if (type.includes('tug') || type.includes('pilot')) {
          color = '#06b6d4'; // Cyan
        } else if (type.includes('yacht') || type.includes('sailing')) {
          color = '#d946ef'; // Magenta
        } else if (type.includes('military') || type.includes('law')) {
          color = '#111827'; // Black
        }

        const heading = ais.heading || ais.course || 0;

        const icon = L.divIcon({
          className: 'custom-ais-marker',
          html: `
            <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
                <path d="M12 2L4 22L12 18L20 22L12 2Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker(ais.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-weight: 600; color: ${color}; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:8px; height:8px; background:${color}; border-radius:50%;"></span>
              ${ais.name}
            </div>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 11px; color: #4b5563;">
              <span>Type:</span> <span style="font-weight: 500;">${ais.type}</span>
              <span>Speed:</span> <span style="font-weight: 500;">${ais.speed} kn</span>
              <span>Heading:</span> <span style="font-weight: 500;">${heading}°</span>
              <span>Status:</span> <span style="font-weight: 500;">${ais.status || 'N/A'}</span>
            </div>
          </div>
        `);
        markersRef.current.push(marker);
      });
    }

    // ADSB
    if (showADSB) {
      adsbMarkers.forEach(adsb => {
        // FlightRadar24 gold/yellow style for aircraft
        const planeColor = '#facc15'; // Yellow-400
        const heading = adsb.heading || 0;

        const icon = L.divIcon({
          className: 'custom-adsb-marker',
          html: `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(${heading}deg); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="${planeColor}" stroke="#1e293b" stroke-width="1" stroke-linejoin="round"/>
              </svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker(adsb.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-weight: 600; color: #b45309; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 14px;">✈️</span>
              ${adsb.callsign || adsb.name}
            </div>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 11px; color: #4b5563;">
              <span>Flight:</span> <span style="font-weight: 500;">${adsb.name}</span>
              <span>Altitude:</span> <span style="font-weight: 500;">${adsb.altitude.toLocaleString()} ft</span>
              <span>Speed:</span> <span style="font-weight: 500;">${adsb.speed} kn</span>
              <span>Heading:</span> <span style="font-weight: 500;">${heading}°</span>
            </div>
          </div>
        `);
        markersRef.current.push(marker);
      });
    }

    // ENC
    if (showENC) {
      encMarkers.forEach(enc => {
        const colorMap: Record<string, string> = {
          'red': '#ef4444',
          'green': '#22c55e',
          'yellow': '#fde047',
          'white': '#ffffff',
          'blue': '#3b82f6',
          'magenta': '#d946ef',
        };
        const markerColor = colorMap[enc.color] || enc.color;

        // Advanced Nautical Symbols (S-57/S-52 inspired)
        let iconHtml = '';
        let labelHtml = '';

        if (enc.type === 'depth') {
          // Depth soundings (Blue-gray numbers)
          iconHtml = `<text x="12" y="16" text-anchor="middle" fill="#64748b" font-size="12" font-weight="600" style="font-family: monospace;">${enc.name}</text>`;
        } else if (enc.type === 'rock') {
          // Rock/Hazard star symbol
          iconHtml = `
            <path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#1e293b" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="2" fill="#1e293b"/>
          `;
          labelHtml = `<div style="position: absolute; top: 12px; left: 16px; font-size: 9px; color: #1e293b; font-weight: 500; white-space: nowrap;">rock</div>`;
        } else if (enc.type === 'buoy') {
          // Conical/Pillar Buoy
          iconHtml = `
            <path d="M12 4L17 18H7L12 4Z" fill="${markerColor}" fill-opacity="0.4" stroke="${markerColor}" stroke-width="2"/>
            <path d="M12 4v14" stroke="${markerColor}" stroke-width="1" stroke-dasharray="2,1"/>
            <circle cx="12" cy="18" r="2" fill="${markerColor}"/>
          `;
          // Light Flare (if lightCharacter exists)
          if (enc.lightCharacter) {
            iconHtml += `<path d="M12 4c4 0 7 3 7 7" stroke="#d946ef" stroke-width="2" fill="none" opacity="0.6"/>`;
          }
        } else if (enc.type === 'beacon') {
          // Beacon Tower
          iconHtml = `
            <rect x="10" y="6" width="4" height="14" fill="#1e293b" fill-opacity="0.3" stroke="#1e293b" stroke-width="1.5"/>
            <path d="M8 20h8" stroke="#1e293b" stroke-width="2"/>
            <rect x="9" y="4" width="6" height="2" fill="#1e293b"/>
          `;
        } else if (enc.type === 'special') {
          // Magenta circles with X (like restricted areas in the reference)
          iconHtml = `
            <circle cx="12" cy="12" r="8" stroke="#d946ef" stroke-width="2" fill="none" stroke-dasharray="3,2"/>
            <path d="M8 8l8 8M16 8l-8 8" stroke="#d946ef" stroke-width="2"/>
          `;
        } else {
          iconHtml = `<circle cx="12" cy="12" r="5" fill="${markerColor}" stroke="white" stroke-width="1.5"/>`;
        }

        const icon = L.divIcon({
          className: 'custom-enc-marker',
          html: `
            <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                ${iconHtml}
              </svg>
              ${labelHtml}
              ${enc.lightCharacter ? `<div style="position: absolute; top: -14px; left: 14px; font-size: 8px; color: #d946ef; font-weight: bold; white-space: nowrap;">${enc.lightCharacter}</div>` : ''}
              ${enc.type === 'buoy' || enc.type === 'beacon' ? `<div style="position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); font-size: 8px; color: #64748b; white-space: nowrap;">${enc.name}</div>` : ''}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker(enc.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: inherit; p: 4px;">
            <div style="font-weight: 600; color: #334155; margin-bottom: 2px;">${enc.name}</div>
            <div style="font-size: 11px; color: #64748b;">${enc.type.toUpperCase()} - ${enc.description}</div>
            ${enc.lightCharacter ? `<div style="font-size: 10px; color: #d946ef; font-weight: 600;">Light: ${enc.lightCharacter}</div>` : ''}
          </div>
        `);
        markersRef.current.push(marker);
      });
    }

    // Anomalies
    anomalies.forEach(anomaly => {
      const icon = L.divIcon({
        className: 'custom-anomaly-marker',
        html: `<div style="width:24px; height:24px; background:#ef4444; border:2px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:14px;">!</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker(anomaly.position, { icon }).addTo(mapRef.current!).bindPopup(`<b>Anomaly</b>`);
      markersRef.current.push(marker);
    });

    // Geofences
    geofences.forEach(gf => {
      const rect = L.rectangle(gf.bounds, {
        color: gf.color,
        weight: 2,
        fillOpacity: 0.05,
        dashArray: gf.dashed ? '8, 8' : undefined,
      }).addTo(mapRef.current!);
      areasRef.current.push(rect);
    });

    // Weather Markers
    if (showWeather && weatherMarkers) {
      weatherMarkers.forEach(w => {
        let iconHtml = '';
        const color = '#3b82f6';

        if (w.type === 'rain') {
          iconHtml = `
            <path d="M18 13.5v.5M15 15.5v.5M12 17.5v.5M9 15.5v.5M6 13.5v.5" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
            <path d="M20 16.5A5.5 5.5 0 0 0 16.22 7a7 7 0 1 0-11.72 6.5" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          `;
        } else if (w.type === 'wind') {
          iconHtml = `
            <path d="M17.7 7.7A2.5 2.5 0 1 1 15.8 12H3M21 15.3A2.5 2.5 0 1 1 18.8 19H5M12 5h1M8 5h1" stroke="#21A68D" stroke-width="2" stroke-linecap="round"/>
          `;
        } else if (w.type === 'cloud') {
          iconHtml = `
            <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8a7 7 0 1 0-11.23 7.6" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          `;
        } else if (w.type === 'wave') {
          iconHtml = `
            <path d="M2 13.5c4-5 6-5 10 0s6 5 10 0M2 17.5c4-5 6-5 10 0s6 5 10 0" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round"/>
          `;
        } else if (w.type === 'storm') {
          iconHtml = `
            <path d="M11 13l-4 7h6l-4 7M20 16.5A5.5 5.5 0 0 0 16.22 7a7 7 0 1 0-11.72 6.5" stroke="#fde047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          `;
        }

        const icon = L.divIcon({
          className: 'custom-weather-marker',
          html: `
            <div style="position: relative; width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="background: white; border-radius: 50%; padding: 4px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  ${iconHtml}
                </svg>
              </div>
              <div style="position: absolute; bottom: -18px; background: rgba(15, 76, 117, 0.9); color: white; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap; border: 1px solid rgba(33, 166, 141, 0.5);">
                ${w.temp}°C | ${w.value}${w.unit}
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker(w.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: inherit; p: 4px;">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 2px;">Weather: ${w.description}</div>
            <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 8px; font-size: 11px;">
              <div><span style="color: #64748b;">Temp:</span> ${w.temp}°C</div>
              <div><span style="color: #64748b;">Intensity:</span> ${w.value} ${w.unit}</div>
            </div>
          </div>
        `);
        markersRef.current.push(marker);
      });
    }

  }, [drones, aisMarkers, adsbMarkers, encMarkers, anomalies, geofences, showAIS, showADSB, showENC, showWeather, weatherMarkers]);

  return (
    <>
      <div ref={containerRef} className={className} style={{ height, width: '100%' }} />
      <style>{`
        .leaflet-container { background: #1a1f2e !important; }
        .map-tiles { filter: brightness(0.6) contrast(1.2) saturate(0.8); }
        .leaflet-popup-content-wrapper { background: white; color: #1a1f2e; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); }
        .leaflet-popup-tip { background: white; }
        
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}</style>
    </>
  );
}
