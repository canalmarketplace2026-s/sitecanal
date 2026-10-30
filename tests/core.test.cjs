const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
const secret = 'test-only-secret-with-more-than-thirty-two-characters';
const product = { id: 'prod-1', slug: 'produto', name: 'Produto', active: true, price: 100, stock: 10, reservedStock: 2, tinyId:'123', stockSyncedAt:new Date(), weight: 1, width: 10, height: 10, length: 10, image: '/produto.png' };

async function moduleUnderTest(filename, { env = {}, fetch = async () => { throw new Error('Unexpected network access'); }, mocks = {} } = {}) {
  const context = vm.createContext({ process: { env: { JWT_SECRET: secret, ASAAS_WEBHOOK_TOKEN: secret, ...env } }, Buffer, console, AbortSignal, URLSearchParams, fetch, setTimeout, clearTimeout });
  const modules = new Map();
  async function synthetic(key, exports) {
    if (modules.has(key)) return modules.get(key);
    const module = new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context, identifier: key });
    modules.set(key, module);
    return module;
  }
  async function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file);
    const override = mocks[file] || mocks[path.relative(root, file).replace(/\\/g, '/')];
    if (override) return synthetic(file, override);
    const module = new vm.SourceTextModule(await fs.readFile(file, 'utf8'), { context, identifier: file });
    modules.set(file, module);
    await module.link(async (specifier, referencing) => {
      if (specifier === 'crypto' || specifier === 'node:crypto') return synthetic('crypto', { ...crypto, default: crypto });
      if (specifier === 'jsonwebtoken') return synthetic('jsonwebtoken', { default: jwt, ...jwt });
      let resolved = path.resolve(path.dirname(referencing.identifier), specifier);
      if (!path.extname(resolved)) resolved += '.js';
      return load(resolved);
    });
    return module;
  }
  const module = await load(path.join(root, filename));
  await module.evaluate();
  return module.namespace;
}

function dbWithProduct(p = product) {
  return { product: { findFirst: async ({ where }) => where.OR.some(candidate => candidate.id === p?.id || candidate.slug === p?.slug) ? p : null } };
}

function response() {
  return { statusCode: 200, headers: {}, body: undefined, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, end() { return this; } };
}

function checkoutBody(overrides = {}) {
  return { customer: { name: 'Cliente Teste', email: 'cliente@example.com', cpf: '12345678901', phone: '11999999999' }, shippingAddress: { cep: '01001000', street: 'Rua Teste', number: '10', district: 'Centro', city: 'São Paulo', state: 'SP' }, items: [{ slug: product.slug, qty: 2, price: 0.01 }], paymentMethod: 'PIX', shippingMethod: { id: 1, price: 20 }, shippingCost: -1000, discount: 999999, checkoutKey: '12345678-1234-1234-1234-123456789012', expectedTotal: 200, ...overrides };
}

test('catalog uses database prices and aggregates aliases of the same product', async () => {
  const { resolveCart } = await moduleUnderTest('lib/catalog.js');
  const result = await resolveCart(dbWithProduct(), [{ slug: 'produto', qty: 2, price: 0.01 }, { id: 'prod-1', quantity: 3, price: -100 }]);
  assert.equal(result.subtotal, 500);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].quantity, 5);
});

for (const quantity of [-1, 0, 1.5, 101, Number.MAX_SAFE_INTEGER, 'invalid']) {
  test(`catalog rejects invalid quantity ${quantity}`, async () => {
    const { resolveCart } = await moduleUnderTest('lib/catalog.js');
    await assert.rejects(resolveCart(dbWithProduct(), [{ slug: 'produto', quantity }]));
  });
}

