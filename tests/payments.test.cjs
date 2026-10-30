const test = require('node:test');
const assert = require('node:assert/strict');
const payments = require('../lib/payments.cjs');
const originalFetch = global.fetch;
process.env.ASAAS_API_URL = 'https://api-sandbox.asaas.com/v3';
process.env.ASAAS_API_KEY = 'tests-only-key';
test.after(() => { global.fetch = originalFetch; });
const provider = (patch = {}) => ({ id: 'pay-1', customer: 'cus-1', billingType: 'PIX', value: 100, externalReference: 'CNL-1', status: 'PENDING', invoiceUrl: 'https://sandbox.asaas.com/i/pay-1', ...patch });
function database(patch = {}) {
  const order = { id: 'order-1', orderNumber: 'CNL-1', checkoutKey: 'unique-checkout-key', total: 100, installments: 1, paymentMethod: 'PIX', paymentStatus: 'PROCESSING', paymentCreateState: 'NOT_STARTED', asaasCustomerId: null, asaasPaymentId: null, asaasInstallmentId: null, stockReleased: false, paymentReview: false, tinyExportStatus: 'PENDING', customerName: 'Cliente Teste', customerCpf: '12345678901', customerEmail: 'teste@example.com', customerPhone: '11999999999', shippingCep: '01001000', shippingStreet: 'Rua Teste', shippingNum: '1', paymentDueDate: new Date(Date.now() + 86400000), items: [{ productId: 'p-1', quantity: 2 }], ...patch };
  const calls = { updates: [], releases: 0, logs: 0 };
  const db = {
    order: {
      findUnique: async () => ({ ...order }), findFirst: async () => ({ ...order }), findMany: async () => [{ ...order }],
      update: async ({ data }) => { Object.assign(order, data); calls.updates.push(data); return { ...order }; },
      updateMany: async ({ where, data }) => {
        if ((where.paymentCreateState && where.paymentCreateState !== order.paymentCreateState) || (where.paymentStatus && where.paymentStatus !== order.paymentStatus)) return { count: 0 };
        Object.assign(order, data); calls.updates.push(data); return { count: 1 };
      },
    },
    product: { updateMany: async ({ data }) => { calls.releases += data.reservedStock.decrement; return { count: 1 }; } },
    webhookLog: { create: async () => { calls.logs++; } },
  };
  db.$transaction = async fn => fn(db);
  return { db, order, calls };
}
function routeFetch(handler) {
  const calls = [];
  global.fetch = async (url, init) => { const entry = { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined }; calls.push(entry); const value = await handler(entry); return { ok: true, status: 200, json: async () => value }; };
  return calls;
}
const webhook = (event = 'PAYMENT_CONFIRMED', payment = provider({ status: 'CONFIRMED' })) => ({ id: 'evt-1', event, payment });

test('payment fingerprint ignores browser prices but binds the checkout intention', () => {
  const a = { customer: { name: 'Teste', cpf: '123.456.789-01' }, shippingAddress: { cep: '01001-000' }, items: [{ slug: 'a', qty: 1, price: 1 }], expectedTotal: 100, paymentMethod: 'PIX', shippingMethod: { id: 1 } };
  const b = { ...a, items: [{ slug: 'a', qty: 1, price: 999 }] };
  assert.equal(payments.checkoutFingerprint(a), payments.checkoutFingerprint(b));
  assert.notEqual(payments.checkoutFingerprint(a), payments.checkoutFingerprint({ ...a, expectedTotal: 101 }));
  assert.notEqual(payments.checkoutFingerprint(a), payments.checkoutFingerprint({ ...a, paymentMethod: 'CREDIT_CARD' }));
});

test('hosted card installment creation sends totalValue and no card information', async () => {
  const calls = routeFetch(() => provider({ billingType: 'CREDIT_CARD', installment: 'inst-1' }));
  await payments.createCharge({ customerId: 'cus-1', value: 100, externalReference: 'CNL-1', paymentMethod: 'CREDIT_CARD', installments: 12 });
  assert.equal(calls[0].body.totalValue, 100);
  assert.equal(calls[0].body.installmentCount, 12);
  assert.equal(calls[0].body.value, undefined);
  assert.equal(calls[0].body.creditCard, undefined);
  assert.equal(calls[0].body.creditCardHolderInfo, undefined);
  assert.equal(calls[0].method, 'POST');
});

