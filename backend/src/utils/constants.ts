export const BUSINESS_TYPES = [
  'dental',
  'law',
  'salon',
  'restaurant',
  'hotel',
  'auto',
  'medical',
  'service',
  'ecommerce',
  'other',
] as const;

export const PROSPECT_STATUSES = [
  'new',
  'contacted',
  'interested',
  'qualified',
  'converted',
  'lost',
] as const;

export const CALL_STATUSES = [
  'queued',
  'ringing',
  'in-progress',
  'completed',
  'failed',
  'busy',
  'no-answer',
  'canceled',
] as const;

export const CALL_OUTCOMES = [
  'qualified',
  'not_interested',
  'callback_later',
  'wrong_number',
  'voicemail',
  'technical_issue',
] as const;

export const GOOGLE_PLACES_TYPES = [
  // Food & Hospitality
  'restaurant',
  'lodging',
  'cafe',
  'bar',
  'bakery',
  // Health & Beauty
  'beauty_salon',
  'spa',
  'gym',
  'hair_care',
  'physiotherapist',
  'doctor',
  'dentist',
  'veterinary_care',
  'pharmacy',
  // Home Services
  'plumber',
  'electrician',
  'roofing_contractor',
  'moving_company',
  'locksmith',
  'painter',
  'general_contractor',
  // Professional Services
  'lawyer',
  'accounting',
  'insurance_agency',
  'real_estate_agency',
  'travel_agency',
  // Auto
  'car_repair',
  'car_dealer',
  'car_wash',
  // Specialty
  'florist',
  'photographer',
  'pet_store',
  'child_care',
  'funeral_home',
] as const;

export const GOOGLE_PLACES_TYPE_MAP: Record<string, string> = {
  // Food & Hospitality
  restaurant: 'restaurant',
  lodging: 'hotel',
  cafe: 'restaurant',
  bar: 'restaurant',
  bakery: 'restaurant',
  // Health & Beauty
  beauty_salon: 'salon',
  spa: 'salon',
  gym: 'fitness',
  hair_care: 'salon',
  physiotherapist: 'medical',
  doctor: 'medical',
  dentist: 'dental',
  veterinary_care: 'veterinary',
  pharmacy: 'medical',
  // Home Services
  plumber: 'home_services',
  electrician: 'home_services',
  roofing_contractor: 'home_services',
  moving_company: 'home_services',
  locksmith: 'home_services',
  painter: 'home_services',
  general_contractor: 'home_services',
  // Professional Services
  lawyer: 'law',
  accounting: 'financial',
  insurance_agency: 'financial',
  real_estate_agency: 'real_estate',
  travel_agency: 'travel',
  // Auto
  car_repair: 'auto',
  car_dealer: 'auto',
  car_wash: 'auto',
  // Specialty
  florist: 'retail',
  photographer: 'creative',
  pet_store: 'pet',
  child_care: 'childcare',
  funeral_home: 'funeral',
};

