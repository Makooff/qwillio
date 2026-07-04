/**
 * Autofix routes — gateway for the Claude scheduled task + user approval flow.
 *
 * Endpoints:
 *   GET  /api/autofix/errors?since=X        — Claude pulls recent errors (token auth)
 *   POST /api/autofix/propose                — Claude submits a proposed fix (token auth)
 *   GET  /api/autofix/approve/:id            — User approves via Discord link (no auth, id is the token)
 *   GET  /api/autofix/reject/:id             — User rejects via Discord link
 *   GET  /api/autofix/list?status=approved   — Claude polls approved fixes to apply (token auth)
 *   POST /api/autofix/:id/mark-applied       — Claude reports a fix was applied (token auth)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getLogs, getLastId } from '../config/log-store';
import { proposeFix, getFix, updateStatus, listFixes } from '../config/autofix-store';
import { logger } from '../config/logger';
import { discordService } from '../services/discord.service';

const router = Router();

// ─── Token middleware (for Claude-side endpoints) ─────────────────────────
function requireAutofixToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.header('X-Autofix-Token');
  const expected = process.env.AUTOFIX_TOKEN;
  if (!expected) {
    res.status(503).json({ error: 'AUTOFIX_TOKEN not configured on server' });
    return;
  }
  if (token !== expected) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }
  next();
}

// ─── Claude-side: fetch recent errors ─────────────────────────────────────
router.get('/errors', requireAutofixToken, (req: Request, res: Response) => {
  const since = req.query.since ? parseInt(req.query.since as string) : undefined;
  res.json({
    errors: getLogs({ since, level: 'error', limit: 100 }),
    lastId: getLastId(),
  });
});

// ─── Claude-side: submit a proposed fix ───────────────────────────────────
router.post('/propose', requireAutofixToken, async (req: Request, res: Response) => {
  const { errorFingerprint, errorMessage, errorStack, riskLevel, title, filePath, diff, reasoning } = req.body;

  if (!errorFingerprint || !errorMessage || !title || !reasoning || !riskLevel) {
    res.status(400).json({ error: 'missing required fields' });
    return;
  }

  const fix = proposeFix({
    errorFingerprint,
    errorMessage,
    errorStack,
    riskLevel,
    title,
    filePath,
    diff,
    reasoning,
  });

  // Build approval URLs
  const base = process.env.PUBLIC_BASE_URL || 'https://qwillio.onrender.com';
  const approveUrl = `${base}/api/autofix/approve/${fix.id}`;
  const rejectUrl = `${base}/api/autofix/reject/${fix.id}`;

  // Notify Discord (skip if this is a duplicate of an existing pending fix)
  const isNew = fix.createdAt.getTime() === fix.updatedAt.getTime();
  if (isNew) {
    const riskEmoji = { low: '🟢', medium: '🟡', high: '🔴' }[fix.riskLevel];
    const diffPreview = (diff ?? '').split('\n').slice(0, 20).join('\n');
    const content = [
      `🔧 **Fix proposé** ${riskEmoji} \`${fix.riskLevel}\``,
      `**${fix.title}**`,
      fix.filePath ? `📄 \`${fix.filePath}\`` : '',
      '',
      '**Raison**:',
      fix.reasoning.slice(0, 400),
      '',
      diffPreview ? '```diff\n' + diffPreview.slice(0, 900) + '\n```' : '',
      `✅ Approve: ${approveUrl}`,
      `❌ Reject: ${rejectUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    await discordService.notify(content.slice(0, 1990), 'alerts');
  }

  res.json({ id: fix.id, isNew, approveUrl, rejectUrl });
});

// ─── User-side: approve via browser (link in Discord) ─────────────────────
router.get('/approve/:id', async (req: Request, res: Response) => {
  const fix = getFix(req.params.id as string);
  if (!fix) {
    res.status(404).send('<h2>Fix not found or expired</h2>');
    return;
  }
  if (fix.status !== 'pending') {
    res.send(`<h2>Already ${fix.status}</h2><p>Nothing to do.</p>`);
    return;
  }

  updateStatus(fix.id, 'approved', 'user');
  logger.info(`✅ Fix approved by user: ${fix.title}`);
  await discordService.notify(`✅ **Fix approuvé**: ${fix.title}\nSera appliqué à la prochaine run Claude.`, 'alerts');

  res.send(`
    <html>
      <head><title>Fix approved</title>
        <style>body { font-family: system-ui; background: #0a0a0a; color: white; text-align: center; padding: 80px; }
        .box { max-width: 500px; margin: auto; background: #161616; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); }
        h2 { color: #22c55e; } p { color: rgba(255,255,255,0.6); }</style>
      </head>
      <body>
        <div class="box">
          <h2>✅ Fix approved</h2>
          <p><strong>${escapeHtml(fix.title)}</strong></p>
          <p>Claude will apply it on the next scheduled run (within 1 hour).</p>
        </div>
      </body>
    </html>
  `);
});

// ─── User-side: reject via browser ────────────────────────────────────────
router.get('/reject/:id', async (req: Request, res: Response) => {
  const fix = getFix(req.params.id as string);
  if (!fix) {
    res.status(404).send('<h2>Fix not found or expired</h2>');
    return;
  }
  if (fix.status !== 'pending') {
    res.send(`<h2>Already ${fix.status}</h2>`);
    return;
  }

  updateStatus(fix.id, 'rejected', 'user');
  logger.info(`❌ Fix rejected by user: ${fix.title}`);
  await discordService.notify(`❌ **Fix rejeté**: ${fix.title}`, 'alerts');

  res.send(`
    <html>
      <head><title>Fix rejected</title>
        <style>body { font-family: system-ui; background: #0a0a0a; color: white; text-align: center; padding: 80px; }
        .box { max-width: 500px; margin: auto; background: #161616; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); }
        h2 { color: #ef4444; } p { color: rgba(255,255,255,0.6); }</style>
      </head>
      <body>
        <div class="box">
          <h2>❌ Fix rejected</h2>
          <p><strong>${escapeHtml(fix.title)}</strong></p>
          <p>This fix will not be applied.</p>
        </div>
      </body>
    </html>
  `);
});

// ─── Claude-side: list fixes by status ────────────────────────────────────
router.get('/list', requireAutofixToken, (req: Request, res: Response) => {
  const status = req.query.status as any;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  res.json({ fixes: listFixes({ status, limit }) });
});

// ─── Claude-side: mark a fix as applied ───────────────────────────────────
router.post('/:id/mark-applied', requireAutofixToken, (req: Request, res: Response) => {
  const fix = updateStatus(req.params.id as string, 'applied', 'claude');
  if (!fix) {
    res.status(404).json({ error: 'fix not found' });
    return;
  }
  res.json({ ok: true, fix });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export default router;
