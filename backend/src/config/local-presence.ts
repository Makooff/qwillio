/**
 * Local Presence Dialing — Top 20 US Area Codes
 * Auto-select matching area code for outbound calls
 */

export const LOCAL_PRESENCE_AREAS = [
  { areaCode: '212', city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { areaCode: '310', city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { areaCode: '312', city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { areaCode: '713', city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { areaCode: '602', city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { areaCode: '215', city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { areaCode: '210', city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { areaCode: '619', city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { areaCode: '214', city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { areaCode: '408', city: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863 },
  { areaCode: '512', city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
  { areaCode: '617', city: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589 },
  { areaCode: '415', city: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194 },
  { areaCode: '303', city: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903 },
  { areaCode: '404', city: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880 },
  { areaCode: '305', city: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918 },
  { areaCode: '702', city: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398 },
  { areaCode: '206', city: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321 },
  { areaCode: '615', city: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816 },
  { areaCode: '504', city: 'New Orleans', state: 'LA', lat: 29.9511, lng: -90.0715 },
] as const;

/**
 * Find the best local presence number for an outbound call.
 * 1. Exact area code match
 * 2. Nearest geographic match (Haversine distance)
 * 3. Fallback to default number
 */
export function findBestLocalNumber(
  prospectPhone: string,
  availableNumbers: Array<{ areaCode: string; phoneNumber: string }>
): string | null {
  const cleaned = prospectPhone.replace(/\D/g, '');
  let prospectAreaCode = '';

  if (cleaned.startsWith('1') && cleaned.length >= 4) {
    prospectAreaCode = cleaned.substring(1, 4);
  } else if (cleaned.length >= 3) {
    prospectAreaCode = cleaned.substring(0, 3);
  }

  // 1. Exact match
  const exact = availableNumbers.find(n => n.areaCode === prospectAreaCode);
  if (exact) return exact.phoneNumber;

  // 2. Nearest geographic match
  const prospectArea = LOCAL_PRESENCE_AREAS.find(a => a.areaCode === prospectAreaCode);
  if (prospectArea) {
    let nearest: { phoneNumber: string; distance: number } | null = null;

    for (const num of availableNumbers) {
      const numArea = LOCAL_PRESENCE_AREAS.find(a => a.areaCode === num.areaCode);
      if (!numArea) continue;

      const distance = haversineDistance(
        prospectArea.lat, prospectArea.lng,
        numArea.lat, numArea.lng
      );

      if (!nearest || distance < nearest.distance) {
        nearest = { phoneNumber: num.phoneNumber, distance };
      }
    }

    if (nearest) return nearest.phoneNumber;
  }

  // 3. Return first available
  return availableNumbers.length > 0 ? availableNumbers[0].phoneNumber : null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Carrier-specific forwarding codes for call forwarding setup
 */
export const CARRIER_FORWARDING_CODES: Record<string, { activate: string; deactivate: string }> = {
  'AT&T': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'T-Mobile': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'Verizon': { activate: '*72{NUMBER}', deactivate: '*73' },
  'Sprint': { activate: '*72{NUMBER}', deactivate: '*720' },
  'US Cellular': { activate: '*72{NUMBER}', deactivate: '*720' },
  'Rogers': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'Bell': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'Telus': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'Orange': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'SFR': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'Bouygues': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
  'Free': { activate: '*21*{NUMBER}#', deactivate: '#21#' },
};

export function getForwardingCode(carrier: string, qwillioNumber: string): { activate: string; deactivate: string } | null {
  const template = CARRIER_FORWARDING_CODES[carrier];
  if (!template) return null;
  return {
    activate: template.activate.replace('{NUMBER}', qwillioNumber),
    deactivate: template.deactivate,
  };
}