test('payment creation claims once and a repeated attempt performs only GET', async () => {
  const { db, order } = database();
  const calls = routeFetch(entry => entry.url.includes('/customers?') ? { data: [{ id: 'cus-1' }] } : entry.method === 'POST' ? provider() : provider());
  const first = await payments.prepareOrderPayment(db, order.id);
  assert.equal(first.asaasPaymentId, 'pay-1');
  assert.equal(order.paymentStatus, 'PENDING');
  assert.equal(order.paymentCreateState, 'CREATED');
  await payments.prepareOrderPayment(db, order.id);
  assert.equal(calls.filter(c => c.method === 'POST' && c.url.endsWith('/payments')).length, 1);
  assert.equal(order.paymentStatus, 'PENDING');
});

test('ambiguous POST response is recovered by externalReference without duplicate charge', async () => {
  const { db, order } = database();
  const calls = routeFetch(entry => {
    if (entry.url.includes('/customers?')) return { data: [{ id: 'cus-1' }] };
    if (entry.method === 'POST') throw new Error('connection lost after request');
    if (entry.url.includes('/payments?')) return { data: [provider()], hasMore: false };
    return provider();
  });
  const result = await payments.prepareOrderPayment(db, order.id);
  assert.equal(result.asaasPaymentId, 'pay-1');
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  await payments.prepareOrderPayment(db, order.id);
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
});

test('unresolved attempted creation never retries POST or releases stock', async () => {
  const { db, order, calls: dbCalls } = database({ paymentCreateState: 'REVIEW' });
  const network = routeFetch(() => ({ data: [], hasMore: false }));
  await payments.prepareOrderPayment(db, order.id);
  await payments.recoverOrderPayment(db, order.id);
  assert.ok(network.every(c => c.method === 'GET'));
  assert.equal(dbCalls.releases, 0);
  assert.equal(order.paymentStatus, 'PROCESSING');
});

test('provider references reject wrong amount, customer, method and reference', async () => {
  const { order } = database({ asaasCustomerId: 'cus-1' });
  for (const patch of [{ value: 99 }, { customer: 'other' }, { billingType: 'CREDIT_CARD' }, { externalReference: 'other' }]) assert.throws(() => payments.assertMatches(order, [provider(patch)]));
});

test('authenticated webhook rechecks provider and marks paid only for complete matching payment', async () => {
  const { db, order, calls } = database({ asaasPaymentId: 'pay-1', asaasCustomerId: 'cus-1', paymentStatus: 'PENDING' });
  routeFetch(() => provider({ status: 'CONFIRMED' }));
  assert.equal(await payments.processPaymentWebhook(db, webhook()), 'UPDATED');
  assert.equal(await payments.processPaymentWebhook(db, webhook('PAYMENT_RECEIVED')), 'ALREADY_PROCESSED');
  assert.equal(order.paymentStatus, 'PAID');
  assert.equal(calls.releases, 0);
});

test('out of order confirmation cannot overwrite current refunded provider state', async () => {
  const { db, order, calls } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'PAID' });
  routeFetch(() => provider({ status: 'REFUNDED' }));
  await payments.processPaymentWebhook(db, webhook());
  assert.equal(order.paymentStatus, 'REFUNDED');
  assert.equal(calls.releases, 2);
  await payments.processPaymentWebhook(db, webhook());
  assert.equal(calls.releases, 2);
});

test('refund after ERP activity keeps reservation and requires review', async () => {
  for (const patch of [{ tinyOrderId: 'tiny-1' }, { tinyExportAttemptedAt: new Date() }, { tinyExportStatus: 'SENDING' }]) {
    const { db, order, calls } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'PAID', ...patch });
    routeFetch(() => provider({ status: 'REFUNDED' }));
    await payments.processPaymentWebhook(db, webhook('PAYMENT_REFUNDED'));
    assert.equal(order.paymentStatus, 'REVIEW');
    assert.equal(order.paymentReview, true);
    assert.equal(calls.releases, 0);
  }
});

