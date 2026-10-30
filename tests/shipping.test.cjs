const test = require('node:test');
const assert = require('node:assert/strict');
const { createShippingClient, buildCartPayloads, safePrintUrl, shippingAction } = require('../lib/shipping.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const env = {
  MELHOR_ENVIO_FROM_NAME: 'Canal Teste', MELHOR_ENVIO_FROM_EMAIL: 'teste@example.com', MELHOR_ENVIO_FROM_PHONE: '11999999999', MELHOR_ENVIO_FROM_COMPANY_DOCUMENT: '12345678000190', MELHOR_ENVIO_FROM_STATE_REGISTER: 'ISENTO', MELHOR_ENVIO_FROM_ADDRESS: 'Rua Teste', MELHOR_ENVIO_FROM_NUMBER: '1', MELHOR_ENVIO_FROM_DISTRICT: 'Centro', MELHOR_ENVIO_FROM_CITY: 'São Paulo', MELHOR_ENVIO_FROM_CEP: '01001000', MELHOR_ENVIO_FROM_STATE: 'SP',
};
function order(overrides = {}) {
  return { id: 'order-1', orderNumber: 'CNL-TEST', paymentStatus: 'PAID', customerName: 'Cliente Teste', customerEmail: 'cliente@example.com', customerPhone: '11999999999', customerCpf: '12345678901', shippingStreet: 'Rua', shippingNum: '2', shippingDist: 'Centro', shippingCity: 'São Paulo', shippingState: 'SP', shippingCep: '01001000', shippingIntegrationStatus: 'NONE', melhorEnvioIds: [], items: [{ productId: 'prod-1', name: 'Produto', quantity: 2, price: 100 }], shippingQuote: { serviceId: 1, originalPrice: 40, packages: [1, 2].map(() => ({ dimensions: { height: 10, width: 20, length: 30 }, weight: 1, products: [{ id: 'prod-1', quantity: 1 }] })) }, ...overrides };
}
function harness(initial = order(), request = async (path, body, calls) => path === '/me/cart' ? { id: `label-${calls.length}`, price: 20 } : {}) {
  const current = structuredClone(initial), calls = [], changes = [];
  const db = { order: {
    findFirst: async () => structuredClone(current),
    updateMany: async ({ where, data }) => {
      if (current.paymentStatus !== where.paymentStatus || !where.shippingIntegrationStatus.in.includes(current.shippingIntegrationStatus)) return { count: 0 };
      Object.assign(current, structuredClone(data)); changes.push(data); return { count: 1 };
    },
    update: async ({ data }) => { Object.assign(current, structuredClone(data)); changes.push(data); return structuredClone(current); },
  } };
  const client = { request: async (path, data) => { calls.push({ path, data }); return request(path, data, calls); } };
  return { current, calls, changes, run: body => shippingAction(db, current.id, body, { env, client }) };
}

test('cart uses paid order snapshots, confirmed volumes, complete sender and NFe', () => {
  const payloads = buildCartPayloads(order(), '1'.repeat(44), env);
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].products[0].unitary_value, 100);
  assert.equal(payloads[0].volumes.length, 1);
  assert.equal(payloads[0].options.invoice.key.length, 44);
  assert.equal(payloads[0].options.insurance_value, 100);
  assert.notEqual(payloads[0].options.tags[0].tag, payloads[1].options.tags[0].tag);
});

test('cart refuses unpaid orders, missing invoice, incomplete sender and incorrect package contents', () => {
  assert.throws(() => buildCartPayloads(order({ paymentStatus: 'PENDING' }), '1'.repeat(44), env));
  assert.throws(() => buildCartPayloads(order(), '123', env));
  assert.throws(() => buildCartPayloads(order(), '1'.repeat(44), {}));
  const bad = order(); bad.shippingQuote.packages[0].products[0].quantity = 2;
  assert.throws(() => buildCartPayloads(bad, '1'.repeat(44), env));
  const dims = order(); dims.shippingQuote.packages[0].dimensions.height = 0;
  assert.throws(() => buildCartPayloads(dims, '1'.repeat(44), env));
});

test('provider client uses fixed hosts, server credentials and explicit body', async () => {
  let observed;
  const client = createShippingClient({ env: { MELHOR_ENVIO_TOKEN: 'test-only-token', MELHOR_ENVIO_SANDBOX: 'true' }, fetchImpl: async (url, init) => { observed = { url, init }; return { ok: true, json: async () => ({ id: 'label-test' }) }; } });
  await client.request('/me/cart', { test: true });
  assert.equal(observed.url, 'https://sandbox.melhorenvio.com.br/api/v2/me/cart');
  assert.equal(observed.init.headers.Authorization, 'Bearer test-only-token');
  assert.equal(observed.init.method, 'POST');
  await assert.rejects(client.request('https://evil.example/me/cart', {}));
});

test('print URL permits only trusted HTTPS Melhor Envio addresses', () => {
  assert.equal(safePrintUrl('https://melhorenvio.com.br/impressoes/label'), 'https://melhorenvio.com.br/impressoes/label');
  for (const url of ['javascript:alert(1)', 'https://melhorenvio.com.br.evil.example/x', 'https://evil.example/x', 'http://melhorenvio.com.br/x', 'https://secret@melhorenvio.com.br/x', 'https://melhorenvio.com.br:8080/x']) assert.throws(() => safePrintUrl(url));
});

test('prepare persists each label and repeated action never creates another', async () => {
  const h = harness(order(), async (path, body, calls) => ({ id: `label-${calls.length}`, price: 20 }));
  const result = await h.run({ action: 'prepare', invoiceKey: '1'.repeat(44) });
  assert.deepEqual(result.melhorEnvioIds, ['label-1', 'label-2']);
  assert.equal(result.shippingCartCost, 40);
  assert.equal(result.shippingIntegrationStatus, 'CART_READY');
  await h.run({ action: 'prepare', invoiceKey: '1'.repeat(44) });
  assert.equal(h.calls.length, 2);
  assert.equal(h.changes.filter(x => x.melhorEnvioIds).length, 2);
});

