const TINY_API_BASE = 'https://api.tiny.com.br/api2';
const SYNC_LOCK_ID = 69027109;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function tinyNumber(value, label, { allowNegative = false } = {}) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') throw new Error(`${label} ausente.`);
  const number = Number(value);
  if (!Number.isFinite(number) || (!allowNegative && number < 0)) throw new Error(`${label} inválido.`);
  return number;
}

function stockFromResponse(retorno) {
  const product = retorno?.produto;
  const physical = tinyNumber(product?.saldo, 'Estoque', { allowNegative: true });
  const reserved = product?.saldoReservado === undefined ? 0 : tinyNumber(product.saldoReservado, 'Reserva Tiny');
  return Math.max(0, Math.floor(physical - reserved));
}

// Run one client under the database lock. The 2100ms spacing leaves room below 30/min.
function createTinyClient(token, { fetchImpl = fetch, wait = sleep, now = Date.now, intervalMs = 2100, beforeRequest } = {}) {
  if (!token) throw new Error('TINY_API_TOKEN não configurado.');
  let lastRequestAt = null;
  let queue = Promise.resolve();
  function request(endpoint, params = {}) {
    const task = queue.then(async () => {
      if (beforeRequest) await beforeRequest();
      if (lastRequestAt !== null) await wait(Math.max(0, intervalMs - (now() - lastRequestAt)));
      lastRequestAt = now();
      const response = await fetchImpl(`${TINY_API_BASE}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ token, formato: 'json', ...params }), signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`Tiny indisponível (HTTP ${response.status}).`);
      const data = await response.json();
      if (String(data?.retorno?.status).toUpperCase() !== 'OK') {
        // Avoid including provider error bodies in logs; they can contain customer/token data.
        const error = new Error('Tiny recusou a consulta.');
        error.code = String(data?.retorno?.codigo_erro || 'UNKNOWN');
        throw error;
      }
      return data.retorno;
    });
    queue = task.catch(() => {});
    return task;
  }
  return {
    request,
    async productsPage(page) {
      const data = await request('produtos.pesquisa.php', { pagina: String(page) });
      if (!Array.isArray(data.produtos)) throw new Error('Lista de produtos Tiny inválida.');
      const pages = tinyNumber(data.numero_paginas, 'Número de páginas');
      if (!Number.isInteger(pages) || pages < 1 || pages > 10000) throw new Error('Paginação Tiny inválida.');
      return { products: data.produtos.map(wrapper => wrapper?.produto), pages };
    },
    async productDetail(id) { return (await request('produto.obter.php', { id: String(id) })).produto; },
    async stock(id) { return stockFromResponse(await request('produto.obter.estoque.php', { id: String(id) })); },
    async findOrdersByReference(reference) {
      let data;
      try { data = await request('pedidos.pesquisa.php', { numeroEcommerce: reference, pagina: '1' }); }
      catch (error) { if (error.code === '20') return []; throw error; }
      const pages = Number(data.numero_paginas || 1);
      if (!Number.isSafeInteger(pages) || pages < 1 || pages > 10) throw new Error('Pesquisa de pedidos inesperadamente ampla.');
      const orders = [];
      for (let page = 1; page <= pages; page++) {
        const current = page === 1 ? data : await request('pedidos.pesquisa.php', { numeroEcommerce: reference, pagina: String(page) });
        if (!Array.isArray(current.pedidos)) throw new Error('Pesquisa de pedidos inválida.');
        for (const wrapper of current.pedidos) {
          const order = wrapper?.pedido;
          // An ignored filter must never be mistaken for evidence that an order is absent.
          if (String(order?.numero_ecommerce || order?.numero_pedido_ecommerce || '') !== reference) throw new Error('Filtro de referência não confirmado pelo Tiny.');
          if (!order?.id) throw new Error('Pedido remoto sem identificador.');
          orders.push(order);
        }
      }
      return orders;
    },
    async orderDetail(id) { return (await request('pedido.obter.php', { id: String(id) })).pedido; },
    async createOrder(payload) {
      const data = await request('pedido.incluir.php', { pedido: JSON.stringify(payload) });
      const wrappers = Array.isArray(data.registros) ? data.registros : [data.registros];
      const rows = wrappers.map(wrapper => wrapper?.registro).filter(Boolean);
      if (rows.length !== 1 || String(rows[0].status).toUpperCase() !== 'OK' || !rows[0].id) throw new Error('Criação do pedido Tiny não confirmada.');
      return { id: String(rows[0].id), number: String(rows[0].numero || '') };
    },
  };
}

async function syncMappedTiny(prisma, { token = process.env.TINY_API_TOKEN, client, transactionTimeoutMs = 900000 } = {}) {
  if (!token && !client) throw new Error('TINY_API_TOKEN não configurado.');
  const api = client || createTinyClient(token, { beforeRequest: persistentRateLimit(prisma) });
  const startedAt = new Date();
  try {
    return await prisma.$transaction(async tx => {
      const [lock] = await tx.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock(${SYNC_LOCK_ID}) AS locked`);
      if (!lock?.locked) return { success: false, busy: true, status: 'BUSY', syncedCount: 0, failedCount: 0 };
      const localProducts = await tx.product.findMany({ where: { active: true }, select: { id: true, tinyId: true, sku: true } });
      const byId = new Map(), bySku = new Map();
      let syncedCount = 0, failedCount = 0, scannedCount = 0, unmappedCount = 0, missingCount = 0;
      const first = await api.productsPage(1);
      // Inspect the entire catalog before associating by SKU: the same SKU can
      // occur on a later page with another Tiny ID. Never choose the first match.
      for (let page = 1; page <= first.pages; page++) {
        const current = page === 1 ? first : await api.productsPage(page);
        if (current.pages !== first.pages) throw new Error('O catálogo Tiny mudou durante a paginação.');
        for (const product of current.products) {
          scannedCount++;
          if (!product?.id) throw new Error('Produto remoto sem identificador.');
          const tinyId = String(product.id);
          if (byId.has(tinyId)) throw new Error('Produto duplicado entre páginas Tiny.');
          byId.set(tinyId, product);
          if (typeof product.codigo === 'string' && product.codigo) {
            const matches = bySku.get(product.codigo) || [];
            matches.push(product);
            bySku.set(product.codigo, matches);
          }
        }
      }
      const updatedProductIds = new Set();
      for (const local of localProducts) {
        if (!local.tinyId && !local.sku) { unmappedCount++; failedCount++; continue; }
        const matches = local.sku ? (bySku.get(local.sku) || []) : [];
        const remote = local.tinyId ? byId.get(String(local.tinyId)) : matches.length === 1 ? matches[0] : null;
        if (!remote) { missingCount++; failedCount++; continue; }
        if (local.sku && remote.codigo !== local.sku) { failedCount++; continue; }
        let stock, price;
        try {
          price = tinyNumber(remote.preco, 'Preço');
          if (price <= 0) throw new Error('Preço deve ser positivo.');
          stock = await api.stock(remote.id);
          if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Estoque inválido.');
        } catch { failedCount++; continue; }
        await tx.product.update({ where: { id: local.id }, data: {
          tinyId: String(remote.id), price, stock, stockSyncedAt: new Date(),
          ...(remote.situacao === 'A' || remote.situacao === 'I' ? { active: remote.situacao === 'A' } : {}),
        } });
        updatedProductIds.add(local.id);
        syncedCount++;
      }
      const status = failedCount === 0 && syncedCount > 0 ? 'SUCCESS' : 'PARTIAL';
      const reconciledCount = status === 'SUCCESS' ? await reconcileAcknowledgedStock(tx, startedAt, updatedProductIds) : 0;
      await tx.syncLog.create({ data: { source: 'TINY', status, itemsSynced: syncedCount, itemsFailed: failedCount,
        message: `Examinados ${scannedCount}; atualizados ${syncedCount}; sem associação ${unmappedCount}; não encontrados/ambíguos ${missingCount}; reservas conciliadas ${reconciledCount}.`,
        startedAt, completedAt: status === 'SUCCESS' ? new Date() : null } });
      return { success: status === 'SUCCESS', status, syncedCount, failedCount, scannedCount, unmappedCount, missingCount, reconciledCount };
    }, { timeout: transactionTimeoutMs, maxWait: 10000, isolationLevel: 'Serializable' });
  } catch {
    await prisma.syncLog.create({ data: { source: 'TINY', status: 'ERROR', itemsSynced: 0, itemsFailed: 1,
      message: 'Sincronização interrompida; transação revertida. Confira conexão, token, paginação e associações do catálogo.', startedAt, completedAt: null } });
    throw new Error('Não foi possível sincronizar o Tiny; nenhum lote parcial foi confirmado.');
  }
}

