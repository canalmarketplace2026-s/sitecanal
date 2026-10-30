import prisma from '../../../lib/prisma';
import { requiredSecret, sameSecret, session } from '../../../lib/security';
const { syncTiny } = require('../../../lib/tiny-sync.cjs');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado.' });
  let authorized = false;
  try { authorized = sameSecret(auth.slice(7), requiredSecret('CRON_SECRET')); } catch {}
  if (!authorized) {
    try {
      const identity = session(req);
      const user = await prisma.user.findUnique({ where: { id: identity.id }, select: { role: true } });
      authorized = user?.role === 'ADMIN';
    } catch {}
  }
  if (!authorized) return res.status(401).json({ error: 'Não autorizado.' });
  try {
    const result = await syncTiny(prisma);
    return res.status(result.busy ? 409 : result.success ? 200 : 207).json(result);
  } catch { return res.status(503).json({ error: 'Sincronização indisponível. Consulte o registro no banco.' }); }
}