test('ambiguous cart outcome is durable REVIEW and cannot be retried blindly', async () => {
  const h = harness(order(), async () => { throw new Error('timeout'); });
  await assert.rejects(h.run({ action: 'prepare', invoiceKey: '1'.repeat(44) }));
  assert.equal(h.current.shippingIntegrationStatus, 'REVIEW');
  await h.run({ action: 'prepare', invoiceKey: '1'.repeat(44) });
  assert.equal(h.calls.length, 1);
});

test('no automatic purchase, disabled purchase and wrong confirmation never debit wallet', async () => {
  const h = harness(order({ shippingIntegrationStatus: 'CART_READY', melhorEnvioIds: ['label-1'], shippingCartCost: 40 }));
  await assert.rejects(h.run({ action: 'purchase', confirmation: 'COMPRAR CNL-TEST', confirmedCost: 40 }));
  assert.equal(h.calls.length, 0);
  const enabled = { ...env, SHIPPING_PURCHASE_ENABLED: 'true' };
  const fakeDb = { order: { findFirst: async () => h.current } };
  for (const body of [{ action: 'purchase', confirmedCost: 40 }, { action: 'purchase', confirmation: 'COMPRAR CNL-TEST', confirmedCost: 1 }]) await assert.rejects(shippingAction(fakeDb, 'order-1', body, { env: enabled, client: { request: async () => assert.fail('unexpected debit') } }));
});

test('purchase is claimed before provider call and cannot repeat after timeout', async () => {
  const current = order({ shippingIntegrationStatus: 'CART_READY', melhorEnvioIds: ['label-1'], shippingCartCost: 40 });
  let calls = 0;
  const db = { order: {
    findFirst: async () => structuredClone(current),
    updateMany: async ({ where, data }) => { if (!where.shippingIntegrationStatus.in.includes(current.shippingIntegrationStatus)) return { count: 0 }; Object.assign(current, data); return { count: 1 }; },
    update: async ({ data }) => { Object.assign(current, data); return current; },
  } };
  const client = { request: async () => { calls++; assert.equal(current.shippingIntegrationStatus, 'PURCHASING'); throw new Error('timeout'); } };
  const options = { env: { ...env, SHIPPING_PURCHASE_ENABLED: 'true' }, client };
  const body = { action: 'purchase', confirmation: 'COMPRAR CNL-TEST', confirmedCost: 40 };
  await assert.rejects(shippingAction(db, current.id, body, options));
  await assert.rejects(shippingAction(db, current.id, body, options));
  assert.equal(current.shippingIntegrationStatus, 'REVIEW');
  assert.equal(calls, 1);
});

test('generation does not repeat and printing remains private', async () => {
  const h = harness(order({ shippingIntegrationStatus: 'PURCHASED', melhorEnvioIds: ['label-1'] }), async path => path.endsWith('/print') ? { url: 'https://melhorenvio.com.br/impressoes/test' } : {});
  await h.run({ action: 'generate' });
  await h.run({ action: 'generate' });
  assert.equal(h.calls.filter(c => c.path.endsWith('/generate')).length, 1);
  const printed = await h.run({ action: 'print' });
  assert.equal(printed.shippingIntegrationStatus, 'PRINTED');
  assert.equal(h.calls.find(c => c.path.endsWith('/print')).data.mode, 'private');
});

test('tracking only persists public shipment status and tracking, never provider personal data', async () => {
  const h = harness(order({ shippingIntegrationStatus: 'PRINTED', melhorEnvioIds: ['label-1'] }), async () => ({ status: 'posted', tracking: 'TRACK-123', to: { document: 'private', address: 'private' } }));
  const result = await h.run({ action: 'track' });
  assert.equal(result.trackingCode, 'TRACK-123');
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('two concurrent preparation requests create one set of cart labels', async () => {
  const h = harness(order(), async (path, body, calls) => ({ id: `label-${calls.length}`, price: 20 }));
  const outcomes = await Promise.allSettled([h.run({ action: 'prepare', invoiceKey: '1'.repeat(44) }), h.run({ action: 'prepare', invoiceKey: '1'.repeat(44) })]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(h.calls.length, 2); // two packages from one successful claim, never four.
});

test('admin shipping endpoint rejects customer roles even when JWT claims say ADMIN', async () => {
  const raw = fs.readFileSync(path.join(__dirname, '../pages/api/shipping/orders/[id].js'), 'utf8');
  const source = raw.replace(/^import .*;$/gm, '').replace(/^const \{ shippingAction \} = require\(.*\);$/m, '').replace('export default async function handler', 'async function handler') + '\nhandler;';
  for (const scenario of [{ role: 'CUSTOMER', status: 403 }, { role: null, status: 403 }, { invalid: true, status: 401 }, { role: 'ADMIN', status: 200 }]) {
    let operationCalls = 0;
    const handler = vm.runInNewContext(source, {
      session: () => { if (scenario.invalid) throw new Error('invalid token'); return { id: 'user-1', role: 'ADMIN' }; },
      prisma: { user: { findUnique: async () => scenario.role ? { role: scenario.role } : null } },
      shippingAction: async () => { operationCalls++; return { orderNumber: 'CNL-TEST' }; },
    });
    const response = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: 'POST', query: { id: 'order-1' }, headers: {}, body: { action: 'purchase' } }, response);
    assert.equal(response.code, scenario.status);
    assert.equal(operationCalls, scenario.role === 'ADMIN' ? 1 : 0);
  }
});
