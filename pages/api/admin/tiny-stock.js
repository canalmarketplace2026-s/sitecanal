import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/admin';
const { acknowledgeTinyStock } = require('../../../lib/tiny-orders.cjs');
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const actor = await requireAdmin(req);
    const { orderId, reference } = req.body || {};
    if (typeof orderId !== 'string' || typeof reference !== 'string') return res.status(400).json({ error: 'Informe pedido e referência da baixa confirmada no Tiny.' });
    const result = await acknowledgeTinyStock(prisma, orderId, `${actor.id}: ${reference}`);
    return res.json(result);
  } catch (error) { return res.status(error.status || 409).json({ error: error.status ? error.message : 'Confira se o pedido está pago, exportado e com baixa confirmada no Tiny.' }); }
}
