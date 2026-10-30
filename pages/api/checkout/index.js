const { refreshCartStock } = require('../../../lib/tiny-catalog.cjs');
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../../../lib/prisma';
import { requiredSecret, session } from '../../../lib/security';
import { resolveCart } from '../../../lib/catalog';
import { calculateShipping } from '../../../lib/melhor-envio';
const payments = require('../../../lib/payments.cjs');

function validInput(body) {
  const { customer: c, shippingAddress: a, paymentMethod, checkoutKey } = body || {};
  const count = paymentMethod === 'CREDIT_CARD' ? Number(body.installments || 1) : 1;
  return ['PIX', 'CREDIT_CARD'].includes(paymentMethod) && Number.isInteger(count) && count >= 1 && count <= 12 && /^[a-zA-Z0-9-]{32,80}$/.test(checkoutKey || '') && ['name', 'email', 'cpf', 'phone'].every(key => typeof c?.[key] === 'string') && c.name.trim().length >= 2 && c.name.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '') && /^\d{11}$/.test(String(c.cpf || '').replace(/\D/g, '')) && /^\d{10,11}$/.test(String(c.phone || '').replace(/\D/g, '')) && ['street', 'number', 'city', 'district'].every(key => typeof a?.[key] === 'string' && a[key].trim() && a[key].length < 200) && /^[A-Z]{2}$/.test(a.state || '') && /^\d{8}$/.test(String(a.cep || '').replace(/\D/g, ''));
}
async function receipt(res, order, secret, status = 200) {
  const result = await payments.paymentReceipt(prisma, order);
  const orderAccessToken = jwt.sign({ orderId: order.id }, secret, { algorithm: 'HS256', expiresIn: '30d' });
  return res.status(status).json({ success: true, ...result, orderAccessToken });
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (process.env.CHECKOUT_ENABLED !== 'true') return res.status(503).json({ error: 'A loja está em preparação. Compras serão liberadas em breve.' });
  if (!validInput(req.body)) return res.status(400).json({ error: 'Confira os dados pessoais, endereço e pagamento.' });
  const body = req.body;
  const { customer: c, shippingAddress: a, items, paymentMethod, shippingMethod, checkoutKey, expectedTotal } = body;
  let savedOrder;
  let accessSecret;
  try {
    payments.assertPaymentConfigured();
    accessSecret = requiredSecret('JWT_SECRET');
    requiredSecret('ASAAS_WEBHOOK_TOKEN');
    let userId = null;
    if (req.headers.authorization) {
      let claims;
      try { claims = session(req); } catch { return res.status(401).json({ error: 'Entre novamente na sua conta.' }); }
      if (typeof claims.id !== 'string') return res.status(401).json({ error: 'Sessão inválida.' });
      const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { id: true } });
      if (!user) return res.status(401).json({ error: 'Conta não encontrada.' });
      userId = user.id;
    }
    const fingerprint = payments.checkoutFingerprint(body);
    const existing = await prisma.order.findUnique({ where: { checkoutKey } });
    if (existing) {
      if (existing.checkoutFingerprint !== fingerprint) return res.status(409).json({ error: 'Este pedido já foi enviado com outros dados. Acompanhe o pedido original antes de iniciar uma nova compra.' });
      savedOrder = existing;
      // An idempotent replay only reads/retrieves the provider. It never creates another charge.
      let recovered = existing;
      try { recovered = await payments.recoverOrderPayment(prisma, existing.id); } catch { /* Return the durable order, even during a provider outage. */ }
      return receipt(res, recovered, accessSecret);
    }
    await refreshCartStock(prisma, items);
    const { products, subtotal } = await resolveCart(prisma, items);
    const quotes = await calculateShipping({ destinationCep: a.cep, subtotal, items: products });
    const shipping = quotes.find(q => String(q.id) === String(shippingMethod?.id));
    if (!shipping) return res.status(400).json({ error: 'Selecione uma entrega válida.' });
    if (Math.round(Number(shippingMethod.price) * 100) !== Math.round(shipping.price * 100)) return res.status(409).json({ error: 'O frete mudou. Calcule novamente para confirmar.' });
    const discount = paymentMethod === 'PIX' ? Math.round(subtotal * 10) / 100 : 0;
    const total = Math.round((subtotal - discount + shipping.price) * 100) / 100;
    if (typeof expectedTotal !== 'number' || !Number.isFinite(expectedTotal) || Math.round(expectedTotal * 100) !== Math.round(total * 100)) return res.status(409).json({ error: 'Os valores mudaram. Atualize o carrinho e confirme o novo total.' });
    const installments = paymentMethod === 'CREDIT_CARD' ? Number(body.installments || 1) : 1;
    const paymentDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    savedOrder = await prisma.$transaction(async tx => {
      const current = await resolveCart(tx, items);
      if (current.subtotal !== subtotal) throw new Error('Preços alterados.');
      for (const product of current.products) await tx.product.update({ where: { id: product.id }, data: { reservedStock: { increment: product.quantity } } });
      return tx.order.create({ data: {
        orderNumber: `CNL-${randomUUID()}`, checkoutKey, checkoutFingerprint: fingerprint, userId,
        customerName: c.name.trim(), customerEmail: c.email.trim().toLowerCase(), customerPhone: c.phone.replace(/\D/g, ''), customerCpf: c.cpf.replace(/\D/g, ''),
        shippingCep: a.cep.replace(/\D/g, ''), shippingStreet: a.street.trim(), shippingNum: a.number.trim(), shippingComp: typeof a.complement === 'string' ? a.complement.trim().slice(0, 200) : '', shippingDist: a.district.trim(), shippingCity: a.city.trim(), shippingState: a.state,
        subtotal, discount, shippingCost: shipping.price, shippingMethod: `${shipping.company} ${shipping.name}`, shippingQuote: shipping,
        total, installments, paymentMethod, paymentStatus: 'PROCESSING', paymentCreateState: 'NOT_STARTED', paymentDueDate,
        items: { create: current.products.map(p => ({ productId: p.id, sku: p.sku, tinyId: p.tinyId, name: p.name, price: p.price, quantity: p.quantity, image: p.image })) },
      } });
    }, { isolationLevel: 'Serializable' });
    let prepared = savedOrder;
    try { prepared = await payments.prepareOrderPayment(prisma, savedOrder.id); } catch { /* The receipt remains recoverable using the same checkoutKey. */ }
    return receipt(res, prepared, accessSecret, 201);
  } catch (error) {
    if (savedOrder && accessSecret) return receipt(res, savedOrder, accessSecret, 202);
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Este pedido já foi recebido. Toque novamente em continuar para recuperar o mesmo pedido, sem nova cobrança.' });
    return res.status(503).json({ error: 'Não foi possível concluir. Tente novamente com o mesmo carrinho para recuperar seu pedido com segurança.' });
  }
}
export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };
