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

interface Geofence {
    id: string;
    bounds: [[number, number], [number, number]];
    color: string;
    name: string;
    dashed?: boolean;
}

interface AnomalyMarker {
    id: string;
    position: [number, number];
    type: string;
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

interface MissionMapProps {
    center?: [number, number];
    zoom?: number;
    drones?: DroneMarker[];
    aisMarkers?: AISMarker[];
    adsbMarkers?: ADSBMarker[];
    encMarkers?: ENCMarker[];
    geofences?: Geofence[];
    anomalies?: AnomalyMarker[];
    showAIS?: boolean;
    showADSB?: boolean;
    showENC?: boolean;
    className?: string;
    onDroneClick?: (droneId: string) => void;
}

export default function MissionMap({
    center = [-10.1735, 123.5250],
    zoom = 14,
    drones = [],
    aisMarkers = [],
    adsbMarkers = [],
    encMarkers = [],
    geofences = [],
    anomalies = [],
    showAIS = true,
    showADSB = true,
    showENC = false,
    className = '',
    onDroneClick,
}: MissionMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const areasRef = useRef<L.Path[]>([]);
    const encLayerRef = useRef<L.TileLayer | null>(null);
    const hasUserInteracted = useRef(false);
    const prevCenterRef = useRef<string>(JSON.stringify(center));
    const prevZoomRef = useRef<number>(zoom);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        mapRef.current = L.map(containerRef.current, {
            zoomControl: false,
            attributionControl: true,
        }).setView(center, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20,
            className: 'map-tiles',
        }).addTo(mapRef.current);

        // Subtle grid
        const GridLayer = L.GridLayer.extend({
            createTile: function (coords: any) {
                const tile = document.createElement('canvas');
                const ctx = tile.getContext('2d');
                const tileSize = this.getTileSize();
                tile.width = tileSize.x;
                tile.height = tileSize.y;
                if (ctx) {
                    ctx.strokeStyle = '#21A68D';
                    ctx.lineWidth = 0.5;
                    ctx.globalAlpha = 0.1;
                    ctx.strokeRect(0, 0, tileSize.x, tileSize.y);
                }
                return tile;
            }
        });
        new (GridLayer as any)({ zIndex: 400 }).addTo(mapRef.current);

        L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

        // Track user interaction — stop auto-centering once the user pans/zooms
        mapRef.current.on('dragstart', () => { hasUserInteracted.current = true; });
        mapRef.current.on('zoomstart', () => { hasUserInteracted.current = true; });

        // Handle window resize and container resize
        const resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
                mapRef.current.invalidateSize();
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Update view ONLY when center/zoom ACTUALLY change (e.g. Kupang ↔ Indonesia toggle)
    // Skip if values are identical (telemetry re-renders) or user has manually panned/zoomed
    useEffect(() => {
        if (!mapRef.current) return;
        const centerStr = JSON.stringify(center);
        const centerChanged = centerStr !== prevCenterRef.current;
        const zoomChanged = zoom !== prevZoomRef.current;

        if (centerChanged || zoomChanged) {
            // This is a real, intentional view change — apply it
            prevCenterRef.current = centerStr;
            prevZoomRef.current = zoom;
            hasUserInteracted.current = false; // Reset interaction flag
            mapRef.current.setView(center, zoom, { animate: true });
        }
    }, [center, zoom]);

