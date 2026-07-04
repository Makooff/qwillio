import { Router, Request, Response } from 'express';
import { clientsController } from '../controllers/clients.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { stripe } from '../config/stripe';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', (req, res) => clientsController.list(req, res));
router.get('/stats', (req, res) => clientsController.getStats(req, res));
router.get('/:id', (req, res) => clientsController.getById(req, res));
router.put('/:id', (req, res) => clientsController.update(req, res));

// POST /api/clients/:id/retry-payment — retry the latest open Stripe invoice
router.post('/:id/retry-payment', async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true, businessName: true },
    });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    if (!client.stripeCustomerId) {
      res.status(400).json({ error: 'Client has no Stripe customer' });
      return;
    }

    // Find the latest open/uncollectible invoice
    const invoices = await stripe.invoices.list({
      customer: client.stripeCustomerId,
      status: 'open',
      limit: 1,
    });

    if (invoices.data.length === 0) {
      res.status(400).json({ error: 'No open invoice found for this client' });
      return;
    }

    const invoice = invoices.data[0];
    await stripe.invoices.pay(invoice.id);

    logger.info(`[API] Retried payment for client ${client.businessName} (invoice: ${invoice.id})`);
    res.json({ success: true, invoiceId: invoice.id });
  } catch (err: any) {
    logger.error(`[API] retry-payment failed for client ${id}:`, err);
    res.status(500).json({ error: err.message ?? 'Payment retry failed' });
  }
});

export default router;
