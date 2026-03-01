import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

export const prospectQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  businessType: z.string().optional(),
  city: z.string().optional(),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
  search: z.string().optional(),
  sortBy: z.string().default('score'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['email', 'sms', 'mixed']).default('email'),
  targetBusinessTypes: z.array(z.string()).optional(),
  targetCities: z.array(z.string()).optional(),
  targetMinScore: z.number().optional(),
  targetMaxScore: z.number().optional(),
  targetStatuses: z.array(z.string()).optional(),
  subjectLine: z.string().optional(),
  messageTemplate: z.string().min(1),
  scheduledDate: z.string().datetime().optional(),
});

export const updateSettingsSchema = z.object({
  callsPerDay: z.number().min(1).max(200).optional(),
  automationStartHour: z.number().min(0).max(23).optional(),
  automationEndHour: z.number().min(0).max(23).optional(),
  automationDays: z.array(z.number().min(0).max(6)).optional(),
});

// ═══════════════════════════════════════════════════════════
// EMAIL VALIDATION & NORMALIZATION
// ═══════════════════════════════════════════════════════════

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const COMMON_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmal.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
};

/**
 * Normalize and clean an email address extracted from a call transcript.
 * Lowercases, trims, fixes common domain typos.
 */
export function normalizeEmail(email: string): string {
  let normalized = email.toLowerCase().trim();
  // Remove surrounding quotes, brackets, angle brackets
  normalized = normalized.replace(/^[<"'\[({]+|[>"'\])}\s.]+$/g, '');
  // Fix common domain typos
  const atIndex = normalized.indexOf('@');
  if (atIndex > 0) {
    const domain = normalized.substring(atIndex + 1);
    if (COMMON_TYPOS[domain]) {
      normalized = normalized.substring(0, atIndex + 1) + COMMON_TYPOS[domain];
    }
  }
  return normalized;
}

/**
 * Validate email format. Returns true if email looks valid.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) return false;
  if (!EMAIL_REGEX.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain.includes('.')) return false;
  const tld = domain.split('.').pop() || '';
  if (tld.length < 2) return false;
  return true;
}

/**
 * Extract email from a raw string that might contain surrounding text.
 * Useful for parsing SMS replies like "my email is john@example.com thanks"
 */
export function extractEmailFromText(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? normalizeEmail(match[0]) : null;
}
