import { useEffect, useRef, useCallback } from 'react';
// @ts-ignore
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapMarker {
    id: string;
    position: [number, number]; // [lat, lng]
    type: 'drone' | 'ais' | 'adsb' | 'anomaly' | 'enc' | 'weather';
    label: string;
    color: string;
    heading?: number;
    subType?: string;
    meta?: Record<string, any>;
}

export interface Geofence {
    id: string;
    name: string;
    bounds: [[number, number], [number, number]]; // [[lat, lng], [lat, lng]]
    color: string;
    dashed?: boolean;
}

interface DigitalTwinMapProps {
    is3D: boolean;
    markers?: MapMarker[];
    geofences?: Geofence[];
    onMarkerClick?: (id: string) => void;
    center?: [number, number];
    zoom?: number;
    mapView?: 'kupang' | 'indonesia';
}

const MAP_CONFIGS = {
    kupang: { center: [123.53838, -10.20073] as [number, number], zoom: 13 },
    indonesia: { center: [118.0, -2.5] as [number, number], zoom: 5 },
};

export default function DigitalTwinMap({
    is3D,
    markers = [],
    geofences = [],
    onMarkerClick,
    mapView = 'kupang',
}: DigitalTwinMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const prevMapView = useRef(mapView);

    // Initialize Map
    useEffect(() => {
        if (!containerRef.current || map.current) return;

        const config = MAP_CONFIGS[mapView];

        map.current = new maplibregl.Map({
            container: containerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: config.center,
            zoom: config.zoom,
            pitch: is3D ? 55 : 0,
            bearing: is3D ? -15 : 0,
            maxPitch: 70,
        });

        map.current.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');

        // Add 3D buildings and terrain on style load
        map.current.on('load', () => {
            if (!map.current) return;

            // Add Terrain Source (Amazon Terrarium DEM)
            map.current.addSource('terrainSource', {
                type: 'raster-dem',
                tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                encoding: 'terrarium',
                tileSize: 256,
                maxzoom: 14
            });

            // Enable Terrain with exaggeration
            map.current.setTerrain({ source: 'terrainSource', exaggeration: 1.5 });

            // Note: 'sky' layer type is Mapbox-only, not supported by MapLibre — omitted.

            const style = map.current.getStyle();
            if (style && style.layers) {
                const labelLayer = style.layers.find(
                    (l: any) => l.type === 'symbol' && l.layout && l.layout['text-field']
                );
                const beforeId = labelLayer?.id;

                try {
                    // Detect the correct source from the style (Carto uses 'carto', others use 'openmaptiles')
                    const style = map.current.getStyle();
                    const sources = style?.sources || {};
                    const sourceName = Object.keys(sources).find(s =>
                        s.toLowerCase().includes('openmaptiles') ||
                        s === 'carto'
                    ) || 'openmaptiles';

                    map.current.addLayer(
                        {
                            id: '3d-buildings',
                            source: sourceName,
                            'source-layer': 'building',
                            type: 'fill-extrusion',
                            minzoom: 13, // Show buildings earlier
                            paint: {
                                'fill-extrusion-color': [
                                    'interpolate',
                                    ['linear'],
                                    ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
                                    0, '#2b313d',
                                    30, '#21A68D',
                                    80, '#D4E268'
                                ],
                                'fill-extrusion-height': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    13, 0,
                                    16, ['coalesce', ['get', 'render_height'], ['get', 'height'], 10]
                                ],
                                'fill-extrusion-base': [
                                    'interpolate',
                                    ['linear'],
                                    ['zoom'],
                                    13, 0,
                                    16, ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0]
                                ],
                                'fill-extrusion-opacity': 0.85,
                            },
                        } as any,
                        beforeId
                    );
                } catch (e) {
                    console.warn('3D buildings layer could not be added:', e);
                }
            }
        });

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Handle 3D toggle
    useEffect(() => {
        if (!map.current) return;
        map.current.easeTo({
            pitch: is3D ? 55 : 0,
            bearing: is3D ? -15 : 0,
            duration: 1500,
        });
    }, [is3D]);

    // Handle map view changes
    useEffect(() => {
        if (!map.current) return;
        if (mapView !== prevMapView.current) {
            prevMapView.current = mapView;
            const config = MAP_CONFIGS[mapView];
            map.current.flyTo({
                center: config.center,
                zoom: config.zoom,
                duration: 2000,
            });
        }
    }, [mapView]);

    // Render markers
    useEffect(() => {
        if (!map.current) return;

        // Clear old markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        markers.forEach(marker => {
            const el = document.createElement('div');
            el.className = 'digital-twin-marker group';
            el.style.cursor = 'pointer';

            let iconSvg = '';
            let size = 28;
            const color = marker.color;

            if (marker.type === 'drone') {
                size = 40;
                iconSvg = `
          <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
            <div class="twin-marker-pulse" style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:rgba(34,197,94,0.2);"></div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="position:relative;z-index:10;">
              <path d="M6 6l12 12M18 6L6 18" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
              <circle cx="5" cy="5" r="3" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
              <circle cx="19" cy="5" r="3" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
              <circle cx="5" cy="19" r="3" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
              <circle cx="19" cy="19" r="3" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#0f172a" stroke="#22c55e" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="1.2" fill="#22c55e"/>
            </svg>
          </div>
        `;
            } else if (marker.type === 'ais') {
                const heading = marker.heading || 0;
                size = 24;
                iconSvg = `
          <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="transform:rotate(${heading}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));">
              <path d="M12 2L4 22L12 18L20 22L12 2Z" fill="${color}" stroke="rgba(255,255,255,0.6)" stroke-width="1" stroke-linejoin="round"/>
            </svg>
          </div>
        `;
            } else if (marker.type === 'adsb') {
                const heading = marker.heading || 0;
                size = 28;
                iconSvg = `
          <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="transform:rotate(${heading}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#facc15" stroke="#1e293b" stroke-width="0.8" stroke-linejoin="round"/>
            </svg>
          </div>
        `;
            } else if (marker.type === 'anomaly') {
                size = 24;
                iconSvg = `
          <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
            <div class="twin-marker-pulse" style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:rgba(239,68,68,0.25);"></div>
            <div style="width:20px;height:20px;background:#ef4444;border:2px solid rgba(255,255,255,0.8);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;position:relative;z-index:10;">!</div>
          </div>
        `;
            } else if (marker.type === 'weather') {
                size = 36;
                iconSvg = `
          <div style="position:relative;width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(59,130,246,0.4);border-radius:50%;padding:6px;backdrop-filter:blur(4px);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8a7 7 0 1 0-11.23 7.6" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            ${marker.meta?.temp ? `<div style="position:absolute;bottom:-14px;background:rgba(15,23,42,0.85);color:#93c5fd;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:bold;white-space:nowrap;border:1px solid rgba(59,130,246,0.3);">${marker.meta.temp}°C</div>` : ''}
          </div>
        `;
            } else {
                iconSvg = `
          <div style="width:12px;height:12px;background:${color};border:2px solid rgba(255,255,255,0.6);border-radius:50%;box-shadow:0 0 6px ${color};"></div>
        `;
            }

            el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          ${iconSvg}
          <div class="twin-marker-label" style="margin-top:2px;background:rgba(0,0,0,0.75);color:white;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;white-space:nowrap;opacity:0;transition:opacity 0.2s;pointer-events:none;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);">
            ${marker.label}
          </div>
        </div>
      `;

            // Show label on hover
            el.addEventListener('mouseenter', () => {
                const label = el.querySelector('.twin-marker-label') as HTMLElement;
                if (label) label.style.opacity = '1';
            });
            el.addEventListener('mouseleave', () => {
                const label = el.querySelector('.twin-marker-label') as HTMLElement;
                if (label) label.style.opacity = '0';
            });

            if (onMarkerClick) {
                el.addEventListener('click', () => onMarkerClick(marker.id));
            }

            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([marker.position[1], marker.position[0]]) // Convert [lat, lng] to [lng, lat]
                .addTo(map.current!);
            markersRef.current.push(m);
        });
    }, [markers, onMarkerClick]);

    // Render geofences (AOIs)
    useEffect(() => {
        const m = map.current;
        if (!m) return;

        const addGf = (gf: any) => {
            if (!m || !m.getStyle()) return;
            const sourceId = `source-${gf.id}`;
            const fillLayerId = `fill-${gf.id}`;
            const lineLayerId = `line-${gf.id}`;

            const [[lat1, lng1], [lat2, lng2]] = gf.bounds;
            const coords = [[lng1, lat1], [lng2, lat1], [lng2, lat2], [lng1, lat2], [lng1, lat1]];

            if (!m.getSource(sourceId)) {
                m.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: { name: gf.name },
                        geometry: { type: 'Polygon', coordinates: [coords] } as any
                    }
                });

                m.addLayer({
                    id: fillLayerId,
                    type: 'fill',
                    source: sourceId,
                    paint: { 'fill-color': gf.color, 'fill-opacity': 0.1 }
                });

                m.addLayer({
                    id: lineLayerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': gf.color,
                        'line-width': 2,
                        'line-dasharray': gf.dashed ? [2, 1] : [1, 0]
                    }
                });
            }
        };

        // Create Geofences
        geofences?.forEach(gf => {
            if (m.loaded()) {
                addGf(gf);
            } else {
                m.on('load', () => addGf(gf));
            }
        });

        return () => {
            if (m && m.getStyle()) {
                try {
                    geofences.forEach(gf => {
                        const fillLayerId = `fill-${gf.id}`;
                        const lineLayerId = `line-${gf.id}`;
                        const sourceId = `source-${gf.id}`;

                        // Additional safety check for each layer check
                        if (typeof m.getLayer === 'function' && m.getLayer(fillLayerId)) m.removeLayer(fillLayerId);
                        if (typeof m.getLayer === 'function' && m.getLayer(lineLayerId)) m.removeLayer(lineLayerId);
                        if (typeof m.getSource === 'function' && m.getSource(sourceId)) m.removeSource(sourceId);
                    });
                } catch (e) {
                    console.warn('Map cleanup warning:', e);
                }
            }
        };
    }, [geofences]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    );
}
