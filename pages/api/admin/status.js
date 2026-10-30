import prisma from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/admin';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    await requireAdmin(req);
    const lastSync = await prisma.syncLog.findFirst({ orderBy: { startedAt: 'desc' } });
    return res.json({ checkoutEnabled: process.env.CHECKOUT_ENABLED === 'true',
      configured: { tiny: Boolean(process.env.TINY_API_TOKEN), asaas: Boolean(process.env.ASAAS_API_KEY), melhorEnvio: Boolean(process.env.MELHOR_ENVIO_TOKEN) },
      environment: { asaas: process.env.ASAAS_API_URL?.includes('sandbox') ? 'testes' : 'produção', melhorEnvio: process.env.MELHOR_ENVIO_SANDBOX === 'true' ? 'testes' : 'produção' },
      lastSync: lastSync ? { status: lastSync.status, startedAt: lastSync.startedAt, completedAt: lastSync.completedAt, itemsSynced: lastSync.itemsSynced, itemsFailed: lastSync.itemsFailed } : null });
  } catch (error) { return res.status(error.status || 503).json({ error: error.status ? error.message : 'Não foi possível consultar o estado das integrações.' }); }
}