test('catalog accounts for reservations and rejects duplicate aliases exceeding stock', async () => {
  const { resolveCart } = await moduleUnderTest('lib/catalog.js');
  await assert.rejects(resolveCart(dbWithProduct(), [{ slug: 'produto', qty: 9 }]));
  await assert.rejects(resolveCart(dbWithProduct(), [{ slug: 'produto', qty: 5 }, { id: 'prod-1', qty: 4 }]));
  assert.equal((await resolveCart(dbWithProduct(), [{ slug: 'produto', qty: 8 }])).subtotal, 800);
});

test('catalog rejects unavailable products and invalid stored prices', async () => {
  const { resolveCart } = await moduleUnderTest('lib/catalog.js');
  await assert.rejects(resolveCart(dbWithProduct(), [{ slug: 'missing', qty: 1 }]));
  for (const price of [0, -1, NaN, Infinity]) await assert.rejects(resolveCart(dbWithProduct({ ...product, price }), [{ slug: 'produto', qty: 1 }]));
});

test('catalog rounds each unit price to cents before quantity multiplication', async () => {
  const { resolveCart } = await moduleUnderTest('lib/catalog.js');
  const result = await resolveCart(dbWithProduct({ ...product, price: 19.99 }), [{ slug: 'produto', qty: 3 }]);
  assert.equal(result.subtotal, 59.97);
});

test('security rejects missing, short, and legacy default secrets', async () => {
  for (const value of [undefined, 'short', 'canal_marketplace_jwt_super_secret_2026']) {
    const { requiredSecret } = await moduleUnderTest('lib/security.js', { env: { JWT_SECRET: value } });
    assert.throws(() => requiredSecret('JWT_SECRET'));
  }
});

test('security compares token bytes safely and rejects empty values', async () => {
  const { sameSecret } = await moduleUnderTest('lib/security.js');
  assert.equal(sameSecret(secret, secret), true);
  for (const pair of [[undefined, secret], ['', ''], ['x', secret], ['ç', 'x'], [secret, secret.slice(1)]]) assert.equal(sameSecret(...pair), false);
});

test('security session accepts only correctly signed JWTs', async () => {
  const { session } = await moduleUnderTest('lib/security.js');
  const token = jwt.sign({ id: 'user-1' }, secret, { algorithm: 'HS256' });
  assert.equal(session({ headers: { authorization: `Bearer ${token}` } }).id, 'user-1');
  assert.throws(() => session({ headers: {} }));
  assert.throws(() => session({ headers: { authorization: `Bearer ${jwt.sign({ id: 'user-1' }, 'wrong-secret')}` } }));
});

test('shipping failures never produce invented quotes', async () => {
  for (const fetch of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => [] }), async () => ({ ok: true, json: async () => [{ id: 1, error: 'unavailable', price: 20 }] })]) {
    const { calculateShipping } = await moduleUnderTest('lib/melhor-envio.js', { env: { MELHOR_ENVIO_TOKEN: 'test-token', MELHOR_ENVIO_FROM_CEP: '13049900' }, fetch });
    await assert.rejects(calculateShipping({ destinationCep: '01001000', subtotal: 100, items: [{ ...product, quantity: 1 }] }));
  }
});

test('shipping uses confirmed product dimensions and no free shipping by default', async () => {
  let payload;
  const { calculateShipping } = await moduleUnderTest('lib/melhor-envio.js', { env: { MELHOR_ENVIO_TOKEN: 'test-token', MELHOR_ENVIO_FROM_CEP: '13049900' }, fetch: async (url, init) => { payload = JSON.parse(init.body); return { ok: true, json: async () => [{ id: 1, name: 'PAC', price: '20.50', delivery_time: 4, company: { name: 'Correios' } }] }; } });
  const result = await calculateShipping({ destinationCep: '01001000', subtotal: 500, items: [{ ...product, quantity: 3 }] });
  assert.equal(result[0].price, 20.5);
  assert.equal(payload.products[0].quantity, 3);
  assert.equal(payload.products[0].insurance_value, 100);
  await assert.rejects(calculateShipping({ destinationCep: '01001000', subtotal: 100, items: [{ ...product, quantity: 1, weight: null }] }));
});

