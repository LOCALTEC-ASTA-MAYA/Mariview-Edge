/**
 * OpenWeatherMap API Service
 * Fetches real-time weather data for configured locations.
 * API Key is embedded at build time — safe for free-tier weather keys.
 */

const OWM_API_KEY = '58114e89f127aa671ca2683331a369c7';
const OWM_BASE = 'https://api.openweathermap.org/data/2.5/weather';

export interface WeatherData {
  id: number;
  location: string;
  region: string;
  lat: number;
  lon: number;
  temp: number;           // Celsius
  feelsLike: number;      // Celsius
  humidity: number;       // %
  pressure: number;       // hPa
  visibility: number;     // km
  windSpeed: number;      // knots
  windDeg: number;        // degrees
  windGust: number;       // knots
  clouds: number;         // %
  weatherMain: string;    // "Rain", "Clear", "Clouds", etc.
  weatherDesc: string;    // "light rain", "overcast clouds", etc.
  weatherIcon: string;    // OWM icon code
  sunrise: number;        // unix timestamp
  sunset: number;         // unix timestamp
  updatedAt: Date;
  // Derived maritime fields
  windStatus: string;
  windLevel: 'safe' | 'warning' | 'critical';
  visibilityStatus: string;
  visibilityLevel: 'safe' | 'warning' | 'critical';
}

/** Convert m/s to knots */
function msToKnots(ms: number): number {
  return Math.round(ms * 1.94384 * 10) / 10;
}

/** Compass direction from degrees */
function degToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** Classify wind speed for maritime operations */
function classifyWind(knots: number): { status: string; level: 'safe' | 'warning' | 'critical' } {
  if (knots >= 20) return { status: 'Angin Sangat Kencang', level: 'critical' };
  if (knots >= 12) return { status: 'Angin Kencang', level: 'warning' };
  if (knots >= 6)  return { status: 'Angin Sedang', level: 'safe' };
  return { status: 'Angin Tenang', level: 'safe' };
}

/** Classify visibility for flight ops */
function classifyVisibility(km: number): { status: string; level: 'safe' | 'warning' | 'critical' } {
  if (km < 3)  return { status: 'Sangat Buruk', level: 'critical' };
  if (km < 7)  return { status: 'Terbatas', level: 'warning' };
  if (km < 10) return { status: 'Sedang', level: 'safe' };
  return { status: 'Baik', level: 'safe' };
}

/** Translate OWM main weather type to Indonesian */
function translateWeatherType(main: string): string {
  const map: Record<string, string> = {
    'Thunderstorm': 'Badai Petir',
    'Drizzle': 'Gerimis',
    'Rain': 'Hujan',
    'Snow': 'Salju',
    'Mist': 'Kabut Tipis',
    'Smoke': 'Asap',
    'Haze': 'Kabur',
    'Dust': 'Debu',
    'Fog': 'Kabut',
    'Sand': 'Pasir',
    'Ash': 'Abu Vulkanik',
    'Squall': 'Badai Angin',
    'Tornado': 'Tornado',
    'Clear': 'Cerah',
    'Clouds': 'Berawan',
  };
  return map[main] || main;
}

/**
 * Fetch weather for a single location from OpenWeatherMap.
 */
export async function fetchWeather(lat: string, lon: string): Promise<any> {
  const url = `${OWM_BASE}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=id`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch weather for all configured locations and return structured WeatherData[].
 */
export async function fetchAllWeather(
  locations: Array<{ id: number; name: string; lat: string; lng: string }>
): Promise<WeatherData[]> {
  const results = await Promise.allSettled(
    locations.map(async (loc) => {
      const data = await fetchWeather(loc.lat, loc.lng);
      const windKnots = msToKnots(data.wind?.speed ?? 0);
      const gustKnots = msToKnots(data.wind?.gust ?? data.wind?.speed ?? 0);
      const visKm = Math.round((data.visibility ?? 10000) / 100) / 10; // m → km, 1 decimal
      const windClass = classifyWind(windKnots);
      const visClass = classifyVisibility(visKm);

      const weatherData: WeatherData = {
        id: loc.id,
        location: loc.name,
        region: data.sys?.country ?? 'ID',
        lat: parseFloat(loc.lat),
        lon: parseFloat(loc.lng),
        temp: Math.round(data.main.temp * 10) / 10,
        feelsLike: Math.round(data.main.feels_like * 10) / 10,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: visKm,
        windSpeed: windKnots,
        windDeg: data.wind?.deg ?? 0,
        windGust: gustKnots,
        clouds: data.clouds?.all ?? 0,
        weatherMain: data.weather?.[0]?.main ?? 'Clear',
        weatherDesc: data.weather?.[0]?.description ?? '',
        weatherIcon: data.weather?.[0]?.icon ?? '01d',
        sunrise: data.sys?.sunrise ?? 0,
        sunset: data.sys?.sunset ?? 0,
        updatedAt: new Date(),
        windStatus: windClass.status,
        windLevel: windClass.level,
        visibilityStatus: visClass.status,
        visibilityLevel: visClass.level,
      };
      return weatherData;
    })
  );

  // Filter successful results, log failures
  const weatherDataList: WeatherData[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      weatherDataList.push(result.value);
    } else {
      console.error(`[Weather] Failed to fetch for ${locations[i].name}:`, result.reason);
    }
  });

  return weatherDataList;
}

// Re-export helpers for use in components
export { degToCompass, translateWeatherType, classifyWind, classifyVisibility, msToKnots };
