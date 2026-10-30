import prisma from '../../../lib/prisma';
import { requiredSecret, sameSecret } from '../../../lib/security';
const { processPaymentWebhook } = require('../../../lib/payments.cjs');
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  let expected;
  try { expected = requiredSecret('ASAAS_WEBHOOK_TOKEN'); } catch { return res.status(503).json({ error: 'Webhook ainda não configurado.' }); }
  if (!sameSecret(req.headers['asaas-access-token'], expected)) return res.status(401).end();
  const { event, payment } = req.body || {};
  if (typeof event !== 'string' || !event.startsWith('PAYMENT_') || !payment?.id) return res.status(400).json({ error: 'Evento inválido.' });
  try {
    const action = await processPaymentWebhook(prisma, req.body);
    return res.status(200).json({ received: true, action });
  } catch { return res.status(503).json({ error: 'Evento não processado; reenviar.' }); }
}
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
