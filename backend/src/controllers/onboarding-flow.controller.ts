import { Request, Response } from 'express';
import { onboardingFlowService } from '../services/onboarding-flow.service';

export class OnboardingFlowController {

  // GET /api/onboarding/:clientId/form
  // Returns the onboarding form template based on industry + package
  async getFormTemplate(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const { prisma } = await import('../config/database');

      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      // Verify token
      const token = req.query.token as string;
      if (!token || client.dashboardToken !== token) {
        return res.status(403).json({ error: 'Invalid access token' });
      }

      const template = onboardingFlowService.getOnboardingFormTemplate(
        client.businessType,
        client.planType
      );

      res.json({
        client: {
          id: client.id,
          businessName: client.businessName,
          businessType: client.businessType,
          planType: client.planType,
          contactName: client.contactName,
          onboardingFormDoneAt: client.onboardingFormDoneAt,
        },
        template,
        existingData: client.onboardingData || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/onboarding/:clientId/form
  // Submit the completed onboarding form
  async submitForm(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const token = req.query.token as string || req.body.token;

      if (!token) return res.status(403).json({ error: 'Token required' });

      const result = await onboardingFlowService.submitOnboardingForm(
        clientId,
        token,
        req.body.formData
      );

      res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid token') {
        return res.status(403).json({ error: 'Invalid access token' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/onboarding/:clientId/add-ons
  // Get available add-ons for the client's plan
  async getAddOns(req: Request, res: Response) {
    try {
      const { clientId } = req.params;
      const { prisma } = await import('../config/database');

      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return res.status(404).json({ error: 'Client not found' });

      const addOns = onboardingFlowService.getAvailableAddOns(client.planType);
      const activeAddOns = (client.addOns as any) || {};

      res.json({
        available: addOns,
        active: activeAddOns,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/onboarding/:clientId/add-ons/:addOnId
  // Activate an add-on for the client
  async activateAddOn(req: Request, res: Response) {
    try {
      const { clientId, addOnId } = req.params;
      const result = await onboardingFlowService.activateAddOn(clientId, addOnId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const onboardingFlowController = new OnboardingFlowController();
