import { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Plane, Radio, Satellite, Info, Navigation, Activity } from 'lucide-react';
import LeafletMap from './LeafletMap';
import { Badge } from './ui/badge';

// Mock generator for dense flight data across Indonesia
const generateMockFlights = () => {
    const flights = [
        { id: 'adsb-focus', name: 'MAS794', callsign: 'MAS794', position: [3.5952, 98.6722] as [number, number], altitude: 34000, speed: 450, heading: 145 },
        { id: 'f2', name: 'GA234', callsign: 'GA234', position: [-6.1256, 106.6558] as [number, number], altitude: 28000, speed: 420, heading: 270 },
        { id: 'f3', name: 'QZ551', callsign: 'QZ551', position: [-7.3796, 112.7871] as [number, number], altitude: 32000, speed: 440, heading: 45 },
        { id: 'f4', name: 'ID6541', callsign: 'ID6541', position: [-8.7481, 115.1673] as [number, number], altitude: 31000, speed: 430, heading: 180 },
        { id: 'f5', name: 'SJ210', callsign: 'SJ210', position: [-5.0616, 119.5539] as [number, number], altitude: 35000, speed: 460, heading: 90 },
    ];

    // Add random flights to fill the map
    const regions = [
        { lat: [0, 5], lng: [95, 105] }, // Sumatra
        { lat: [-8, -6], lng: [105, 115] }, // Java
        { lat: [-3, 3], lng: [110, 118] }, // Kalimantan
        { lat: [-5, 1], lng: [119, 125] }, // Sulawesi
        { lat: [-9, -7], lng: [115, 130] }, // Nusa Tenggara
        { lat: [-5, 2], lng: [130, 140] }  // Papua
    ];

    for (let i = 0; i < 80; i++) {
        const region = regions[Math.floor(Math.random() * regions.length)];
        const lat = region.lat[0] + Math.random() * (region.lat[1] - region.lat[0]);
        const lng = region.lng[0] + Math.random() * (region.lng[1] - region.lng[0]);

        flights.push({
            id: `mock-${i}`,
            name: `FL${100 + i}`,
            callsign: `FL${100 + i}`,
            position: [lat, lng],
            altitude: 20000 + Math.random() * 20000,
            speed: 350 + Math.random() * 200,
            heading: Math.random() * 360
        });
    }

    return flights;
};

export default function AdsbStream() {
    const [activeFlights] = useState(generateMockFlights());

    const stats = useMemo(() => ({
        count: activeFlights.length,
        avgAlt: Math.round(activeFlights.reduce((acc, f) => acc + f.altitude, 0) / activeFlights.length),
        coverage: "Full Regional SE-Asia"
    }), [activeFlights]);

    return (
        <div className="flex flex-col h-full bg-[#0a0e1a]">
            {/* Header Info Bar */}
            <div className="p-4 md:p-6 border-b border-border/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Radio className="w-5 h-5 text-[#21A68D]" />
                        <h1 className="text-xl font-bold text-white tracking-tight uppercase">
                            ADS-B Regional Real-time Stream
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-xs font-medium">
                        Active Multi-Lateration (MLAT) monitoring across Indonesian Archipelago
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-[#21A68D]/10 text-[#21A68D] border-[#21A68D]/30 py-1">
                        <Activity className="w-3 h-3 mr-1.5 animate-pulse" />
                        RECEIVING DATA: 10.4 kb/s
                    </Badge>
                    <div className="text-[10px] text-muted-foreground text-right border-l border-border/30 pl-3">
                        Source: Ground Station ID-KPG-01<br />
                        Lat: -10.17 | Lng: 123.58
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-0 overflow-hidden">
                {/* Main Map Area */}
                <div className="xl:col-span-3 relative bg-black">
                    <LeafletMap
                        center={[-2.5489, 118.0149]}
                        zoom={5}
                        adsbMarkers={activeFlights}
                        showADSB={true}
                        className="w-full h-full"
                        mapView="indonesia"
                    />

                    {/* Legend Overlay */}
                    <div className="absolute top-4 left-4 z-[500] pointer-events-none">
                        <div className="bg-black/80 backdrop-blur-md p-3 rounded-lg border border-border/30 shadow-2xl space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#facc15] rounded-sm" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Civilian Aircraft</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-50">
                                <div className="w-3 h-3 bg-red-500 rounded-sm" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Restricted / MIL</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info Panel */}
                <div className="hidden xl:flex flex-col border-l border-border/20 bg-[#0f172a]/40 backdrop-blur-xl">
                    <div className="p-6 space-y-6">
                        <h2 className="text-xs font-bold text-[#21A68D] uppercase tracking-[0.2em] mb-4">Regional Statistics</h2>

                        <div className="grid grid-cols-1 gap-4">
                            <Card className="bg-white/5 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center">
                                        <Plane className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Flights</p>
                                        <p className="text-2xl font-bold text-white">{stats.count}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-orange-500/10 flex items-center justify-center">
                                        <Satellite className="w-5 h-5 text-orange-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Avg Altitude</p>
                                        <p className="text-2xl font-bold text-white">{stats.avgAlt.toLocaleString()}<span className="text-xs ml-1">FT</span></p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-[#21A68D]/10 flex items-center justify-center">
                                        <Navigation className="w-5 h-5 text-[#21A68D]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Coverage</p>
                                        <p className="text-sm font-bold text-white uppercase">{stats.coverage}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Info className="w-3 h-3" />
                                Information
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Displaying real-time ADS-B data received through the MARIVIEW Ground Station Network. Data latency is approximately 800ms.
                            </p>
                        </div>
                    </div>

                    <div className="mt-auto p-4 border-t border-border/10 bg-black/20 text-[9px] text-muted-foreground flex justify-between">
                        <span>© MARIVIEW DATA GRP</span>
                        <span className="text-[#21A68D]">SYSTEM SECURE</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