    // Handle ENC Layer
    useEffect(() => {
        if (!mapRef.current) return;
        if (showENC) {
            if (!encLayerRef.current) {
                encLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
                    opacity: 0.8,
                    zIndex: 500
                }).addTo(mapRef.current);
            }
        } else if (encLayerRef.current) {
            mapRef.current.removeLayer(encLayerRef.current);
            encLayerRef.current = null;
        }
    }, [showENC]);

    // Render Markers
    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing markers/areas
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        areasRef.current.forEach(a => a.remove());
        areasRef.current = [];

        // 1. Drones
        drones.forEach(drone => {
            const icon = L.divIcon({
                className: 'custom-drone-marker',
                html: `
            <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
              <div class="drone-pulse" style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(33, 166, 141, 0.2); animation: pulse-ring 2s infinite;"></div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="position: relative; z-index: 10;">
                <path d="M6 6l12 12M18 6L6 18" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
                <circle cx="5" cy="5" r="3" fill="#1e293b" stroke="white" stroke-width="1"/>
                <circle cx="19" cy="5" r="3" fill="#1e293b" stroke="white" stroke-width="1"/>
                <circle cx="5" cy="19" r="3" fill="#1e293b" stroke="white" stroke-width="1"/>
                <circle cx="19" cy="19" r="3" fill="#1e293b" stroke="white" stroke-width="1"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="#1e293b" stroke="white" stroke-width="1"/>
                <circle cx="12" cy="12" r="1.5" fill="#22c55e"/>
              </svg>
            </div>
        `,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
            });
            const marker = L.marker(drone.position, { icon })
                .addTo(mapRef.current!)
                .on('click', () => onDroneClick?.(drone.id))
                .bindPopup(`<b>${drone.name}</b><br/>Status: ${drone.status}`);
            markersRef.current.push(marker);
        });

        // 2. AIS (Premium Style)
        if (showAIS) {
            aisMarkers.forEach(ais => {
                let color = '#9ca3af';
                const type = (ais.type || '').toLowerCase();
                if (type.includes('cargo') || type.includes('container')) color = '#22c55e';
                else if (type.includes('tanker')) color = '#ef4444';
                else if (type.includes('passenger') || type.includes('ferry')) color = '#3b82f6';
                else if (type.includes('fishing')) color = '#f97316';
                else if (type.includes('tug') || type.includes('pilot')) color = '#06b6d4';
                else if (type.includes('yacht') || type.includes('sailing')) color = '#d946ef';
                else if (type.includes('military')) color = '#111827';

                const heading = ais.heading || ais.course || 0;
                const icon = L.divIcon({
                    className: 'custom-ais-marker',
                    html: `
            <div style="transform: rotate(${heading}deg); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 22L12 18L20 22L12 2Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
          `,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });
                const marker = L.marker(ais.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: bold; color: ${color};">${ais.name}</div>
            <div style="font-size: 11px; margin-top: 2px;">
              ${ais.type} | ${ais.speed} kn
            </div>
          </div>
        `);
                markersRef.current.push(marker);
            });
        }

        // 3. ADSB (Premium Style)
        if (showADSB) {
            adsbMarkers.forEach(adsb => {
                const heading = adsb.heading || 0;
                const icon = L.divIcon({
                    className: 'custom-adsb-marker',
                    html: `
            <div style="transform: rotate(${heading}deg); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#facc15" stroke="#1e293b" stroke-width="1" stroke-linejoin="round"/>
              </svg>
            </div>
          `,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                });
                const marker = L.marker(adsb.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: bold; color: #b45309;">${adsb.callsign || adsb.name}</div>
            <div style="font-size: 11px; margin-top: 2px;">
              Alt: ${adsb.altitude.toLocaleString()}ft | ${adsb.speed}kn
            </div>
          </div>
        `);
                markersRef.current.push(marker);
            });
        }

        // 4. ENC Markers (Navigational Symbols)
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

                let iconHtml = '';
                if (enc.type === 'depth') {
                    iconHtml = `<text x="12" y="16" text-anchor="middle" fill="#64748b" font-size="12" font-weight="600" style="font-family: monospace;">${enc.name}</text>`;
                } else if (enc.type === 'rock') {
                    iconHtml = `<path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="#1e293b" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="#1e293b"/>`;
                } else if (enc.type === 'buoy') {
                    iconHtml = `<path d="M12 4L17 18H7L12 4Z" fill="${markerColor}" fill-opacity="0.4" stroke="${markerColor}" stroke-width="2"/><circle cx="12" cy="18" r="2" fill="${markerColor}"/>`;
                } else if (enc.type === 'beacon') {
                    iconHtml = `<rect x="10" y="6" width="4" height="14" fill="#1e293b" fill-opacity="0.3" stroke="#1e293b" stroke-width="1.5"/><path d="M8 20h8" stroke="#1e293b" stroke-width="2"/><rect x="9" y="4" width="6" height="2" fill="#1e293b"/>`;
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
            </div>
          `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                });
                const marker = L.marker(enc.position, { icon }).addTo(mapRef.current!).bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: bold; color: #334155;">${enc.name}</div>
            <div style="font-size: 11px; color: #64748b;">${enc.type.toUpperCase()}</div>
          </div>
        `);
                markersRef.current.push(marker);
            });
        }

        // 5. Geofences (Shapes)
        geofences.forEach(gf => {
            const rect = L.rectangle(gf.bounds, {
                color: gf.color,
                weight: 2,
                fillOpacity: 0.1,
                dashArray: gf.dashed ? '8, 8' : undefined,
            }).addTo(mapRef.current!);
            areasRef.current.push(rect);
        });

        // 5. Anomalies
        anomalies.forEach(anomaly => {
            const icon = L.divIcon({
                className: 'custom-anomaly-marker',
                html: `<div style="width:24px; height:24px; background:#ef4444; border:2px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:14px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);">!</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });
            const marker = L.marker(anomaly.position, { icon }).addTo(mapRef.current!).bindPopup(`<b>Alert: AI Anomaly Detected</b>`);
            markersRef.current.push(marker);
        });

    }, [drones, aisMarkers, adsbMarkers, encMarkers, geofences, anomalies, showAIS, showADSB, showENC]);

    return (
        <>
            <div ref={containerRef} className={className} style={{ height: '100%', width: '100%', background: '#1a1f2e' }} />
            <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        .map-tiles { filter: brightness(0.6) contrast(1.2) saturate(0.8); }
      `}</style>
        </>
    );
}