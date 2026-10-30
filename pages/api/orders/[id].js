import jwt from 'jsonwebtoken';
import prisma from '../../../lib/prisma';
import { requiredSecret, session } from '../../../lib/security';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  let capability = null;
  let actor = null;
  try {
    if (typeof req.query.access === 'string') {
      capability = jwt.verify(req.query.access, requiredSecret('JWT_SECRET'), { algorithms: ['HS256'] });
      if (typeof capability.orderId !== 'string') return res.status(401).json({ error: 'Acesso ao pedido inválido.' });
    } else if (req.headers.authorization) {
      const decoded = session(req);
      if (typeof decoded.id !== 'string') return res.status(401).json({ error: 'Sessão inválida.' });
      actor = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, role: true } });
      if (!actor) return res.status(401).json({ error: 'Sessão inválida.' });
    } else return res.status(401).json({ error: 'Entre na sua conta ou abra o acompanhamento neste navegador usado na compra.' });
  } catch { return res.status(401).json({ error: 'Acesso expirado ou inválido. Consulte o atendimento.' }); }
  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: String(req.query.id) }, { orderNumber: String(req.query.id) }] },
      select: { id: true, userId: true, orderNumber: true, paymentStatus: true, paymentMethod: true, total: true, trackingCode: true, createdAt: true },
    });
    if (!order || !(capability?.orderId === order.id || actor?.role === 'ADMIN' || (actor && order.userId === actor.id))) return res.status(404).json({ error: 'Pedido não encontrado para este acesso.' });
    const { userId, ...details } = order;
    return res.status(200).json(details);
  } catch { return res.status(503).json({ error: 'Não foi possível consultar o pedido. Tente novamente.' }); }
}
