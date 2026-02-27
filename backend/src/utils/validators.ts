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
