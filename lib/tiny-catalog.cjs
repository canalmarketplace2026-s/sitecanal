const { createTinyClient, persistentRateLimit, SYNC_LOCK_ID, reconcileAcknowledgedStock } = require('./tiny-sync.cjs');
function priceOf(p) {
  const normal = Number(p.preco), promo = Number(p.preco_promocional);
  return Number.isFinite(normal) && normal > 0 ? (Number.isFinite(promo) && promo > 0 && promo < normal ? promo : normal) : 0;
}
function categoryOf(value = '') {
  if (/ortop|saúde|saude|hospital|farmácia/i.test(value)) return 'Saúde & Ortopedia';
  if (/pilates|fitness|muscul|yoga/i.test(value)) return 'Fitness & Pilates';
  if (/esporte|futebol|futsal/i.test(value)) return 'Esportes';
  if (/câmera|camera|informática|rede|eletrôn|tecnol/i.test(value)) return 'Tecnologia & Segurança';
  if (/cozinha|churrasco|casa/i.test(value)) return 'Casa & Churrasco';
  if (/brinquedo|infantil|bebê|utilidade/i.test(value)) return 'Utilidades & Infantil';
  return 'Geral';
}
function baseProduct(p, skuCounts) {
  if (!/^\d+$/.test(String(p.id)) || typeof p.nome !== 'string' || !p.nome.trim()) throw new Error('Produto Tiny sem identificação válida.');
  const slug = `tiny-${p.id}`;
  return { tinyId: String(p.id), slug, name: p.nome.trim(), sku: p.codigo && skuCounts.get(p.codigo) === 1 ? p.codigo : null,
    gtin: p.gtin || null, price: priceOf(p), oldPrice: null, discountPercent: 0, badge: null, freteGratis: false,
    active: p.situacao === 'A' && p.tipoVariacao !== 'P' && priceOf(p) > 0 };
}
function detailProduct(p) {
  const images = [...(p.anexos || []).map(x => x.anexo), ...(p.imagens_externas || []).map(x => x.imagem_externa || x.url || x)].filter(x => {
    try { return new URL(x).protocol === 'https:'; } catch { return false; }
  });
  const number = key => Number.isFinite(Number(p[key])) && Number(p[key]) > 0 ? Number(p[key]) : null;
  const description = String(p.descricao_complementar || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return { category: categoryOf(p.categoria || p.nome), brand: p.marca || '', description, shortDesc: description.slice(0, 240),
    image: images[0] || '/imgs/sem-imagem.svg', gallery: images,
    weight: number('peso_bruto'), height: number('alturaEmbalagem'), width: number('larguraEmbalagem'), length: number('comprimentoEmbalagem'), detailsSyncedAt: new Date() };
}
async function readCatalog(api) {
  const first = await api.productsPage(1), rows = [...first.products];
  for (let page = 2; page <= first.pages; page++) {
    const next = await api.productsPage(page);
    if (next.pages !== first.pages) throw new Error('Catálogo mudou durante consulta.');
    rows.push(...next.products);
  }
  if (new Set(rows.map(p => String(p.id))).size !== rows.length) throw new Error('IDs duplicados no catálogo.');
  return rows;
}
async function applyCatalog(tx, rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Catálogo vazio não pode substituir o catálogo atual.');
  const oldReserved = await tx.product.findFirst({ where: { NOT: { slug: { startsWith: 'tiny-' } }, reservedStock: { gt: 0 } }, select: { id: true } });
  if (oldReserved) throw new Error('Catálogo anterior possui pedidos reservados; concilie antes de substituir.');
  const skuCounts = new Map();
  for (const p of rows) if (p.codigo) skuCounts.set(p.codigo, (skuCounts.get(p.codigo) || 0) + 1);
  // Release former catalog SKU aliases before importing actual Tiny identities.
  await tx.product.updateMany({ where: { NOT: { slug: { startsWith: 'tiny-' } } }, data: { active: false, sku: null, tinyId: null, stock: 0 } });
  const ids = [];
  for (const p of rows) {
    const data = baseProduct(p, skuCounts); ids.push(data.tinyId);
    await tx.product.upsert({ where: { tinyId: data.tinyId }, create: { ...data, stock: 0, reservedStock: 0, rating: 0, reviewsCount: 0, image: '/imgs/sem-imagem.svg', gallery: [], category: 'Geral', brand: '' }, update: data });
  }
  await tx.product.updateMany({ where: { tinyId: { notIn: ids } }, data: { active: false, stock: 0 } });
  return ids.length;
}
async function syncCatalog(db, { token = process.env.TINY_API_TOKEN, client, batchSize = Number(process.env.TINY_DETAIL_BATCH_SIZE || 75) } = {}) {
  const api = client || createTinyClient(token, { beforeRequest: persistentRateLimit(db) });
  const startedAt = new Date();
  // Lock is held on its own connection, short independent writes avoid a massive
  // serializable transaction conflicting with live purchases for many minutes.
  return db.$transaction(async lock => {
    const [result] = await lock.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock(${SYNC_LOCK_ID}) AS locked`);
    if (!result?.locked) return { busy: true, success: false };
    const rows = await readCatalog(api);
    await db.$transaction(tx => applyCatalog(tx, rows), { timeout: 120000 });
    const count = Math.min(Math.max(Math.floor(batchSize) || 75, 1), 100);
    const products = await db.product.findMany({ where: { active: true, tinyId: { not: null } }, orderBy: [{ stockSyncedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }], take: count });
    let updated = 0, failed = 0;
    for (const p of products) {
      try {
        const details = !p.detailsSyncedAt || Date.now() - new Date(p.detailsSyncedAt).getTime() > 86400000 ? detailProduct(await api.productDetail(p.tinyId)) : {};
        const stock = await api.stock(p.tinyId);
        await db.$transaction(async tx => {
          await tx.product.update({ where: { id: p.id }, data: { ...details, stock, stockSyncedAt: new Date() } });
          await reconcileAcknowledgedStock(tx, startedAt, new Set([p.id]));
        }, { isolationLevel: 'Serializable' });
        updated++;
      } catch { failed++; }
    }
    await db.syncLog.create({ data: { source: 'TINY', status: failed ? 'PARTIAL' : 'SUCCESS', itemsSynced: updated, itemsFailed: failed, startedAt, completedAt: new Date(), message: `Catálogo oficial: ${rows.length}; saldos/detalhes atualizados neste lote: ${updated}.` } });
    return { success: failed === 0, catalogCount: rows.length, syncedCount: updated, failedCount: failed, batchSize: count };
  }, { timeout: 900000, maxWait: 10000 });
}
async function refreshCartStock(db, items, { client } = {}) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('Carrinho inválido.');
  const keys = items.map(p => p?.slug || p?.id);
  if (keys.some(k => typeof k !== 'string')) throw new Error('Produto inválido.');
  const products = await db.product.findMany({ where: { active: true, OR: [{ id: { in: keys } }, { slug: { in: keys } }] } });
  if (!products.length) throw new Error('Produtos indisponíveis.');
  if(products.every(p => p.detailsSyncedAt && p.stockSyncedAt && Date.now()-new Date(p.stockSyncedAt).getTime()<60000)) return;
  const api = client || createTinyClient(process.env.TINY_API_TOKEN, { beforeRequest: persistentRateLimit(db) });
  return db.$transaction(async lock => {
    const [result] = await lock.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock(${SYNC_LOCK_ID}) AS locked`);
    if (!result?.locked) throw new Error('Estoque em atualização. Tente novamente.');
    for (const p of products) {
      if (!p.tinyId) throw new Error('Produto sem ID Tiny.');
      // Freshness is deliberately short for checkout. No update touches reservations.
      if (p.stockSyncedAt && Date.now() - new Date(p.stockSyncedAt).getTime() < 60000 && p.detailsSyncedAt) continue;
      const remote = await api.productDetail(p.tinyId), stock = await api.stock(p.tinyId);
      await db.product.update({ where: { id: p.id }, data: { ...detailProduct(remote), name: remote.nome, price: priceOf(remote), active: remote.situacao === 'A' && remote.tipoVariacao !== 'P' && priceOf(remote) > 0, stock, stockSyncedAt: new Date() } });
    }
  }, { timeout: 900000, maxWait: 10000 });
}
module.exports = { priceOf, categoryOf, baseProduct, detailProduct, readCatalog, applyCatalog, syncCatalog, refreshCartStock };
