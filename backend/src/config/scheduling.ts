// ═══════════════════════════════════════════════════════════
// SMART CALL SCHEDULING CONFIG
// Timezone detection, holiday blocking, priority days
// ═══════════════════════════════════════════════════════════

// City → Timezone mapping for automatic detection
export const CITY_TIMEZONE_MAP: Record<string, string> = {
  // US Cities
  'New York': 'America/New_York',
  'Los Angeles': 'America/Los_Angeles',
  'Chicago': 'America/Chicago',
  'Houston': 'America/Chicago',
  'Miami': 'America/New_York',
  'San Francisco': 'America/Los_Angeles',
  'Seattle': 'America/Los_Angeles',
  'Denver': 'America/Denver',
  'Phoenix': 'America/Phoenix',
  'Boston': 'America/New_York',
  'Atlanta': 'America/New_York',
  'Dallas': 'America/Chicago',
  // Belgium
  'Bruxelles': 'Europe/Brussels',
  'Brussels': 'Europe/Brussels',
  'Anvers': 'Europe/Brussels',
  'Antwerp': 'Europe/Brussels',
  'Gand': 'Europe/Brussels',
  'Ghent': 'Europe/Brussels',
  'Liège': 'Europe/Brussels',
  'Namur': 'Europe/Brussels',
  // France
  'Paris': 'Europe/Paris',
  'Lyon': 'Europe/Paris',
  'Marseille': 'Europe/Paris',
  'Toulouse': 'Europe/Paris',
  'Nice': 'Europe/Paris',
  // Canada
  'Toronto': 'America/Toronto',
  'Montreal': 'America/Toronto',
  'Vancouver': 'America/Vancouver',
};

// Country → default timezone fallback
export const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  US: 'America/New_York',
  BE: 'Europe/Brussels',
  FR: 'Europe/Paris',
  CA: 'America/Toronto',
  UK: 'Europe/London',
};

// US public holidays 2026
export const HOLIDAYS_US_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-05-25', // Memorial Day
  '2026-07-04', // Independence Day (observed July 3)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

// Belgian public holidays 2026
export const HOLIDAYS_BE_2026 = [
  '2026-01-01', // Jour de l'An
  '2026-04-05', // Pâques (Easter Sunday)
  '2026-04-06', // Lundi de Pâques
  '2026-05-01', // Fête du Travail
  '2026-05-14', // Ascension
  '2026-05-25', // Lundi de Pentecôte
  '2026-07-21', // Fête nationale
  '2026-08-15', // Assomption
  '2026-11-01', // Toussaint
  '2026-11-11', // Armistice
  '2026-12-25', // Noël
];

// Merge all holidays by country
export const HOLIDAYS_BY_COUNTRY: Record<string, string[]> = {
  US: HOLIDAYS_US_2026,
  BE: HOLIDAYS_BE_2026,
  FR: HOLIDAYS_BE_2026, // Similar enough
};

// Priority days: Tue=2, Wed=3, Thu=4 (0=Sun, 1=Mon, ...)
export const PRIORITY_DAYS = [2, 3, 4];

// Minimum seconds between calls (rate limit)
export const CALL_RATE_LIMIT_MS = 60_000; // 1 minute

/**
 * Detect timezone from city name, falling back to country default
 */
export function detectTimezone(city: string | null, country: string): string {
  if (city) {
    const tz = CITY_TIMEZONE_MAP[city];
    if (tz) return tz;
    // Try case-insensitive match
    const key = Object.keys(CITY_TIMEZONE_MAP).find(
      k => k.toLowerCase() === city.toLowerCase()
    );
    if (key) return CITY_TIMEZONE_MAP[key];
  }
  return COUNTRY_TIMEZONE_MAP[country] || 'America/New_York';
}

/**
 * Check if a date is a holiday for a given country
 */
export function isHoliday(date: Date, country: string): boolean {
  const holidays = HOLIDAYS_BY_COUNTRY[country] || HOLIDAYS_US_2026;
  const dateStr = date.toISOString().split('T')[0];
  return holidays.includes(dateStr);
}

/**
 * Check if current time is within a niche call window for a given timezone
 */
export function isWithinCallWindow(
  timezone: string,
  windowStart: string,
  windowEnd: string
): boolean {
  const now = new Date();
  const timeInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const hours = timeInTz.getHours();
  const minutes = timeInTz.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [startH, startM] = windowStart.split(':').map(Number);
  const [endH, endM] = windowEnd.split(':').map(Number);
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Check if today is a priority day (Tue/Wed/Thu)
 */
export function isPriorityDay(): boolean {
  const day = new Date().getDay();
  return PRIORITY_DAYS.includes(day);
}
