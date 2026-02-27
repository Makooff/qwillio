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
  'restaurant',
  'lodging',
  'beauty_salon',
  'spa',
  'gym',
  'doctor',
  'dentist',
  'veterinary_care',
  'lawyer',
  'car_repair',
  'car_dealer',
] as const;

export const GOOGLE_PLACES_TYPE_MAP: Record<string, string> = {
  restaurant: 'restaurant',
  lodging: 'hotel',
  beauty_salon: 'salon',
  spa: 'salon',
  gym: 'service',
  doctor: 'medical',
  dentist: 'dental',
  veterinary_care: 'medical',
  lawyer: 'law',
  car_repair: 'auto',
  car_dealer: 'auto',
};

// US Cities for prospection with +1 phone number
export const CITIES_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'Chicago': { lat: 41.8781, lng: -87.6298 },
  'Houston': { lat: 29.7604, lng: -95.3698 },
  'Miami': { lat: 25.7617, lng: -80.1918 },
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
};