// The caller holds SYNC_LOCK_ID while using this limiter. The timestamp is committed
// on a separate connection, so failed sync transactions cannot erase the API budget.
function persistentRateLimit(db, { now = Date.now, wait = sleep, intervalMs = 2100 } = {}) {
  return async () => {
    const last = await db.setting.findUnique({ where: { key: 'tiny_last_request_at' } });
    const at = Number(last?.value || 0);
    if (Number.isFinite(at)) await wait(Math.max(0, intervalMs - (now() - at)));
    await db.setting.upsert({ where: { key: 'tiny_last_request_at' }, create: { key: 'tiny_last_request_at', value: String(now()) }, update: { value: String(now()) } });
  };
}

async function reconcileAcknowledgedStock(tx, snapshotStartedAt, updatedProductIds) {
  const orders = await tx.order.findMany({ where: {
    paymentStatus: 'PAID', paymentReview: false, tinyExportStatus: 'SENT', tinyOrderId: { not: null }, stockReleased: false,
    tinyStockAcknowledgedAt: { not: null, lte: snapshotStartedAt },
  }, include: { items: true } });
  const eligible = orders.filter(order => order.items.length && order.items.every(item => updatedProductIds?.has(item.productId)));
  const required = new Map();
  for (const order of eligible) {
    for (const item of order.items) {
      if (!item.productId || !item.tinyId || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Reserva sem associação para conciliar.');
      const line = required.get(item.productId) || { quantity: 0, tinyId: item.tinyId };
      if (line.tinyId !== item.tinyId) throw new Error('Associação de produto alterada.');
      line.quantity += item.quantity;
      required.set(item.productId, line);
    }
  }
  for (const [id, line] of required) {
    const product = await tx.product.findUnique({ where: { id }, select: { reservedStock: true, tinyId: true } });
    if (!product || product.tinyId !== line.tinyId || product.reservedStock < line.quantity) throw new Error('Reserva insuficiente para conciliar.');
    await tx.product.update({ where: { id }, data: { reservedStock: { decrement: line.quantity } } });
  }
  for (const order of eligible) await tx.order.update({ where: { id: order.id }, data: { stockReleased: true, tinyStockReconciledAt: new Date() } });
  return eligible.length;
}
const syncTiny = (...args) => require('./tiny-catalog.cjs').syncCatalog(...args);
module.exports = { createTinyClient, syncMappedTiny, syncTiny, stockFromResponse, tinyNumber, SYNC_LOCK_ID, persistentRateLimit, reconcileAcknowledgedStock };
