import { requiredSecret } from '../../../lib/security';
import prisma from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

/**
 * LGPD - Direito ao Esquecimento / Exclusão de Conta
 */
export default async function handler(req, res) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, requiredSecret('JWT_SECRET'));

    // Remove usuário e seus endereços em cascata conforme LGPD
    await prisma.user.delete({
      where: { id: decoded.id },
    });

    return res.status(200).json({
      success: true,
      message: 'Conta e dados pessoais excluídos com sucesso em conformidade com a LGPD.',
    });
  } catch (error) {
    console.error('[AUTH DELETE LGPD] Erro:', error);
    return res.status(500).json({ error: 'Falha ao excluir conta.' });
  }
}
