/**
 * ADS-B Live Data Integration
 * 
 * API Options:
 * 1. OpenSky Network (Free tier available): https://openskynetwork.github.io/opensky-api/
 * 2. FlightRadar24 (Paid): https://www.flightradar24.com/premium/
 * 3. ADS-B Exchange (Free): https://www.adsbexchange.com/data/
 * 
 * Setup Instructions:
 * 1. Register at chosen provider
 * 2. Get API key
 * 3. Replace ADSB_API_KEY with your actual key
 * 4. Uncomment real API calls
 */

import { mockADSBData } from '../data/mock-data';

// API Configuration
const ADSB_API_KEY = 'YOUR_ADSB_API_KEY_HERE';
const OPENSKY_API_URL = 'https://opensky-network.org/api/states/all';

// Type definitions
export interface ADSBData {
  icao24: string;
  callsign: string;
  origin_country: string;
  time_position: number;
  last_contact: number;
  longitude: number;
  latitude: number;
  baro_altitude: number;
  on_ground: boolean;
  velocity: number;
  true_track: number;
  vertical_rate: number;
  squawk: string;
}

export interface FormattedADSBData {
  id: string;
  name: string;
  position: [number, number];
  altitude: number;
  speed: number;
  heading: number;
  type: string;
  onGround: boolean;
}

/**
 * Fetch live ADS-B data from OpenSky Network
 * Bounding box around Jakarta area: lat -6.5 to -5.5, lon 106.5 to 107.5
 */
export async function fetchADSBData(bounds?: {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}): Promise<FormattedADSBData[]> {
  const jakartaBounds = bounds || {
    minLat: -6.5,
    maxLat: -5.5,
    minLon: 106.5,
    maxLon: 107.5,
  };

  try {
    // REAL API CALL (Uncomment when ready):
    /*
    const url = `${OPENSKY_API_URL}?lamin=${jakartaBounds.minLat}&lomin=${jakartaBounds.minLon}&lamax=${jakartaBounds.maxLat}&lomax=${jakartaBounds.maxLon}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ADS-B API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.states
      ?.filter((state: any) => state[5] && state[6]) // Has valid position
      .map((state: any) => ({
        id: state[0] || 'unknown',
        name: state[1]?.trim() || 'Unknown Flight',
        position: [state[6], state[5]] as [number, number], // [lat, lon]
        altitude: state[7] || 0,
        speed: state[9] || 0,
        heading: state[10] || 0,
        type: 'aircraft',
        onGround: state[8] || false,
      })) || [];
    */

    // MOCK DATA (Remove when using real API):
    return getMockADSBData();
  } catch (error) {
    console.error('Error fetching ADS-B data:', error);
    return getMockADSBData();
  }
}

/**
 * Mock ADS-B data matching real API structure
 * Represents aircraft around Soekarno-Hatta Airport area
 */
function getMockADSBData(): FormattedADSBData[] {
  return mockADSBData;
}

/**
 * Setup polling for live updates
 * @param callback Function to call with new data
 * @param interval Update interval in milliseconds (default: 10 seconds)
 */
export function setupADSBPolling(
  callback: (data: FormattedADSBData[]) => void,
  interval: number = 10000
): () => void {
  const pollData = async () => {
    const data = await fetchADSBData();
    callback(data);
  };

  // Initial fetch
  pollData();

  // Setup interval
  const intervalId = setInterval(pollData, interval);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
