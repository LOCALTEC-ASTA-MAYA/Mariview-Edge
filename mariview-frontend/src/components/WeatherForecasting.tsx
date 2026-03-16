import { useState, useEffect, useCallback } from 'react';
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
    AlertCircle,
    Sun,
    Cloud,
    CloudSnow,
    CloudDrizzle,
    CloudFog,
    Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { loadWeatherLocations, loadFlightWeatherPolicy, FlightWeatherPolicy } from '../utils/storage';
import {
    fetchAllWeather,
    WeatherData,
    degToCompass,
    translateWeatherType,
} from '../services/weather-api';

// ── Icon mapping for OWM "main" types ────────────────────────────────────────
function weatherIcon(main: string) {
    switch (main) {
        case 'Thunderstorm': return CloudLightning;
        case 'Drizzle':      return CloudDrizzle;
        case 'Rain':         return CloudRain;
        case 'Snow':         return CloudSnow;
        case 'Clear':        return Sun;
        case 'Clouds':       return Cloud;
        case 'Mist':
        case 'Fog':
        case 'Haze':         return CloudFog;
        default:             return Cloud;
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeatherForecasting() {
    const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string>('—');
    const [policy, setPolicy] = useState<FlightWeatherPolicy>(() => loadFlightWeatherPolicy());

    const loadWeather = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const locations = loadWeatherLocations();
            if (locations.length === 0) {
                setWeatherData([]);
                setError('Belum ada lokasi cuaca. Tambahkan di Settings → Weather.');
                return;
            }
            const data = await fetchAllWeather(locations);
            setWeatherData(data);
            const now = new Date();
            setLastUpdate(
                now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
        } catch (err: any) {
            setError(err.message || 'Gagal mengambil data cuaca');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on mount + listen for storage changes (when user adds/removes locations in Settings)
    useEffect(() => {
        loadWeather();
        const onStorageChange = () => {
            loadWeather();
            setPolicy(loadFlightWeatherPolicy());
        };
        window.addEventListener('mariview-storage-change', onStorageChange);
        return () => window.removeEventListener('mariview-storage-change', onStorageChange);
    }, [loadWeather]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        const interval = setInterval(loadWeather, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [loadWeather]);

    // ── Policy-based flight recommendation logic ─────────────────────────────
    const isViolatingPolicy = (w: WeatherData) => {
        if (w.windSpeed > policy.maxWindKn) return true;
        if (w.windGust > policy.maxGustKn) return true;
        if (w.visibility < policy.minVisibilityKm) return true;
        if (w.humidity > policy.maxHumidity) return true;
        if (policy.blockedWeather.includes(w.weatherMain)) return true;
        return false;
    };

    const getPolicyViolations = (w: WeatherData): string[] => {
        const violations: string[] = [];
        if (w.windSpeed > policy.maxWindKn) violations.push(`Angin ${w.windSpeed} kn > batas ${policy.maxWindKn} kn`);
        if (w.windGust > policy.maxGustKn) violations.push(`Gust ${w.windGust} kn > batas ${policy.maxGustKn} kn`);
        if (w.visibility < policy.minVisibilityKm) violations.push(`Visibilitas ${w.visibility} km < batas ${policy.minVisibilityKm} km`);
        if (w.humidity > policy.maxHumidity) violations.push(`Kelembaban ${w.humidity}% > batas ${policy.maxHumidity}%`);
        if (policy.blockedWeather.includes(w.weatherMain)) violations.push(`Cuaca ${translateWeatherType(w.weatherMain)} diblokir`);
        return violations;
    };

    const getFlightRecommendation = () => {
        if (weatherData.length === 0) return null;
        return weatherData.reduce((prev, curr) => {
            const score = (loc: WeatherData) => {
                let s = 0;
                // Policy-based scoring
                if (policy.blockedWeather.includes(loc.weatherMain)) s -= 100;
                if (loc.windSpeed > policy.maxWindKn) s -= 50;
                if (loc.windGust > policy.maxGustKn) s -= 40;
                if (loc.visibility < policy.minVisibilityKm) s -= 30;
                if (loc.humidity > policy.maxHumidity) s -= 15;
                // Bonus for good conditions
                if (loc.windSpeed < policy.maxWindKn * 0.5) s += 10;
                if (loc.visibility > policy.minVisibilityKm * 2) s += 10;
                return s;
            };
            return score(curr) > score(prev) ? curr : prev;
        });
    };

    const getHighRiskZones = () => {
        return weatherData
            .filter(w => isViolatingPolicy(w))
            .sort((a, b) => {
                return getPolicyViolations(b).length - getPolicyViolations(a).length;
            })
            .slice(0, 3);
    };

    const bestLocation = getFlightRecommendation();
    const highRiskZones = getHighRiskZones();

    return (
        <div className="p-4 md:p-8 space-y-8 bg-[#0a0e1a] min-h-full">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4" style={{ marginBottom: '32px' }}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <CloudRain className="w-8 h-8 text-[#2DD4BF]" />
                        <h1 className="text-3xl font-extrabold tracking-tight text-white">
                            Weather Information
                        </h1>
                    </div>
                    <p className="text-white md:text-lg font-medium">
                        Real-time maritime weather conditions for PSDKP Kupang waters
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-4 text-xs md:text-sm text-muted-foreground">
                        <span>Source: OpenWeatherMap API</span>
                        <span>Updated: {lastUpdate}</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadWeather}
                        disabled={loading}
                        className="flex items-center gap-2 border-[#2DD4BF]/30 text-[#2DD4BF] hover:bg-[#2DD4BF]/10"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Memuat...' : 'Refresh'}
                    </Button>
                </div>
            </div>

            {/* Loading state */}
            {loading && weatherData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-[#2DD4BF] animate-spin" />
                    <p className="text-muted-foreground text-sm">Mengambil data cuaca dari OpenWeatherMap...</p>
                </div>
            )}

            {/* Error state */}
            {error && weatherData.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <AlertTriangle className="w-10 h-10 text-yellow-500" />
                    <p className="text-muted-foreground text-sm text-center max-w-md">{error}</p>
                    <Button variant="outline" onClick={loadWeather} className="mt-2">
                        <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
                    </Button>
                </div>
            )}

            {/* Weather Forecast Grid */}
            {weatherData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {weatherData.map((loc) => {
                        const IconComp = weatherIcon(loc.weatherMain);
                        const windDir = degToCompass(loc.windDeg);
                        const weatherTypeId = translateWeatherType(loc.weatherMain);
                        const isBadai = policy.blockedWeather.includes(loc.weatherMain);
                        const isRisky = isViolatingPolicy(loc);

                        // Build alert from policy violations
                        const violations = getPolicyViolations(loc);
                        const alert = violations.length > 0 ? violations.join(' · ') : null;

                        return (
                            <Card key={loc.id} className={`bg-[#0f172a]/80 backdrop-blur-md border border-border/50 overflow-hidden flex flex-col h-full hover:border-[#21A68D]/40 transition-all duration-300 ${isRisky ? 'ring-1 ring-red-500/20' : ''}`}>
                                <CardContent className="p-5 flex flex-col h-full">
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{loc.location}</h3>
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                                <Navigation className="w-2.5 h-2.5" />
                                                {loc.lat.toFixed(2)}°, {loc.lon.toFixed(2)}° · {loc.region}
                                            </div>
                                            <Badge variant="secondary" className={`mt-2 ${isBadai ? 'bg-red-500/20 text-red-500 border-red-500/30' : loc.weatherMain === 'Rain' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : loc.weatherMain === 'Clear' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-sky-500/20 text-sky-400 border-sky-500/30'}`}>
                                                {weatherTypeId}
                                            </Badge>
                                        </div>
                                        <IconComp className={`w-10 h-10 ${isBadai ? 'text-purple-500' : loc.weatherMain === 'Rain' ? 'text-blue-400' : loc.weatherMain === 'Clear' ? 'text-yellow-400' : 'text-sky-400'}`} />
                                    </div>

                                    {/* Metrics */}
                                    <div className="space-y-3 flex-1 flex flex-col justify-center">
                                        {/* Temp */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Thermometer className="w-4 h-4" />
                                                <span className="text-xs font-semibold uppercase">Suhu</span>
                                            </div>
                                            <span className="text-lg font-bold text-[#2DD4BF]">{loc.temp}°C</span>
                                        </div>

                                        {/* Wind */}
                                        <div className="space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Wind className="w-4 h-4" />
                                                    <span className="text-xs font-semibold uppercase">Angin</span>
                                                </div>
                                                <span className="font-bold text-white text-sm">{loc.windSpeed} kn {windDir}</span>
                                            </div>
                                            <p className={`text-[10px] font-bold text-right ${loc.windLevel === 'critical' ? 'text-red-500' : loc.windLevel === 'warning' ? 'text-yellow-500' : 'text-green-500'}`}>
                                                {loc.windStatus}
                                            </p>
                                        </div>

                                        {/* Clouds / Pressure (replacing waves for land) */}
                                        <div className="space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Waves className="w-4 h-4" />
                                                    <span className="text-xs font-semibold uppercase">Tekanan</span>
                                                </div>
                                                <span className="font-bold text-white text-sm">{loc.pressure} hPa</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-right text-muted-foreground">
                                                Awan: {loc.clouds}%
                                            </p>
                                        </div>

                                        {/* Visibility */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Eye className="w-4 h-4" />
                                                <span className="text-xs font-semibold uppercase text-nowrap">Visibilitas</span>
                                            </div>
                                            <span className={`text-sm font-bold ${loc.visibilityLevel === 'critical' ? 'text-red-500' : loc.visibilityLevel === 'warning' ? 'text-yellow-500' : 'text-green-500'}`}>{loc.visibility} km</span>
                                        </div>

                                        {/* Humidity */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Droplets className="w-4 h-4" />
                                                <span className="text-xs font-semibold uppercase">Kelembaban</span>
                                            </div>
                                            <span className="text-sm font-bold text-white">{loc.humidity}%</span>
                                        </div>
                                    </div>

                                    {/* Warning Bar */}
                                    {alert && (
                                        <div className="mt-4 mb-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                                                <p className="text-[10px] font-bold text-red-500 leading-tight">{alert}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-3 mt-3 border-t border-border/30 text-[9px] text-muted-foreground text-right italic font-medium">
                                        Update: {loc.updatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Best Recommendation Section */}
            {weatherData.length > 0 && bestLocation && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                    <Card className="lg:col-span-2 bg-[#1e293b]/40 border-[#21A68D]/30 backdrop-blur-sm h-full flex flex-col">
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
                                <div className="flex flex-col h-full space-y-4">
                                    <h3 className="text-sm font-bold text-[#21A68D] uppercase tracking-wider">Best Recommended Area</h3>
                                    <div className="p-4 rounded-xl bg-[#21A68D]/10 border border-[#21A68D]/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl font-bold text-white">{bestLocation.location}</span>
                                            <Badge className="bg-[#21A68D] hover:bg-[#21A68D] text-white border-none px-3 py-1">SUITABLE</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">This area has the most stable conditions for drone deployment relative to other locations.</p>
                                    </div>

                                    <div className="space-y-2 pt-2 flex-grow">
                                        <div className="flex items-center gap-2 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-[#21A68D]" />
                                            <span className="text-white">Wind: {bestLocation.windSpeed} kn {degToCompass(bestLocation.windDeg)} ({bestLocation.windStatus})</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-[#21A68D]" />
                                            <span className="text-white">Visibility: {bestLocation.visibility} km ({bestLocation.visibilityStatus})</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <CheckCircle2 className="w-4 h-4 text-[#21A68D]" />
                                            <span className="text-white">Temperature: {bestLocation.temp}°C, Humidity: {bestLocation.humidity}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col h-full space-y-4">
                                    <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">High Risk Zones</h3>
                                    <div className="flex flex-col gap-3">
                                        {highRiskZones.length === 0 ? (
                                            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
                                                <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                                <p className="text-sm text-green-400 font-semibold">All Clear</p>
                                                <p className="text-xs text-muted-foreground">Semua lokasi dalam kondisi aman</p>
                                            </div>
                                        ) : (
                                            highRiskZones.map(zone => {
                                                const zoneViolations = getPolicyViolations(zone);
                                                const isExtreme = zoneViolations.length >= 2 || policy.blockedWeather.includes(zone.weatherMain);
                                                return (
                                                    <div key={zone.id} className={`flex items-center justify-between p-3 rounded-lg ${isExtreme ? 'bg-red-500/5 border border-red-500/10' : 'bg-orange-500/5 border border-orange-500/10'}`}>
                                                        <div className="flex items-center gap-3">
                                                            {isExtreme ? (
                                                                <XCircle className="w-5 h-5 text-red-500" />
                                                            ) : (
                                                                <AlertCircle className="w-5 h-5 text-orange-500" />
                                                            )}
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{zone.location}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {zoneViolations.slice(0, 2).join(' · ')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className={`${
                                                            policy.enforcementMode === 'NO_FLY'
                                                                ? 'border-red-500 text-red-500'
                                                                : 'border-yellow-500 text-yellow-500'
                                                        } text-[10px]`}>
                                                            {policy.enforcementMode === 'NO_FLY' ? 'NO FLY' : 'CAUTION'}
                                                        </Badge>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#1e293b]/40 border-border/50 backdrop-blur-sm h-full flex flex-col">
                        <CardContent className="p-6">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider mb-6">
                                <Info className="w-4 h-4 text-primary" />
                                Pilot General Advice
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <p className="text-sm text-muted-foreground">
                                        <strong className="text-white">Monitor Battery:</strong> {weatherData.some(w => w.weatherMain === 'Rain') ? 'Hujan di beberapa lokasi — baterai mungkin berkurang hingga 15%.' : 'Kondisi kering — baterai stabil.'}
                                    </p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <p className="text-sm text-muted-foreground">
                                        <strong className="text-white">Signal Stability:</strong> {weatherData.some(w => w.weatherMain === 'Thunderstorm') ? 'Badai petir terdeteksi — hindari BVLOS jarak jauh.' : 'Tidak ada gangguan signifikan pada sinyal.'}
                                    </p>
                                </li>
                                <li className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <p className="text-sm text-muted-foreground">
                                        <strong className="text-white">Wind Advisory:</strong> {weatherData.some(w => w.windLevel === 'critical')
                                            ? `Angin kencang >${Math.max(...weatherData.map(w => w.windSpeed)).toFixed(0)} kn terdeteksi. Pastikan payload aman.`
                                            : 'Kecepatan angin dalam batas aman untuk operasi.'}
                                    </p>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}