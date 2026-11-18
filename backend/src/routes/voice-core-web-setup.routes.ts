import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { voiceCoreAuth } from '../middleware/voice-core.middleware';
import { verifySetupTicket } from '../services/voice/web-setup-ticket';
import { logger } from '../config/logger';

const input = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().min(1).max(128),
  mode: z.enum(['config', 'onboarding']),
  setupTicket: z.string().min(1).max(2048),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000).refine((text) => text.trim().length > 0),
  }).strict()).min(1).max(24)
    .refine((messages) => messages[messages.length - 1]?.role === 'user')
    .refine((messages) => messages.reduce((size, message) => size + message.content.length, 0) <= 16000),
}).strict();
const limiter = rateLimit({
  windowMs: 60000, max: 20, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (_req, res) => `${res.locals.webSetup.clientId}:${res.locals.webSetup.sessionId}`,
  message: { error: 'web_setup_rate_limited' },
});
const router = Router();
router.use(voiceCoreAuth);
router.post('/chat', (req, res, next) => {
  const parsed = input.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_setup_input' });
  const { sessionId, clientId, mode, setupTicket } = parsed.data;
  try {
    verifySetupTicket(setupTicket, { sessionId, clientId, mode });
  } catch {
    return res.status(401).json({ error: 'invalid_setup_ticket' });
  }
  res.locals.webSetup = parsed.data;
  next();
}, limiter, async (_req, res) => {
  const { clientId, messages, mode } = res.locals.webSetup as z.infer<typeof input>;
  try {
    const { assistantChatService } = await import('../services/assistant-chat.service');
    const result = await assistantChatService.chat(clientId, messages, mode);
    return res.json({ reply: result.reply, configChanged: result.configChanged, completed: result.completed });
  } catch {
    logger.warn('[voice-core] web setup conversation unavailable');
    return res.status(502).json({ error: 'web_setup_unavailable' });
  }
});
export default router;
