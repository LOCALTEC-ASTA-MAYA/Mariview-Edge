import { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Ship, Radio, Anchor, Info, Compass, Activity, Navigation } from 'lucide-react';
import LeafletMap from './LeafletMap';
import { Badge } from './ui/badge';

// Mock generator for dense maritime data across Indonesia
const generateMockVessels = () => {
    const vessels = [
        { id: 'ais-1', name: 'EVER GIVEN', type: 'Cargo', position: [1.29027, 103.851959] as [number, number], speed: 12.5, heading: 45, status: 'Under Way' },
        { id: 'ais-2', name: 'TITANIC II', type: 'Passenger', position: [-6.1751, 106.8650] as [number, number], speed: 18.2, heading: 270, status: 'Under Way' },
        { id: 'ais-3', name: 'PACIFIC TANKER', type: 'Tanker', position: [-7.2575, 112.7521] as [number, number], speed: 10.1, heading: 180, status: 'At Anchor' },
    ];

    const regions = [
        { lat: [1, 6], lng: [100, 105] }, // Malacca Strait
        { lat: [-6, -3], lng: [106, 118] }, // Java Sea
        { lat: [-10, -8], lng: [115, 125] }, // Timor Sea
        { lat: [0, 5], lng: [115, 125] }, // Celebes Sea
        { lat: [-5, 2], lng: [130, 140] }, // Arafura Sea
        { lat: [-2, 2], lng: [105, 115] }  // Karimata Strait
    ];

    const types = ['Cargo', 'Tanker', 'Fishing', 'Tug', 'Passenger'];

    for (let i = 0; i < 120; i++) {
        const region = regions[Math.floor(Math.random() * regions.length)];
        const lat = region.lat[0] + Math.random() * (region.lat[1] - region.lat[0]);
        const lng = region.lng[0] + Math.random() * (region.lng[1] - region.lng[0]);

        vessels.push({
            id: `ship-${i}`,
            name: `VESSEL ${1000 + i}`,
            type: types[Math.floor(Math.random() * types.length)],
            position: [lat, lng],
            speed: Math.random() * 25,
            heading: Math.random() * 360,
            status: Math.random() > 0.8 ? 'At Anchor' : 'Under Way'
        });
    }

    return vessels;
};

export default function AisStream() {
    const [activeVessels] = useState(generateMockVessels());

    const stats = useMemo(() => ({
        count: activeVessels.length,
        cargoCount: activeVessels.filter(v => v.type === 'Cargo').length,
        tankerCount: activeVessels.filter(v => v.type === 'Tanker').length,
        avgSpeed: (activeVessels.reduce((acc, v) => acc + v.speed, 0) / activeVessels.length).toFixed(1)
    }), [activeVessels]);

    return (
        <div className="flex flex-col h-full bg-[#0a0e1a]">
            {/* Header Info Bar */}
            <div className="p-4 md:p-6 border-b border-border/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Ship className="w-5 h-5 text-[#2DD4BF]" />
                        <h1 className="text-xl font-bold text-white tracking-tight uppercase">
                            AIS Maritime Real-time Stream
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-xs font-medium">
                        Live Vessel Traffic Monitoring System (VTMS) - Indonesian Archipelago
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-[#2DD4BF]/10 text-[#2DD4BF] border-[#2DD4BF]/30 py-1">
                        <Activity className="w-3 h-3 mr-1.5 animate-pulse" />
                        LIVE FEED: 24.8 kb/s
                    </Badge>
                    <div className="text-[10px] text-muted-foreground text-right border-l border-border/30 pl-3">
                        Source: SAT-AIS HUB-04<br />
                        Global Satellite Network
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-0 overflow-hidden">
                {/* Main Map Area */}
                <div className="xl:col-span-3 relative bg-black">
                    <LeafletMap
                        center={[-2.5489, 118.0149]}
                        zoom={5}
                        aisMarkers={activeVessels}
                        showAIS={true}
                        className="w-full h-full"
                        mapView="indonesia"
                    />

                    {/* Legend Overlay */}
                    <div className="absolute top-4 left-4 z-[500] pointer-events-none">
                        <div className="bg-black/80 backdrop-blur-md p-3 rounded-lg border border-border/30 shadow-2xl space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#22c55e] rounded-sm" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Cargo / General</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#ef4444] rounded-sm" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Tankers</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#3b82f6] rounded-sm" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-tighter">Passenger / Ferry</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info Panel */}
                <div className="hidden xl:flex flex-col border-l border-border/20 bg-[#0f172a]/40 backdrop-blur-xl">
                    <div className="p-6 space-y-6">
                        <h2 className="text-xs font-bold text-[#2DD4BF] uppercase tracking-[0.2em] mb-4">Traffic Summary</h2>

                        <div className="grid grid-cols-1 gap-4">
                            <Card className="bg-white/5 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-[#2DD4BF]/10 flex items-center justify-center">
                                        <Ship className="w-5 h-5 text-[#2DD4BF]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Vessels</p>
                                        <p className="text-2xl font-bold text-white">{stats.count}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-cyan-500/10 flex items-center justify-center">
                                        <Compass className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Avg Speed</p>
                                        <p className="text-2xl font-bold text-white">{stats.avgSpeed}<span className="text-xs ml-1">KN</span></p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/5 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center">
                                        <Anchor className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ports Active</p>
                                        <p className="text-2xl font-bold text-white">42</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="bg-[#2DD4BF]/5 border border-[#2DD4BF]/20 rounded-lg p-4 mt-6">
                            <h4 className="text-[10px] font-bold text-[#2DD4BF] uppercase mb-2">Security Notice</h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Anomaly detection is currently active in Malacca Strait. 3 unidentified signals filtered.
                            </p>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Info className="w-3 h-3" />
                                Technical Info
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Live AIS Class A & B transponders monitored via orbital satellite arrays and terrestrial base stations (AIS-RX).
                            </p>
                        </div>
                    </div>

                    <div className="mt-auto p-4 border-t border-border/10 bg-black/20 text-[9px] text-muted-foreground flex justify-between">
                        <span>© MARIVIEW MARINE DATA</span>
                        <span className="text-[#2DD4BF]">AIS-ENCRYPTED</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
