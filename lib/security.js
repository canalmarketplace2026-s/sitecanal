import { timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';

export function requiredSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 32 || /canal_.*2026/.test(value)) throw new Error(`${name} precisa ser configurado com um segredo exclusivo.`);
  return value;
}
export function sameSecret(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length > 0 && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function session(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new Error('Não autenticado.');
  return jwt.verify(token, requiredSecret('JWT_SECRET'), { algorithms: ['HS256'] });
}
