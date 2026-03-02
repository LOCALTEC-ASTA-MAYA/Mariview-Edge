import { Card, CardContent } from './ui/card';
import {
    CloudRain,
    CloudLightning,
    Wind,
    Droplets,
    Thermometer,
    Eye,
    RefreshCw,
    AlertTriangle,
    Info,
    Waves,
    Navigation,
    CheckCircle2,
    XCircle,
    AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const weatherLocations = [
    {
        id: 1,
        location: "Kupang",
        region: "NTT Region",
        temp: "32°C",
        wind: "21.6 kn N",
        windStatus: "Angin Sangat Kencang",
        windLevel: "critical",
        waves: "3m",
        wavesStatus: "Berbahaya",
        wavesLevel: "critical",
        visibility: "6.6 km",
        humidity: "86%",
        weatherType: "Badai",
        icon: CloudLightning,
        alert: "Peringatan badai - Hindari operasi laut",
        updateTime: "14.53.27"
    },
    {
        id: 2,
        location: "Flores Timur",
        region: "NTT Region",
        temp: "28.2°C",
        wind: "21.3 kn NE",
        windStatus: "Angin Sangat Kencang",
        windLevel: "critical",
        waves: "1.3m",
        wavesStatus: "Sedikit Bergelombang",
        wavesLevel: "info",
        visibility: "11.6 km",
        humidity: "67%",
        weatherType: "Hujan",
        icon: CloudRain,
        alert: "Angin kencang - Waspada",
        updateTime: "14.53.27"
    },
    {
        id: 3,
        location: "Sumba Timur",
        region: "NTT Region",
        temp: "29.6°C",
        wind: "22.9 kn SE",
        windStatus: "Angin Sangat Kencang",
        windLevel: "critical",
        waves: "1.6m",
        wavesStatus: "Bergelombang",
        wavesLevel: "warning",
        visibility: "6.3 km",
        humidity: "73%",
        weatherType: "Hujan",
        icon: CloudRain,
        alert: "Angin kencang - Waspada",
        updateTime: "14.53.27"
    },
    {
        id: 4,
        location: "Atapupu",
        region: "NTT Region",
        temp: "29.1°C",
        wind: "14.1 kn S",
        windStatus: "Angin Sedang",
        windLevel: "info",
        waves: "2.2m",
        wavesStatus: "Berbahaya",
        wavesLevel: "critical",
        visibility: "11.9 km",
        humidity: "83%",
        weatherType: "Hujan",
        icon: CloudRain,
        updateTime: "14.53.27"
    },
    {
        id: 5,
        location: "Maumere",
        region: "NTT Region",
        temp: "29.5°C",
        wind: "11.1 kn SE",
        windStatus: "Angin Sedang",
        windLevel: "info",
        waves: "2.8m",
        wavesStatus: "Berbahaya",
        wavesLevel: "critical",
        visibility: "9.6 km",
        humidity: "67%",
        weatherType: "Hujan",
        icon: CloudRain,
        updateTime: "14.53.27"
    }
];

export default function WeatherForecasting() {
    const getFlightRecommendation = () => {
        // Basic logic to determine the best place
        const bestLocation = weatherLocations.reduce((prev, curr) => {
            // Score based on wind level and weather type
            const getScore = (loc: typeof curr) => {
                let score = 0;
                if (loc.weatherType === 'Badai') score -= 100;
                if (loc.windLevel === 'critical') score -= 50;
                if (loc.wavesLevel === 'critical') score -= 30;
                if (parseFloat(loc.visibility) < 7) score -= 20;
                return score;
            };
            return getScore(curr) > getScore(prev) ? curr : prev;
        });

        return bestLocation;
    };

    const bestLocation = getFlightRecommendation();

    return (
        <div className="p-4 md:p-8 space-y-8 bg-[#0a0e1a] min-h-full">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <CloudRain className="w-8 h-8 text-[#2DD4BF]" />
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">
                            Weather Information
                        </h1>
                    </div>
                    <p className="text-white/90 md:text-lg font-medium">
                        Real-time maritime weather conditions for PSDKP Kupang waters
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-4 text-xs md:text-sm text-muted-foreground">
                        <span>Source: BMKG / OpenWeather Simulation</span>
                        <span>Updated: 14.53.27</span>
                    </div>
                    <Button variant="outline" size="sm" className="bg-card/30 border-border hover:bg-[#21A68D]/10">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Data
                    </Button>
                </div>
            </div>

            {/* Weather Forecast Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {weatherLocations.map((loc) => (
                    <Card key={loc.id} className={`bg-[#0f172a]/80 backdrop-blur-md border border-border/50 overflow-hidden flex flex-col h-full hover:border-[#21A68D]/40 transition-all duration-300 ${loc.location === 'Kupang' ? 'ring-1 ring-red-500/20' : ''}`}>
                        <CardContent className="p-5 flex-1 flex flex-col">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{loc.location}</h3>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                        <Navigation className="w-2.5 h-2.5" />
                                        {loc.region}
                                    </div>
                                    <Badge variant="secondary" className={`mt-2 ${loc.weatherType === 'Badai' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                                        {loc.weatherType}
                                    </Badge>
                                </div>
                                <loc.icon className={`w-10 h-10 ${loc.weatherType === 'Badai' ? 'text-purple-500' : 'text-blue-400'}`} />
                            </div>

                            {/* Metrics */}
                            <div className="space-y-4 flex-1">
                                {/* Temp */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Thermometer className="w-4 h-4" />
                                        <span className="text-xs font-semibold uppercase">Suhu</span>
                                    </div>
                                    <span className="text-lg font-bold text-[#2DD4BF]">{loc.temp}</span>
                                </div>

                                {/* Wind */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Wind className="w-4 h-4" />
                                            <span className="text-xs font-semibold uppercase">Angin</span>
                                        </div>
                                        <span className="font-bold text-white">{loc.wind}</span>
                                    </div>
                                    <p className={`text-[10px] font-bold text-right ${loc.windLevel === 'critical' ? 'text-red-500' : 'text-blue-400'}`}>
                                        {loc.windStatus}
                                    </p>
                                </div>

                                {/* Waves */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Waves className="w-4 h-4" />
                                            <span className="text-xs font-semibold uppercase">Gelombang</span>
                                        </div>
                                        <span className="font-bold text-white">{loc.waves}</span>
                                    </div>
                                    <p className={`text-[10px] font-bold text-right ${loc.wavesLevel === 'critical' ? 'text-red-500' : loc.wavesLevel === 'warning' ? 'text-yellow-500' : 'text-cyan-400'}`}>
                                        {loc.wavesStatus}
                                    </p>
                                </div>

                                {/* Visibility */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Eye className="w-4 h-4" />
                                        <span className="text-xs font-semibold uppercase text-nowrap">Jarak Pandang</span>
                                    </div>
                                    <span className={`font-bold ${parseFloat(loc.visibility) < 7 ? 'text-yellow-500' : 'text-white'}`}>{loc.visibility}</span>
                                </div>

                                {/* Humidity */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Droplets className="w-4 h-4" />
                                        <span className="text-xs font-semibold uppercase">Kelembaban</span>
                                    </div>
                                    <span className="font-bold text-white">{loc.humidity}</span>
                                </div>
                            </div>

                            {/* Warning Bar */}
                            {loc.alert && (
                                <div className="mt-6 mb-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                                        <p className="text-[10px] font-bold text-red-500">{loc.alert}</p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto pt-4 border-t border-border/30 text-[9px] text-muted-foreground text-right italic">
                                Update: {loc.updateTime}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Best Recommendation Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                <Card className="lg:col-span-2 bg-[#1e293b]/40 border-[#21A68D]/30 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-[#21A68D]/20 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-[#21A68D]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Flight Operational Recommendation</h2>
                                <p className="text-sm text-muted-foreground">AI-driven safety analysis for regional drone operations</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-[#21A68D] uppercase tracking-wider">Best Recommended Area</h3>
                                <div className="p-4 rounded-xl bg-[#21A68D]/10 border border-[#21A68D]/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-2xl font-bold text-white">{bestLocation.location}</span>
                                        <Badge className="bg-[#21A68D] hover:bg-[#21A68D] text-white border-none px-3 py-1">SUITABLE</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">This area has the most stable conditions for drone deployment relative to other locations in NTT region.</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-[#21A68D]" />
                                        <span className="text-white">Moderate Wind Speed ({bestLocation.wind})</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className="w-4 h-4 text-[#21A68D]" />
                                        <span className="text-white">Fair Visibility ({bestLocation.visibility})</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">High Risk Zones</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                        <div className="flex items-center gap-3">
                                            <XCircle className="w-5 h-5 text-red-500" />
                                            <div>
                                                <p className="text-sm font-bold text-white">Kupang</p>
                                                <p className="text-[10px] text-muted-foreground">Storm & 3m Dangerous Waves</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="border-red-500 text-red-500 text-[10px]">NO FLY</Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="w-5 h-5 text-orange-500" />
                                            <div>
                                                <p className="text-sm font-bold text-white">Maumere</p>
                                                <p className="text-[10px] text-muted-foreground">Dangerous 2.8m Swell</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="border-orange-500 text-orange-500 text-[10px]">CAUTION</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[#1e293b]/40 border-border/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-6">
                            <Info className="w-4 h-4 text-primary" />
                            Pilot General Advice
                        </h3>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <p className="text-sm text-muted-foreground">
                                    <strong className="text-white">Monitor Battery:</strong> Cold rain in Atapupu/Maumere may reduce battery efficiency by up to 15%.
                                </p>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <p className="text-sm text-muted-foreground">
                                    <strong className="text-white">Signal Stability:</strong> High moisture and lightning near Kupang will cause signal degradation. Avoid long-range BVLOS.
                                </p>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <p className="text-sm text-muted-foreground">
                                    <strong className="text-white">Landing Risk:</strong> 3m waves in Kupang make water recovery impossible. Ensure payload is waterproofed.
                                </p>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
