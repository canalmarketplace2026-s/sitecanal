import prisma from './prisma';
import { session } from './security';

export async function requireAdmin(req) {
  let identity;
  try { identity = session(req); } catch { throw Object.assign(new Error('Entre com uma conta administrativa.'), { status: 401 }); }
  if (typeof identity.id !== 'string') throw Object.assign(new Error('Sessão inválida.'), { status: 401 });
  const actor = await prisma.user.findUnique({ where: { id: identity.id }, select: { id: true, role: true } });
  if (actor?.role !== 'ADMIN') throw Object.assign(new Error('Acesso administrativo necessário.'), { status: 403 });
  return actor;
}
