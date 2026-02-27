import { Router } from 'express';
import { onboardingFlowController } from '../controllers/onboarding-flow.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════
// ONBOARDING ROUTES - Public API for client onboarding forms
// Auth via dashboard token (sent in the welcome email)
// ═══════════════════════════════════════════════════════════

// Get onboarding form template (industry + package specific)
router.get('/:clientId/form', (req, res) => onboardingFlowController.getFormTemplate(req, res));

// Submit completed onboarding form
router.post('/:clientId/form', (req, res) => onboardingFlowController.submitForm(req, res));

// Get available add-ons
router.get('/:clientId/add-ons', (req, res) => onboardingFlowController.getAddOns(req, res));

// Activate an add-on
router.post('/:clientId/add-ons/:addOnId', (req, res) => onboardingFlowController.activateAddOn(req, res));

export default router;
