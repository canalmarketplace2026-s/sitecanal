import prisma from '../../../../lib/prisma';
import { session } from '../../../../lib/security';
const { shippingAction } = require('../../../../lib/shipping.cjs');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const identity = session(req);
    if (typeof identity.id !== 'string') return res.status(401).json({ error: 'Sessão inválida.' });
    const user = await prisma.user.findUnique({ where: { id: identity.id }, select: { role: true } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: 'Esta operação requer uma conta administradora.' });
  } catch { return res.status(401).json({ error: 'Entre com uma conta administradora.' }); }
  try {
    const result = await shippingAction(prisma, String(req.query.id), req.method === 'GET' ? { action: 'status' } : req.body);
    return res.json(result);
  } catch (error) { return res.status(error.status || 503).json({ error: error.status ? error.message : 'Não foi possível concluir a operação de envio.' }); }
}
