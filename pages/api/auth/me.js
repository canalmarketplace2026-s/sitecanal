import { requiredSecret } from '../../../lib/security';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, requiredSecret('JWT_SECRET'));
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        phone: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paymentStatus: true,
            createdAt: true,
            trackingCode: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(401).json({ error: 'Sessão expirada ou token inválido' });
  }
}
