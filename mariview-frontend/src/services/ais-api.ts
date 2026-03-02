/**
 * AIS Live Data Integration
 * 
 * API Options:
 * 1. Marine Traffic API (Paid): https://www.marinetraffic.com/en/ais-api-services
 * 2. AIS Hub (Free tier): https://www.aishub.net/
 * 3. VesselFinder API (Paid): https://www.vesselfinder.com/api
 * 
 * Setup Instructions:
 * 1. Register at Marine Traffic: https://www.marinetraffic.com/en/ais-api-services
 * 2. Subscribe to API plan (starts ~$50/month)
 * 3. Get API key from dashboard
 * 4. Replace AIS_API_KEY with your actual key
 * 5. Uncomment real API calls
 */

import { mockAISData } from '../data/mock-data';

// API Configuration
const AIS_API_KEY = 'YOUR_MARINE_TRAFFIC_API_KEY_HERE';
const MARINE_TRAFFIC_API_URL = 'https://services.marinetraffic.com/api/exportvessels';

// Type definitions
export interface AISVesselData {
  mmsi: string;
  imo: string;
  ship_name: string;
  callsign: string;
  ship_type: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  heading: number;
  destination: string;
  eta: string;
  length: number;
  width: number;
  draft: number;
  status: string;
  timestamp: string;
}

export interface FormattedAISData {
  id: string;
  mmsi: string;
  imo: string;
  name: string;
  callsign: string;
  position: [number, number];
  type: string;
  speed: number;
  course: number;
  heading: number;
  length: number;
  width: number;
  draft: number;
  destination: string;
  eta: string;
  status: string;
  lastUpdate: string;
}

/**
 * Fetch live AIS data from Marine Traffic API
 * Area around Tanjung Priok Port, Jakarta
 */
export async function fetchAISData(bounds?: {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}): Promise<FormattedAISData[]> {
  const priokBounds = bounds || {
    minLat: -6.15,
    maxLat: -6.05,
    minLon: 106.85,
    maxLon: 106.95,
  };

  try {
    // REAL API CALL (Uncomment when ready):
    /*
    const params = new URLSearchParams({
      v: '8',
      protocol: 'jsono',
      msgtype: 'extended',
      min_lat: priokBounds.minLat.toString(),
      max_lat: priokBounds.maxLat.toString(),
      min_lon: priokBounds.minLon.toString(),
      max_lon: priokBounds.maxLon.toString(),
    });

    const url = `${MARINE_TRAFFIC_API_URL}/${AIS_API_KEY}?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`AIS API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((vessel: any) => ({
      id: `AIS-${vessel.MMSI}`,
      mmsi: vessel.MMSI,
      imo: vessel.IMO || 'N/A',
      name: vessel.SHIPNAME || 'Unknown Vessel',
      callsign: vessel.CALLSIGN || 'N/A',
      position: [vessel.LAT, vessel.LON] as [number, number],
      type: getVesselType(vessel.TYPE),
      speed: vessel.SPEED || 0,
      course: vessel.COURSE || 0,
      heading: vessel.HEADING || 0,
      length: vessel.LENGTH || 0,
      width: vessel.WIDTH || 0,
      draft: vessel.DRAUGHT || 0,
      destination: vessel.DESTINATION || 'Unknown',
      eta: vessel.ETA || 'N/A',
      status: vessel.NAVSTAT || 'Unknown',
      lastUpdate: vessel.TIMESTAMP || new Date().toISOString(),
    }));
    */

    // MOCK DATA (Remove when using real API):
    return mockAISData.map(v => ({
      ...v,
      lastUpdate: (v as any).lastUpdate || new Date().toISOString()
    })) as FormattedAISData[];
  } catch (error) {
    console.error('Error fetching AIS data:', error);
    return mockAISData.map(v => ({
      ...v,
      lastUpdate: (v as any).lastUpdate || new Date().toISOString()
    })) as FormattedAISData[];
  }
}

/**
 * Convert vessel type code to readable name
 */
function getVesselType(typeCode: number): string {
  const types: { [key: number]: string } = {
    60: 'Passenger',
    70: 'Cargo',
    80: 'Tanker',
    81: 'Tanker - Hazardous',
    82: 'Tanker - Reserved',
    83: 'Tanker - Reserved',
    84: 'Tanker - Reserved',
    89: 'Tanker - Reserved',
    90: 'Other',
  };
  return types[typeCode] || 'Unknown';
}

/**
 * Setup polling for live AIS updates
 * @param callback Function to call with new data
 * @param interval Update interval in milliseconds (default: 30 seconds)
 */
export function setupAISPolling(
  callback: (data: FormattedAISData[]) => void,
  interval: number = 30000
): () => void {
  const pollData = async () => {
    const data = await fetchAISData();
    callback(data);
  };

  // Initial fetch
  pollData();

  // Setup interval
  const intervalId = setInterval(pollData, interval);

  // Return cleanup function
  return () => clearInterval(intervalId);
}

/**
 * Get vessel details by MMSI
 */
export async function getVesselByMMSI(mmsi: string): Promise<FormattedAISData | null> {
  const vessels = await fetchAISData();
  return vessels.find(v => v.mmsi === mmsi) || null;
}

/**
 * Filter vessels by type
 */
export function filterVesselsByType(vessels: FormattedAISData[], type: string): FormattedAISData[] {
  return vessels.filter(v => v.type.toLowerCase().includes(type.toLowerCase()));
}
