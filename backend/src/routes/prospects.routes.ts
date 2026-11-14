import { Router, Response } from 'express';
import { prospectsController } from '../controllers/prospects.controller';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prospectWorkbenchService, savedSearchService } from '../services/prospect-workbench.service';
import { logger } from '../config/logger';
import { outreachService, type OutreachRequest } from '../services/outreach.service';
import { callListService } from '../services/call-list.service';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Saved searches ───────────────────────────────────────
// Declared before `/:id`, otherwise "saved-searches" is swallowed as an id.

router.get('/saved-searches', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    res.json(await savedSearchService.list(req.userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saved-searches', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    const saved = await savedSearchService.save(req.userId, req.body?.name, req.body?.filters || {});
    if (!saved) return res.status(400).json({ error: 'name_required' });
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/saved-searches/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    const updated = await savedSearchService.setProgress(
      req.userId,
      String(req.params.id),
      req.body?.lastProspectId ? String(req.body.lastProspectId) : null,
    );
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/saved-searches/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Non authentifié' });
    const gone = await savedSearchService.remove(req.userId, String(req.params.id));
    if (!gone) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mails et SMS envoyés à la main ───────────────────────
// Déclarés avant `/:id`, pour la même raison que les recherches sauvegardées.

function outreachRequest(body: any): OutreachRequest {
  const b = body && typeof body === 'object' ? body : {};
  return {
    channel: b.channel === 'sms' ? 'sms' : 'email',
    templateId: String(b.templateId || ''),
    prospectId: b.prospectId ? String(b.prospectId) : null,
    to: typeof b.to === 'string' ? b.to : null,
    vars: b.vars && typeof b.vars === 'object' ? b.vars : {},
    sender: b.sender && typeof b.sender === 'object' ? b.sender : { prenom: '' },
    fromKey: typeof b.fromKey === 'string' ? b.fromKey : null,
    accord: b.accord === true,
  };
}

router.get('/outreach/templates', (_req: AuthRequest, res: Response) => {
  res.json(outreachService.templates());
});

router.post('/outreach/preview', async (req: AuthRequest, res: Response) => {
  try {
    res.json(await outreachService.preview(outreachRequest(req.body)));
  } catch (err: any) {
    logger.error('[prospects] outreach preview failed', err);
    res.status(500).json({ error: 'preview_failed' });
  }
});

router.post('/outreach/send', async (req: AuthRequest, res: Response) => {
  try {
    const result = await outreachService.send(outreachRequest(req.body));
    if (!result.ok) {
      const status = result.error === 'send_failed' || result.error === 'sms_unavailable' ? 502 : 400;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (err: any) {
    logger.error('[prospects] outreach send failed', err);
    res.status(500).json({ ok: false, error: 'send_failed' });
  }
});

// ─── La liste d'appels et son journal ─────────────────────
// `/call-list` et `/call-list/stats` avant `/:id`, sinon ils sont pris pour un identifiant.

router.get('/call-list', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ data: await callListService.list() });
  } catch (err: any) {
    logger.error('[prospects] call list failed', err);
    res.status(500).json({ error: 'call_list_failed' });
  }
});

router.get('/call-list/stats', async (req: AuthRequest, res: Response) => {
  try {
    res.json(await callListService.stats(Number(req.query.days) || 30));
  } catch (err: any) {
    logger.error('[prospects] call stats failed', err);
    res.status(500).json({ error: 'call_stats_failed' });
  }
});

// ─── Prospects ────────────────────────────────────────────

router.get('/', (req, res) => prospectsController.list(req, res));
router.get('/stats', (req, res) => prospectsController.getStats(req, res));
router.get('/:id', (req, res) => prospectsController.getById(req, res));
router.put('/:id', (req, res) => prospectsController.update(req, res));
router.patch('/:id/favorite', (req, res) => prospectsController.setFavorite(req, res));
router.delete('/:id', (req, res) => prospectsController.delete(req, res));

/** Ajoute la fiche à la liste d'appels, ou l'en retire. */
router.post('/:id/call-list', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await callListService.setInList(String(req.params.id), req.body?.inList !== false);
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err: any) {
    logger.error('[prospects] call list toggle failed', err);
    res.status(500).json({ error: 'call_list_failed' });
  }
});

router.get('/:id/call-logs', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ data: await callListService.logs(String(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ error: 'call_logs_failed' });
  }
});

/** Consigne un appel passé à la main: l'issue, l'objection, la note. */
router.post('/:id/call-logs', async (req: AuthRequest, res: Response) => {
  try {
    const result = await callListService.log(String(req.params.id), req.userId ?? null, req.body || {});
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result);
  } catch (err: any) {
    logger.error('[prospects] call log failed', err);
    res.status(500).json({ error: 'call_log_failed' });
  }
});

/** Everything worth reading before dialling. */
router.get('/:id/brief', async (req: AuthRequest, res: Response) => {
  try {
    const brief = await prospectWorkbenchService.brief(String(req.params.id));
    if (!brief) return res.status(404).json({ error: 'not_found' });
    res.json(brief);
  } catch (err: any) {
    logger.error('[prospects] brief failed', err);
    res.status(500).json({ error: err.message });
  }
});

/** The sales script for this business. Generated once, then read for free. */
router.post('/:id/script', async (req: AuthRequest, res: Response) => {
  try {
    const refresh = req.query.refresh === 'true';
    const result = await prospectWorkbenchService.script(String(req.params.id), refresh);
    if (!result) return res.status(404).json({ error: 'not_found' });
    res.json(result);
  } catch (err: any) {
    logger.error('[prospects] script failed', err);
    res.status(500).json({ error: err.message });
  }
});

/** The founder dialled this business himself. */
router.post('/:id/touch', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await prospectWorkbenchService.markContacted(String(req.params.id));
    if (!updated) return res.status(404).json({ error: 'not_found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Prospect → customer, once the call went well. */
router.post('/:id/convert', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prospectWorkbenchService.convert(String(req.params.id), req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, clientId: (result as any).clientId });
    }
    res.status(201).json({ success: true, clientId: result.client.id, client: result.client });
  } catch (err: any) {
    logger.error('[prospects] convert failed', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
