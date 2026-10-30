import { requiredSecret } from '../../../lib/security';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { name, email, password, cpf, phone, termsAccepted } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  if (!termsAccepted) {
    return res.status(400).json({ error: 'É necessário concordar com os Termos de Uso e Política de Privacidade (LGPD).' });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        cpf: cpf ? cpf.replace(/\D/g, '') : null,
        phone: phone ? phone.replace(/\D/g, '') : null,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
      },
    });

    const jwtSecret = requiredSecret('JWT_SECRET');
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('[AUTH REGISTER] Erro:', error);
    return res.status(500).json({ error: 'Falha ao criar conta.' });
  }
}