test('partial refunds and cash reversals never release or mark an unpaid order paid', async () => {
  for (const event of ['PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE', 'PAYMENT_CHARGEBACK_REQUESTED']) {
    const { db, order, calls } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'PENDING' });
    routeFetch(() => provider({ status: 'CONFIRMED' }));
    await payments.processPaymentWebhook(db, webhook(event));
    assert.equal(order.paymentStatus, 'REVIEW');
    assert.equal(calls.releases, 0);
  }
});

test('payment review cannot be automatically cleared by a later confirmed event', async () => {
  const { db, order } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'REVIEW', paymentReview: true });
  routeFetch(() => provider({ status: 'CONFIRMED' }));
  assert.equal(await payments.processPaymentWebhook(db, webhook()), 'REVIEW_PRESERVED');
  assert.equal(order.paymentStatus, 'REVIEW');
});

test('card installments require every parcel and the exact aggregate total', async () => {
  const { db, order } = database({ asaasPaymentId: 'pay-1', asaasCustomerId: 'cus-1', asaasInstallmentId: 'inst-1', installments: 2, paymentMethod: 'CREDIT_CARD', paymentStatus: 'PENDING' });
  const first = provider({ value: 50, billingType: 'CREDIT_CARD', installment: 'inst-1', installmentNumber: 1, status: 'CONFIRMED' });
  let second = { ...first, id: 'pay-2', installmentNumber: 2, status: 'PENDING' };
  routeFetch(entry => entry.url.includes('/installments/') ? { data: [first, second], hasMore: false } : first);
  await payments.processPaymentWebhook(db, webhook('PAYMENT_CONFIRMED', first));
  assert.equal(order.paymentStatus, 'PENDING');
  second = { ...second, status: 'CONFIRMED' };
  await payments.processPaymentWebhook(db, webhook('PAYMENT_CONFIRMED', first));
  assert.equal(order.paymentStatus, 'PAID');
  second = { ...second, value: 40 };
  await assert.rejects(payments.processPaymentWebhook(db, webhook('PAYMENT_CONFIRMED', first)));
});

test('a cancelled terminal order cannot be reopened automatically', async () => {
  const { db, order, calls } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'CANCELLED', stockReleased: true });
  routeFetch(() => provider({ status: 'CONFIRMED' }));
  assert.equal(await payments.processPaymentWebhook(db, webhook()), 'TERMINAL_STATE');
  assert.equal(order.paymentStatus, 'CANCELLED');
  assert.equal(calls.releases, 0);
});

test('expired Pix deletes only provider-confirmed unpaid charge and waits for webhook to release', async () => {
  const { db, order, calls } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'PENDING', paymentDueDate: new Date(Date.now() - 10000) });
  let deleted = false;
  const network = routeFetch(entry => { if (entry.method === 'DELETE') { deleted = true; return { deleted: true }; } return provider({ status: 'OVERDUE', deleted }); });
  assert.deepEqual(await payments.cancelExpiredOrder(db, order.id), { cancelled: true, awaitingWebhook: true });
  assert.equal(network.filter(c => c.method === 'DELETE').length, 1);
  assert.equal(calls.releases, 0);
  assert.equal(order.stockReleased, false);
});

test('expired Pix that is already paid is never deleted', async () => {
  const { db, order } = database({ asaasPaymentId: 'pay-1', paymentStatus: 'PENDING', paymentDueDate: new Date(Date.now() - 10000) });
  const network = routeFetch(() => provider({ status: 'CONFIRMED' }));
  assert.equal((await payments.cancelExpiredOrder(db, order.id)).cancelled, false);
  assert.ok(network.every(c => c.method === 'GET'));
});

test('invoice URLs must belong to HTTPS Asaas', () => {
  assert.equal(payments.safeInvoice('https://sandbox.asaas.com/i/abc'), 'https://sandbox.asaas.com/i/abc');
  for (const url of ['http://asaas.com/i/abc', 'https://asaas.com.evil.test/abc', 'javascript:alert(1)']) assert.equal(payments.safeInvoice(url), null);
});