// US Cities for prospection — 25 major metros covering 60%+ of US GDP
export const CITIES_COORDINATES: Record<string, { lat: number; lng: number; country: 'US' | 'FR' | 'BE'; timezone: string }> = {
  // ── USA — Tier 1 ──────────────────────────────────────────
  'New York':      { lat: 40.7128,  lng: -74.0060,  country: 'US', timezone: 'America/New_York'    },
  'Los Angeles':   { lat: 34.0522,  lng: -118.2437, country: 'US', timezone: 'America/Los_Angeles' },
  'Chicago':       { lat: 41.8781,  lng: -87.6298,  country: 'US', timezone: 'America/Chicago'     },
  'Houston':       { lat: 29.7604,  lng: -95.3698,  country: 'US', timezone: 'America/Chicago'     },
  'Phoenix':       { lat: 33.4484,  lng: -112.0740, country: 'US', timezone: 'America/Phoenix'     },
  'Philadelphia':  { lat: 39.9526,  lng: -75.1652,  country: 'US', timezone: 'America/New_York'    },
  'San Antonio':   { lat: 29.4241,  lng: -98.4936,  country: 'US', timezone: 'America/Chicago'     },
  'San Diego':     { lat: 32.7157,  lng: -117.1611, country: 'US', timezone: 'America/Los_Angeles' },
  'Dallas':        { lat: 32.7767,  lng: -96.7970,  country: 'US', timezone: 'America/Chicago'     },
  'San Jose':      { lat: 37.3382,  lng: -121.8863, country: 'US', timezone: 'America/Los_Angeles' },
  // ── USA — Tier 2 ──────────────────────────────────────────
  'Austin':        { lat: 30.2672,  lng: -97.7431,  country: 'US', timezone: 'America/Chicago'     },
  'Jacksonville':  { lat: 30.3322,  lng: -81.6557,  country: 'US', timezone: 'America/New_York'    },
  'Fort Worth':    { lat: 32.7555,  lng: -97.3308,  country: 'US', timezone: 'America/Chicago'     },
  'Columbus':      { lat: 39.9612,  lng: -82.9988,  country: 'US', timezone: 'America/New_York'    },
  'Charlotte':     { lat: 35.2271,  lng: -80.8431,  country: 'US', timezone: 'America/New_York'    },
  'Indianapolis':  { lat: 39.7684,  lng: -86.1581,  country: 'US', timezone: 'America/Indiana/Indianapolis' },
  'San Francisco': { lat: 37.7749,  lng: -122.4194, country: 'US', timezone: 'America/Los_Angeles' },
  'Seattle':       { lat: 47.6062,  lng: -122.3321, country: 'US', timezone: 'America/Los_Angeles' },
  'Denver':        { lat: 39.7392,  lng: -104.9903, country: 'US', timezone: 'America/Denver'      },
  'Nashville':     { lat: 36.1627,  lng: -86.7816,  country: 'US', timezone: 'America/Chicago'     },
  // ── USA — Tier 3 ──────────────────────────────────────────
  'Miami':         { lat: 25.7617,  lng: -80.1918,  country: 'US', timezone: 'America/New_York'    },
  'Atlanta':       { lat: 33.7490,  lng: -84.3880,  country: 'US', timezone: 'America/New_York'    },
  'Las Vegas':     { lat: 36.1699,  lng: -115.1398, country: 'US', timezone: 'America/Los_Angeles' },
  'Minneapolis':   { lat: 44.9778,  lng: -93.2650,  country: 'US', timezone: 'America/Chicago'     },
  'Boston':        { lat: 42.3601,  lng: -71.0589,  country: 'US', timezone: 'America/New_York'    },
  // ── France — Tier 1 ───────────────────────────────────────
  'Paris':         { lat: 48.8566,  lng: 2.3522,    country: 'FR', timezone: 'Europe/Paris'        },
  'Lyon':          { lat: 45.7640,  lng: 4.8357,    country: 'FR', timezone: 'Europe/Paris'        },
  'Marseille':     { lat: 43.2965,  lng: 5.3698,    country: 'FR', timezone: 'Europe/Paris'        },
  'Toulouse':      { lat: 43.6047,  lng: 1.4442,    country: 'FR', timezone: 'Europe/Paris'        },
  'Nice':          { lat: 43.7102,  lng: 7.2620,    country: 'FR', timezone: 'Europe/Paris'        },
  'Nantes':        { lat: 47.2184,  lng: -1.5536,   country: 'FR', timezone: 'Europe/Paris'        },
  'Montpellier':   { lat: 43.6108,  lng: 3.8767,    country: 'FR', timezone: 'Europe/Paris'        },
  'Strasbourg':    { lat: 48.5734,  lng: 7.7521,    country: 'FR', timezone: 'Europe/Paris'        },
  'Bordeaux':      { lat: 44.8378,  lng: -0.5792,   country: 'FR', timezone: 'Europe/Paris'        },
  'Lille':         { lat: 50.6292,  lng: 3.0573,    country: 'FR', timezone: 'Europe/Paris'        },
  'Rennes':        { lat: 48.1173,  lng: -1.6778,   country: 'FR', timezone: 'Europe/Paris'        },
  'Reims':         { lat: 49.2583,  lng: 4.0317,    country: 'FR', timezone: 'Europe/Paris'        },
  'Saint-Étienne': { lat: 45.4397,  lng: 4.3872,    country: 'FR', timezone: 'Europe/Paris'        },
  'Toulon':        { lat: 43.1242,  lng: 5.9280,    country: 'FR', timezone: 'Europe/Paris'        },
  'Grenoble':      { lat: 45.1885,  lng: 5.7245,    country: 'FR', timezone: 'Europe/Paris'        },
  'Dijon':         { lat: 47.3220,  lng: 5.0415,    country: 'FR', timezone: 'Europe/Paris'        },
  'Angers':        { lat: 47.4784,  lng: -0.5632,   country: 'FR', timezone: 'Europe/Paris'        },
  'Nîmes':         { lat: 43.8367,  lng: 4.3601,    country: 'FR', timezone: 'Europe/Paris'        },
  'Aix-en-Provence': { lat: 43.5297, lng: 5.4474,   country: 'FR', timezone: 'Europe/Paris'        },
  'Clermont-Ferrand': { lat: 45.7797, lng: 3.0863,  country: 'FR', timezone: 'Europe/Paris'        },
  // ── Belgique ──────────────────────────────────────────────
  'Bruxelles':     { lat: 50.8503,  lng: 4.3517,    country: 'BE', timezone: 'Europe/Brussels'     },
  'Liège':         { lat: 50.6326,  lng: 5.5797,    country: 'BE', timezone: 'Europe/Brussels'     },
  'Charleroi':     { lat: 50.4108,  lng: 4.4444,    country: 'BE', timezone: 'Europe/Brussels'     },
  'Namur':         { lat: 50.4673,  lng: 4.8719,    country: 'BE', timezone: 'Europe/Brussels'     },
  'Mons':          { lat: 50.4542,  lng: 3.9520,    country: 'BE', timezone: 'Europe/Brussels'     },
  'La Louvière':   { lat: 50.4784,  lng: 4.1869,    country: 'BE', timezone: 'Europe/Brussels'     },
  'Tournai':       { lat: 50.6056,  lng: 3.3881,    country: 'BE', timezone: 'Europe/Brussels'     },
};
