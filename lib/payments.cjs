const { createHash } = require('crypto');

const VALID_URLS = new Set(['https://api.asaas.com/v3', 'https://api-sandbox.asaas.com/v3']);
const PAID = new Set(['CONFIRMED', 'RECEIVED']);
class PaymentError extends Error {
  constructor(message, { definitive = false, code = 'PROVIDER_ERROR' } = {}) { super(message); this.definitive = definitive; this.code = code; }
}
function assertPaymentConfigured() {
  const url = process.env.ASAAS_API_URL;
  const key = process.env.ASAAS_API_KEY;
  if (!key || !VALID_URLS.has(url)) throw new PaymentError('Pagamentos indisponíveis.', { definitive: true, code: 'CONFIGURATION' });
  if ((key.startsWith('$aact_prod_') && url.includes('sandbox')) || (key.startsWith('$aact_hmlg_') && !url.includes('sandbox'))) throw new PaymentError('Ambiente de pagamento incompatível.', { definitive: true, code: 'CONFIGURATION' });
}
async function request(path, { method = 'GET', body, fetchImpl = fetch } = {}) {
  assertPaymentConfigured();
  let response;
  try {
    response = await fetchImpl(`${process.env.ASAAS_API_URL}${path}`, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', access_token: process.env.ASAAS_API_KEY, 'User-Agent': 'CanalMarketplace/1.0 (site@canalmarketplace.com.br)' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(65000) });
  } catch { throw new PaymentError('Não foi possível confirmar a comunicação com o pagamento.', { code: 'AMBIGUOUS_RESPONSE' }); }
  if (!response.ok) throw new PaymentError('O provedor não concluiu a solicitação de pagamento.', { definitive: response.status >= 400 && response.status < 500, code: `HTTP_${response.status}` });
  try { return await response.json(); } catch { throw new PaymentError('Resposta de pagamento inválida.', { code: 'AMBIGUOUS_RESPONSE' }); }
}
function clean(value) { return String(value || '').trim(); }
function checkoutFingerprint(body) {
  const aggregate = new Map();
  for (const item of body.items || []) {
    const key = clean(item.slug || item.id);
    aggregate.set(key, (aggregate.get(key) || 0) + Number(item.quantity ?? item.qty ?? 1));
  }
  const c = body.customer || {}, a = body.shippingAddress || {};
  const data = {
    customer: [clean(c.name), clean(c.email).toLowerCase(), clean(c.cpf).replace(/\D/g, ''), clean(c.phone).replace(/\D/g, '')],
    address: ['cep', 'street', 'number', 'complement', 'district', 'city', 'state'].map(key => key === 'cep' ? clean(a[key]).replace(/\D/g, '') : clean(a[key])),
    items: [...aggregate].sort((x, y) => x[0].localeCompare(y[0])),
    paymentMethod: body.paymentMethod,
    installments: body.paymentMethod === 'CREDIT_CARD' ? Number(body.installments || 1) : 1,
    service: String(body.shippingMethod?.id || ''), expectedTotal: body.expectedTotal,
  };
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
async function getOrCreateAsaasCustomer(data) {
  const cpf = clean(data.cpfCnpj).replace(/\D/g, '');
  const found = await request(`/customers?cpfCnpj=${encodeURIComponent(cpf)}&limit=2`);
  if (!Array.isArray(found.data)) throw new PaymentError('Cadastro de pagamento inválido.');
  if (found.data.length) return found.data[0];
  return request('/customers', { method: 'POST', body: { ...data, cpfCnpj: cpf, notificationDisabled: true } });
}
async function createCharge({ customerId, value, externalReference, paymentMethod, installments = 1, dueDate }) {
  const count = Number(installments);
  if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod) || !Number.isInteger(count) || count < 1 || count > 12 || (paymentMethod === 'PIX' && count !== 1)) throw new PaymentError('Pagamento inválido.', { definitive: true });
  const amounts = count > 1 ? { installmentCount: count, totalValue: value } : { value };
  return request('/payments', { method: 'POST', body: { customer: customerId, billingType: paymentMethod, ...amounts, dueDate: dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10), externalReference, description: `Pedido ${externalReference} - Canal Marketplace` } });
}
async function getPixQrCode(id) {
  const qr = await request(`/payments/${encodeURIComponent(id)}/pixQrCode`);
  return { pixQrCode: qr.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : null, pixCopiaECola: qr.payload || null, expiresAt: qr.expirationDate || null };
}
function cents(value) { return Math.round(Number(value) * 100); }
function assertMatches(order, payments) {
  if (!Array.isArray(payments) || payments.length !== (order.installments || 1)) throw new PaymentError('Quantidade de cobranças divergente.', { code: 'PAYMENT_MISMATCH' });
  const ids = new Set();
  let total = 0;
  for (const payment of payments) {
    if (!payment?.id || ids.has(payment.id) || payment.billingType !== order.paymentMethod || payment.externalReference !== order.orderNumber || (order.asaasCustomerId && payment.customer !== order.asaasCustomerId) || !Number.isFinite(Number(payment.value)) || Number(payment.value) <= 0) throw new PaymentError('Cobrança divergente do pedido.', { code: 'PAYMENT_MISMATCH' });
    if ((order.installments || 1) > 1 && (!payment.installment || (order.asaasInstallmentId && payment.installment !== order.asaasInstallmentId))) throw new PaymentError('Parcelamento divergente.', { code: 'PAYMENT_MISMATCH' });
    ids.add(payment.id); total += cents(payment.value);
  }
  if (total !== cents(order.total)) throw new PaymentError('Valor da cobrança divergente.', { code: 'PAYMENT_MISMATCH' });
}
async function fetchPaymentSet(order, primary) {
  let payment = primary;
  if (!payment && order.asaasPaymentId) payment = await request(`/payments/${encodeURIComponent(order.asaasPaymentId)}`);
  if (!payment) {
    const found = await request(`/payments?externalReference=${encodeURIComponent(order.orderNumber)}&limit=100`);
    if (!Array.isArray(found.data) || found.hasMore) throw new PaymentError('Conciliação de cobrança inconclusiva.');
    if (!found.data.length) return [];
    if ((order.installments || 1) === 1) { if (found.data.length !== 1) throw new PaymentError('Mais de uma cobrança para o pedido.'); payment = found.data[0]; }
    else {
      const installmentIds = new Set(found.data.map(p => p.installment));
      if (installmentIds.size !== 1 || ![...installmentIds][0]) throw new PaymentError('Parcelamento não identificado.');
      payment = found.data[0];
    }
  }
  if (order.asaasPaymentId && (order.installments || 1) === 1 && order.asaasPaymentId !== payment.id) throw new PaymentError('Cobrança divergente.');
  if ((order.installments || 1) > 1) {
    const id = order.asaasInstallmentId || payment.installment;
    if (!id) throw new PaymentError('Parcelamento não identificado.');
    const result = await request(`/installments/${encodeURIComponent(id)}/payments?limit=100`);
    if (!Array.isArray(result.data) || result.hasMore) throw new PaymentError('Parcelamento incompleto.');
    assertMatches(order, result.data);
    return result.data;
  }
  assertMatches(order, [payment]);
  return [payment];
}
function safeInvoice(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'asaas.com' || url.hostname.endsWith('.asaas.com')) ? url.href : null; } catch { return null; }
}
async function saveProviderReference(db, order, payments) {
  assertMatches(order, payments);
  const first = payments.find(p => p.id === order.asaasPaymentId) || [...payments].sort((a, b) => Number(a.installmentNumber || 1) - Number(b.installmentNumber || 1))[0];
  const data = { asaasPaymentId: first.id, asaasInstallmentId: first.installment || null, invoiceUrl: safeInvoice(first.invoiceUrl), paymentCreateState: 'CREATED', paymentLastCheckedAt: new Date(), paymentError: null };
  // Provider status is reconciled only by the authenticated webhook, not by checkout return.
  await db.order.update({ where: { id: order.id }, data });
  await db.order.updateMany({ where: { id: order.id, paymentStatus: 'PROCESSING' }, data: { paymentStatus: 'PENDING' } });
  return { ...order, ...data, paymentStatus: order.paymentStatus === 'PROCESSING' ? 'PENDING' : order.paymentStatus };
}
async function recoverOrderPayment(db, orderId) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new PaymentError('Pedido não encontrado.');
  if (order.paymentCreateState === 'NOT_STARTED' && !order.asaasPaymentId) return order;
  try {
    const payments = await fetchPaymentSet(order);
    if (!payments.length) {
      await db.order.update({ where: { id: order.id }, data: { paymentLastCheckedAt: new Date(), paymentError: 'Cobrança ainda não localizada; não repetir criação automaticamente.' } });
      return { ...order, paymentError: 'Cobrança ainda não localizada.' };
    }
    return await saveProviderReference(db, order, payments);
  } catch (error) {
    await db.order.update({ where: { id: order.id }, data: { paymentLastCheckedAt: new Date(), paymentError: error.code || 'RECOVERY_FAILED' } });
    throw error;
  }
}
async function prepareOrderPayment(db, orderId) {
  let order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new PaymentError('Pedido não encontrado.');
  const claimed = await db.order.updateMany({ where: { id: order.id, paymentCreateState: 'NOT_STARTED' }, data: { paymentCreateState: 'ATTEMPTED', paymentCreateAttemptedAt: new Date() } });
  if (claimed.count !== 1) return recoverOrderPayment(db, order.id);
  try {
    const customer = await getOrCreateAsaasCustomer({ name: order.customerName, email: order.customerEmail, cpfCnpj: order.customerCpf, mobilePhone: order.customerPhone, postalCode: order.shippingCep, address: order.shippingStreet, addressNumber: order.shippingNum });
    if (!customer?.id) throw new PaymentError('Cliente de pagamento não confirmado.');
    order = await db.order.update({ where: { id: order.id }, data: { asaasCustomerId: customer.id } });
    const payment = await createCharge({ customerId: customer.id, value: order.total, externalReference: order.orderNumber, paymentMethod: order.paymentMethod, installments: order.installments, dueDate: order.paymentDueDate?.toISOString().slice(0, 10) });
    const payments = await fetchPaymentSet(order, payment);
    return await saveProviderReference(db, order, payments);
  } catch (error) {
    // Even an HTTP error is not retried blindly. A durable ATTEMPTED claim survives process crashes.
    await db.order.update({ where: { id: order.id }, data: { paymentCreateState: 'REVIEW', paymentError: error.code || 'PAYMENT_CREATE_UNCERTAIN', paymentLastCheckedAt: new Date() } });
    return recoverOrderPayment(db, order.id);
  }
}
async function paymentReceipt(db, order) {
  let pix = {};
  if (order.paymentMethod === 'PIX' && order.asaasPaymentId && ['PROCESSING', 'PENDING'].includes(order.paymentStatus)) {
    try { pix = await getPixQrCode(order.asaasPaymentId); } catch { /* Hosted invoice remains available if QR retrieval is temporarily unavailable. */ }
  }
  return { orderId: order.id, orderNumber: order.orderNumber, total: order.total, installments: order.installments || 1, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, invoiceUrl: safeInvoice(order.invoiceUrl), ...pix, requiresReview: !!order.paymentReview, pendingRecovery: !order.asaasPaymentId || (['PROCESSING', 'PENDING'].includes(order.paymentStatus) && !safeInvoice(order.invoiceUrl) && !pix.pixCopiaECola) };
}
function stateFromProvider(payments, event) {
  if (event === 'PAYMENT_PARTIALLY_REFUNDED' || event === 'PAYMENT_RECEIVED_IN_CASH_UNDONE' || /CHARGEBACK|CAPTURE_REFUSED|REPROVED_BY_RISK/.test(event)) return 'REVIEW';
  if (payments.every(p => p.status === 'REFUNDED')) return 'REFUNDED';
  if (payments.some(p => /REFUND|CHARGEBACK/.test(p.status || ''))) return 'REVIEW';
  if (payments.every(p => PAID.has(p.status))) return 'PAID';
  if (payments.every(p => p.deleted === true) && payments.every(p => !PAID.has(p.status))) return 'CANCELLED';
  if (payments.some(p => p.deleted)) return 'REVIEW';
  return 'PENDING';
}
async function processPaymentWebhook(db, payload) {
  const { event, payment } = payload;
  const order = await db.order.findFirst({ where: payment.externalReference ? { orderNumber: payment.externalReference } : { asaasPaymentId: payment.id }, include: { items: true } });
  if (!order) throw new PaymentError('Pedido ainda não localizado.');
  if (payment.billingType !== order.paymentMethod || payment.externalReference !== order.orderNumber || !Number.isFinite(Number(payment.value)) || Number(payment.value) <= 0) throw new PaymentError('Dados do pagamento divergentes.');
  // Read the provider's current state to avoid stale or out-of-order webhook transitions.
  const payments = await fetchPaymentSet(order, await request(`/payments/${encodeURIComponent(payment.id)}`));
  const corresponding = payments.find(p => p.id === payment.id);
  if (!corresponding || cents(corresponding.value) !== cents(payment.value)) throw new PaymentError('Cobrança não pertence ao pedido.');
  const target = stateFromProvider(payments, event);
  return db.$transaction(async tx => {
    const current = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
    assertMatches(current, payments);
    if ((current.asaasPaymentId && (current.installments || 1) === 1 && current.asaasPaymentId !== payment.id) || (current.asaasInstallmentId && payments[0].installment !== current.asaasInstallmentId)) throw new PaymentError('Cobrança não corresponde ao pedido.');
    if (current.paymentStatus === target && !current.paymentReview) return 'ALREADY_PROCESSED';
    if (current.paymentReview && target === 'PAID') return 'REVIEW_PRESERVED';
    if (['REFUNDED', 'CANCELLED'].includes(current.paymentStatus) && target === 'PAID') return 'TERMINAL_STATE';
    // A refund after ERP export needs remote stock/order review; never blindly put it back on sale.
    const remoteStockTouched = !!current.tinyExportAttemptedAt || !!current.tinyOrderId || ['SENDING', 'SENT', 'REVIEW'].includes(current.tinyExportStatus);
    const terminal = ['REFUNDED', 'CANCELLED'].includes(target);
    const review = target === 'REVIEW' || (terminal && remoteStockTouched) || (current.stockReleased && target === 'PAID');
    const data = { paymentStatus: review ? 'REVIEW' : target, paymentReview: review, asaasPaymentId: current.asaasPaymentId || payments[0].id, asaasInstallmentId: payments[0].installment || null, paymentCreateState: 'CREATED', paymentLastCheckedAt: new Date(), paymentError: review ? 'PAYMENT_REQUIRES_REVIEW' : null };
    if (terminal && !remoteStockTouched && !current.stockReleased) {
      for (const item of current.items) if (item.productId) {
        const changed = await tx.product.updateMany({ where: { id: item.productId, reservedStock: { gte: item.quantity } }, data: { reservedStock: { decrement: item.quantity } } });
        if (changed.count !== 1) throw new PaymentError('Reserva divergente; conferir estoque.');
      }
      data.stockReleased = true;
    }
    await tx.order.update({ where: { id: current.id }, data });
    await tx.webhookLog.create({ data: { event, payload: JSON.stringify({ id: payload.id, paymentId: payment.id }), status: review ? 'REVIEW' : 'PROCESSED' } });
    return review ? 'REVIEW' : 'UPDATED';
  }, { isolationLevel: 'Serializable' });
}
async function cancelExpiredOrder(db, orderId, now = new Date()) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !order.asaasPaymentId || order.paymentMethod !== 'PIX' || !['PENDING', 'PROCESSING'].includes(order.paymentStatus) || !order.paymentDueDate || order.paymentDueDate >= now || order.tinyExportAttemptedAt || order.tinyOrderId) return { cancelled: false };
  const payments = await fetchPaymentSet(order);
  if (payments.length !== 1 || payments[0].deleted || !['PENDING', 'OVERDUE'].includes(payments[0].status)) return { cancelled: false, reason: 'PROVIDER_NOT_UNPAID' };
  await request(`/payments/${encodeURIComponent(order.asaasPaymentId)}`, { method: 'DELETE' });
  const deleted = await request(`/payments/${encodeURIComponent(order.asaasPaymentId)}`);
  if (!deleted.deleted || !['PENDING', 'OVERDUE'].includes(deleted.status)) throw new PaymentError('Cancelamento não confirmado; reserva mantida.');
  // Final stock release is driven by PAYMENT_DELETED webhook, under the same authenticated flow.
  return { cancelled: true, awaitingWebhook: true };
}
async function processPendingPayments(db, { limit = 10, now = new Date() } = {}) {
  assertPaymentConfigured();
  const orders = await db.order.findMany({ where: {
    paymentStatus: { in: ['PROCESSING', 'PENDING'] },
    OR: [{ paymentLastCheckedAt: null }, { paymentLastCheckedAt: { lt: new Date(now.getTime() - 120000) } }],
  }, take: Math.min(Math.max(limit, 1), 30), orderBy: { createdAt: 'asc' }, select: { id: true, paymentCreateState: true, paymentDueDate: true } });
  let recovered = 0, cancelled = 0, failed = 0;
  for (const order of orders) {
    try {
      if (order.paymentCreateState === 'NOT_STARTED') await prepareOrderPayment(db, order.id);
      else await recoverOrderPayment(db, order.id);
      recovered++;
      if (order.paymentDueDate && order.paymentDueDate < now) { const result = await cancelExpiredOrder(db, order.id, now); if (result.cancelled) cancelled++; }
    } catch { failed++; }
  }
  return { checked: orders.length, recovered, cancelled, failed };
}
module.exports = { PaymentError, processPendingPayments, assertPaymentConfigured, request, checkoutFingerprint, getOrCreateAsaasCustomer, createCharge, getPixQrCode, fetchPaymentSet, assertMatches, prepareOrderPayment, recoverOrderPayment, paymentReceipt, processPaymentWebhook, cancelExpiredOrder, stateFromProvider, safeInvoice };
