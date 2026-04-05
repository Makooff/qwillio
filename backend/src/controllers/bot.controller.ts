import { Request, Response } from 'express';
import { botLoop } from '../jobs/bot-loop';
import { vapiService } from '../services/vapi.service';
import { apifyScrapingService } from '../services/apify-scraping.service';
import { logger } from '../config/logger';

export class BotController {
  async start(_req: Request, res: Response) {
    try {
      await botLoop.start();
      const status = await botLoop.getStatus();
      logger.info('Bot started via API');
      // Launch immediate scraping in background (non-blocking)
      setImmediate(() => apifyScrapingService.runScraping().catch((err) => logger.error('Immediate scraping error:', err)));
      res.json({ message: 'Bot démarré avec succès', status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async stop(_req: Request, res: Response) {
    try {
      await botLoop.stop();
      const status = await botLoop.getStatus();
      logger.info('Bot stopped via API');
      res.json({ message: 'Bot arrêté', status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStatus(_req: Request, res: Response) {
    try {
      const status = await botLoop.getStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async triggerProspection(_req: Request, res: Response) {
    try {
      const count = await botLoop.triggerProspection();
      res.json({ message: `Prospection terminée: ${count} prospects ajoutés`, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async triggerCall(_req: Request, res: Response) {
    try {
      const result = await botLoop.triggerCall();
      res.json({ message: result ? 'Appel lancé' : 'Aucun appel possible', success: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async triggerTestCall(req: Request, res: Response) {
    try {
      const { phoneNumber, businessName, businessType, city } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber is required' });
      }
      const result = await vapiService.testCall(
        phoneNumber,
        businessName || 'Mario\'s Pizzeria',
        businessType || 'restaurant',
        city || 'New York',
      );
      res.json({
        message: `Test call started to ${phoneNumber} as "${businessName || "Mario's Pizzeria"}"`,
        vapiCallId: result.id,
        success: true,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async simulateCallResult(req: Request, res: Response) {
    try {
      const { transcript, businessName, businessType, city, durationSeconds } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: 'transcript is required' });
      }
      const result = await vapiService.simulateCallResult(
        transcript,
        businessName || 'Test Business',
        businessType || 'restaurant',
        city || 'New York',
        durationSeconds || 120,
      );
      res.json({
        message: `Call simulation completed for "${businessName}"`,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async triggerReminders(_req: Request, res: Response) {
    try {
      const count = await botLoop.triggerReminders();
      res.json({ message: `${count} relances traitées`, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async triggerNicheLearning(_req: Request, res: Response) {
    try {
      const count = await botLoop.triggerNicheLearning();
      res.json({ message: `Niche learning aggregation complete: ${count} niches processed`, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ─── Bot Control Panel manual run endpoints ───────────────

  async runProspecting(_req: Request, res: Response) {
    try {
      const count = await botLoop.runProspecting();
      res.json({ message: `Prospecting run complete: ${count} prospects scraped`, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async runScoring(_req: Request, res: Response) {
    try {
      const count = await botLoop.runScoring();
      res.json({ message: `Scoring run complete: ${count} prospects scored`, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async runCalling(_req: Request, res: Response) {
    try {
      const result = await botLoop.runCalling();
      res.json({ message: result ? 'Outbound call initiated' : 'No eligible prospect found', success: !!result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async runFollowUp(_req: Request, res: Response) {
    try {
      const count = await botLoop.runFollowUp();
      res.json({ message: `Follow-up run complete: ${count} sequences processed`, count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const botController = new BotController();
