import Stripe from 'stripe';
import { env } from './env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_00000000000000000000000000000000', {
  apiVersion: '2024-12-18.acacia' as any,
  typescript: true,
});
