const { createTinyClient, persistentRateLimit, SYNC_LOCK_ID } = require('./tiny-sync.cjs');
const cents = value => Math.round(Number(value) * 100);
const text = (value, max, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} inválido para exportação.`);
  return value.trim();
};

function buildTinyOrder(order) {
  if (order.paymentStatus !== 'PAID' || order.paymentReview || order.stockReleased) throw new Error('Pedido não elegível para envio.');
  if (!Array.isArray(order.items) || !order.items.length || order.items.length > 100) throw new Error('Itens inválidos.');
  const items = order.items.map(item => {
    if (!/^\d+$/.test(String(item.tinyId || '')) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.price) || item.price <= 0) throw new Error('Produto sem associação confirmada ou quantidade/preço inválido.');
    return { item: { id_produto: String(item.tinyId), ...(item.sku ? { codigo: item.sku } : {}), descricao: text(item.name, 120, 'Descrição'), unidade: 'UN', quantidade: item.quantity, valor_unitario: cents(item.price) / 100 } };
  });
  const subtotal = order.items.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0);
  if (![order.total, order.shippingCost, order.discount].every(value => Number.isFinite(value) && value >= 0) || subtotal + cents(order.shippingCost) - cents(order.discount) !== cents(order.total)) throw new Error('Total do pedido divergente.');
  const address = {
    tipo_pessoa: 'F', cpf_cnpj: String(order.customerCpf).replace(/\D/g, ''),
    endereco: text(order.shippingStreet, 50, 'Rua'), numero: text(order.shippingNum, 10, 'Número'),
    complemento: order.shippingComp || '', bairro: text(order.shippingDist, 30, 'Bairro'), cep: String(order.shippingCep).replace(/\D/g, ''),
    cidade: text(order.shippingCity, 30, 'Cidade'), uf: text(order.shippingState, 2, 'UF'), fone: order.customerPhone,
  };
  if (!/^\d{11}$/.test(address.cpf_cnpj) || !/^\d{8}$/.test(address.cep) || address.complemento.length > 50) throw new Error('Documento ou endereço inválido para exportação.');
  const name = text(order.customerName, 60, 'Nome');
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(order.createdAt));
  return { pedido: {
    data_pedido: date, numero_pedido_ecommerce: text(order.orderNumber, 50, 'Referência'),
    cliente: { nome: name.slice(0, 30), ...address, email: order.customerEmail, atualizar_cliente: 'N' },
    endereco_entrega: { ...address, nome_destinatario: name }, itens: items,
    valor_frete: cents(order.shippingCost) / 100, valor_desconto: cents(order.discount) / 100,
    frete_por_conta: order.shippingCost > 0 ? 'D' : 'R', situacao: 'aprovado',
    meio_pagamento: 'Asaas', obs_internas: 'Pagamento confirmado no Asaas. Não lançar contas a receber novamente.',
  } };
}

function remoteReference(order) { return String(order?.numero_ecommerce || order?.numero_pedido_ecommerce || ''); }
function remoteMatches(local, remote) {
  if (!remote || String(remote.id || '') === '' || remoteReference(remote) !== local.orderNumber) return false;
  const total = remote.total_pedido ?? remote.valor;
  if (!Number.isFinite(Number(total)) || cents(total) !== cents(local.total)) return false;
  if (remote.cliente?.cpf_cnpj && String(remote.cliente.cpf_cnpj).replace(/\D/g, '') !== String(local.customerCpf).replace(/\D/g, '')) return false;
  const remoteItems = remote.itens?.map(wrapper => wrapper?.item);
  if (!remoteItems || remoteItems.length !== local.items.length) return false;
  const quantities = new Map();
  for (const item of remoteItems) {
    if (!item?.id_produto || !Number.isFinite(Number(item.quantidade))) return false;
    quantities.set(String(item.id_produto), (quantities.get(String(item.id_produto)) || 0) + Number(item.quantidade));
  }
  const localQuantities = new Map();
  for (const item of local.items) localQuantities.set(String(item.tinyId), (localQuantities.get(String(item.tinyId)) || 0) + item.quantity);
  return quantities.size === localQuantities.size && [...localQuantities].every(([id, quantity]) => quantities.get(id) === quantity);
}

async function markReview(prisma, orderId, message) {
  await prisma.order.update({ where: { id: orderId }, data: { tinyExportStatus: 'REVIEW', tinyExportError: message } });
}

// Each order receives at most one creation POST from this integration. The durable
// attempt is written outside the advisory-lock transaction BEFORE any remote write.
// A crash/timeout can leave an unknown result; subsequent runs only search/reconcile.
async function processOne(prisma, api, order) {
  let payload;
  try { payload = buildTinyOrder(order); }
  catch { await markReview(prisma, order.id, 'Confira os itens, associações, total e endereço antes do envio ao ERP.'); return 'REVIEW'; }
  if (order.tinyOrderId) return 'SENT';
  const found = await api.findOrdersByReference(order.orderNumber);
  if (found.length > 1) { await markReview(prisma, order.id, 'Mais de um pedido remoto para a referência. Não reenviar.'); return 'REVIEW'; }
  if (found.length === 1) {
    const detail = await api.orderDetail(found[0].id);
    if (!remoteMatches(order, detail)) { await markReview(prisma, order.id, 'Pedido remoto encontrado com dados divergentes. Não reenviar.'); return 'REVIEW'; }
    await prisma.order.update({ where: { id: order.id }, data: { tinyOrderId: String(detail.id), tinyExportStatus: 'SENT', tinyExportedAt: new Date(), tinyExportError: null } });
    return 'RECOVERED';
  }
  if (order.tinyExportAttemptedAt || order.tinyExportStatus !== 'PENDING') {
    await markReview(prisma, order.id, 'Resultado de tentativa anterior ainda não localizado. Conferir no Tiny; não reenviar automaticamente.');
    return 'REVIEW';
  }
  const attemptedAt = new Date();
  const claimed = await prisma.order.updateMany({ where: { id: order.id, paymentStatus: 'PAID', paymentReview: false, stockReleased: false,
    tinyExportStatus: 'PENDING', tinyExportAttemptedAt: null, tinyOrderId: null }, data: { tinyExportStatus: 'SENDING', tinyExportAttemptedAt: attemptedAt, tinyExportError: null } });
  if (claimed.count !== 1) return 'SKIPPED';
  const current = await prisma.order.findUnique({ where: { id: order.id }, select: { paymentStatus: true, paymentReview: true } });
  if (!current || current.paymentStatus !== 'PAID' || current.paymentReview) { await markReview(prisma, order.id, 'Pagamento alterado durante preparação do envio.'); return 'REVIEW'; }
  try {
    const remote = await api.createOrder(payload);
    // No local reservation is released merely because the remote order exists.
    await prisma.order.update({ where: { id: order.id }, data: { tinyOrderId: remote.id, tinyExportStatus: 'SENT', tinyExportedAt: new Date(), tinyExportError: null } });
    return 'SENT';
  } catch {
    await markReview(prisma, order.id, 'Envio não confirmado. A tentativa foi registrada; reconciliar por referência sem repetir criação.');
    return 'REVIEW';
  }
}

async function exportPaidOrders(prisma, { token = process.env.TINY_API_TOKEN, enabled = process.env.TINY_ENVIAR_PEDIDOS === 'true', client,
  orderId, limit = 10, transactionTimeoutMs = 900000 } = {}) {
  if (!enabled) return { enabled: false, sent: 0, recovered: 0, review: 0 };
  if (!token && !client) throw new Error('TINY_API_TOKEN não configurado.');
  const api = client || createTinyClient(token, { beforeRequest: persistentRateLimit(prisma) });
  return prisma.$transaction(async lockTx => {
    const [lock] = await lockTx.$queryRawUnsafe(`SELECT pg_try_advisory_xact_lock(${SYNC_LOCK_ID}) AS locked`);
    if (!lock?.locked) return { enabled: true, busy: true, sent: 0, recovered: 0, review: 0 };
    const orders = await prisma.order.findMany({ where: { ...(orderId ? { id: orderId } : {}), paymentStatus: 'PAID', paymentReview: false,
      stockReleased: false, tinyOrderId: null, tinyExportStatus: { in: ['PENDING', 'SENDING', 'REVIEW'] } }, include: { items: true },
      orderBy: { createdAt: 'asc' }, take: Math.min(Math.max(limit, 1), 50) });
    const result = { enabled: true, sent: 0, recovered: 0, review: 0, failedReads: 0 };
    for (const order of orders) {
      try {
        const status = await processOne(prisma, api, order);
        if (status === 'SENT') result.sent++;
        else if (status === 'RECOVERED') result.recovered++;
        else if (status === 'REVIEW') result.review++;
      } catch {
        // A lookup failure is not permission to submit a creation request.
        result.failedReads++;
      }
    }
    return result;
  }, { timeout: transactionTimeoutMs, maxWait: 10000 });
}

async function acknowledgeTinyStock(prisma, orderId, reference) {
  if (typeof reference !== 'string' || reference.trim().length < 3 || reference.trim().length > 200) throw new Error('Informe a referência da baixa no Tiny.');
  return prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus !== 'PAID' || order.paymentReview || order.tinyExportStatus !== 'SENT' || !order.tinyOrderId || order.stockReleased) throw new Error('Pedido não elegível para confirmação da baixa.');
    if (order.tinyStockAcknowledgedAt) return { acknowledged: true, alreadyAcknowledged: true };
    await tx.order.update({ where: { id: orderId }, data: { tinyStockAcknowledgedAt: new Date(), tinyStockAcknowledgement: reference.trim() } });
    return { acknowledged: true, alreadyAcknowledged: false };
  }, { isolationLevel: 'Serializable' });
}

module.exports = { buildTinyOrder, remoteMatches, processOne, exportPaidOrders, acknowledgeTinyStock };
