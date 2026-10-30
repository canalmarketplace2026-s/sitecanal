// Melhor Envio: provider mutations are explicit admin actions, never checkout side effects.
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
const cents = value => Math.round(Number(value) * 100);
const digits = value => String(value || '').replace(/\D/g, '');

function shippingError(message, status = 400) { const error = new Error(message); error.status = status; return error; }
function providerBase(env = process.env) { return env.MELHOR_ENVIO_SANDBOX === 'true' ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br'; }
function createShippingClient({ env = process.env, fetchImpl = fetch } = {}) {
  return {
    async request(path, body) {
      if (!env.MELHOR_ENVIO_TOKEN) throw shippingError('Configure a integração do Melhor Envio.', 503);
      if (!/^\/me\/(?:cart|shipment\/(?:checkout|generate|print|tracking)|orders\/[A-Za-z0-9-]+)$/.test(path)) throw shippingError('Operação de envio inválida.');
      const response = await fetchImpl(`${providerBase(env)}/api/v2${path}`, {
        method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${env.MELHOR_ENVIO_TOKEN}`, 'User-Agent': 'CanalMarketplace/1.0 (site@canalmarketplace.com.br)' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw shippingError(`Melhor Envio não concluiu a operação (HTTP ${response.status}).`, 502);
      const result = await response.json();
      if (result?.error || result?.errors || result?.success === false) throw shippingError('O Melhor Envio retornou uma operação não concluída.', 502);
      return result;
    },
  };
}

function senderFromEnvironment(env = process.env) {
  const fields = { name: 'NAME', email: 'EMAIL', phone: 'PHONE', company_document: 'COMPANY_DOCUMENT', state_register: 'STATE_REGISTER', address: 'ADDRESS', number: 'NUMBER', district: 'DISTRICT', city: 'CITY', postal_code: 'CEP', state_abbr: 'STATE' };
  const sender = {};
  for (const [key, suffix] of Object.entries(fields)) {
    const value = env[`MELHOR_ENVIO_FROM_${suffix}`];
    if (!value || !String(value).trim()) throw shippingError(`Complete os dados de remetente: ${suffix}.`);
    sender[key] = String(value).trim();
  }
  sender.company_document = digits(sender.company_document);
  sender.phone = digits(sender.phone);
  sender.postal_code = digits(sender.postal_code);
  if (sender.company_document.length !== 14 || sender.postal_code.length !== 8 || !/^\d{10,11}$/.test(sender.phone) || !/^[A-Z]{2}$/.test(sender.state_abbr)) throw shippingError('Revise CNPJ, CEP, telefone e UF do remetente.');
  sender.complement = env.MELHOR_ENVIO_FROM_COMPLEMENT || '';
  if (env.MELHOR_ENVIO_FROM_ECONOMIC_ACTIVITY_CODE) sender.economic_activity_code = digits(env.MELHOR_ENVIO_FROM_ECONOMIC_ACTIVITY_CODE);
  return sender;
}

function buildCartPayloads(order, invoiceKey, env = process.env) {
  if (order.paymentStatus !== 'PAID') throw shippingError('Somente pedidos com pagamento confirmado podem gerar etiquetas.', 409);
  if (!/^\d{44}$/.test(invoiceKey || '')) throw shippingError('Informe a chave de 44 dígitos da nota fiscal deste pedido.');
  const quote = order.shippingQuote;
  if (!quote || !Number.isSafeInteger(Number(quote.serviceId || quote.id)) || !Array.isArray(quote.packages) || !quote.packages.length) throw shippingError('Este pedido não tem uma cotação de envio com volumes. Recalcule antes da operação.', 409);
  if (/latam|buslog/i.test(quote.company || '') && !env.MELHOR_ENVIO_AGENCY_ID) throw shippingError('Configure a agência de postagem desta transportadora antes de preparar a etiqueta.');
  if (/azul/i.test(quote.company || '')) throw shippingError('Este serviço exige informações adicionais da nota fiscal. Prepare o envio diretamente no Melhor Envio.');
  const from = senderFromEnvironment(env);
  const to = { name: order.customerName, email: order.customerEmail, phone: digits(order.customerPhone), document: digits(order.customerCpf), address: order.shippingStreet, number: order.shippingNum, complement: order.shippingComp || '', district: order.shippingDist, city: order.shippingCity, postal_code: digits(order.shippingCep), state_abbr: order.shippingState, country_id: 'BR' };
  if (!to.name || !to.address || !to.number || !to.district || !to.city || to.postal_code.length !== 8 || !/^\d{11}$/.test(to.document)) throw shippingError('Dados de destinatário incompletos.');
  const byId = new Map((order.items || []).filter(item => item.productId).map(item => [String(item.productId), item]));
  const allocated = new Map();
  const payloads = quote.packages.map((pkg, index) => {
    const volume = { height: Number(pkg.dimensions?.height), width: Number(pkg.dimensions?.width), length: Number(pkg.dimensions?.length), weight: Number(pkg.weight) };
    if (!Object.values(volume).every(positive) || !Array.isArray(pkg.products) || !pkg.products.length) throw shippingError('A cotação contém um volume sem medidas ou conteúdo confirmado.');
    const products = pkg.products.map(p => {
      const item = byId.get(String(p.id));
      const quantity = Number(p.quantity);
      if (!item || !Number.isSafeInteger(quantity) || quantity < 1 || !positive(item.price)) throw shippingError('Conteúdo da cotação não corresponde aos produtos do pedido.');
      allocated.set(String(p.id), (allocated.get(String(p.id)) || 0) + quantity);
      return { name: item.name, quantity, unitary_value: item.price };
    });
    // One cart entry per package also works for providers that reject multiple volumes.
    const insurance = products.reduce((total, p) => total + cents(p.unitary_value) * p.quantity, 0) / 100;
    const payload = { service: Number(quote.serviceId || quote.id), from, to, products, volumes: [volume], options: { insurance_value: insurance, receipt: false, own_hand: false, reverse: false, invoice: { key: invoiceKey }, platform: 'Canal Marketplace', reminder: `${order.orderNumber} - volume ${index + 1}/${quote.packages.length}`, tags: [{ tag: `${order.orderNumber}:${index + 1}`, url: null }] } };
    if (env.MELHOR_ENVIO_AGENCY_ID) {
      if (!/^\d+$/.test(env.MELHOR_ENVIO_AGENCY_ID)) throw shippingError('Agência de postagem inválida.');
      payload.agency = Number(env.MELHOR_ENVIO_AGENCY_ID);
    }
    return payload;
  });
  for (const item of order.items || []) if (!item.productId || allocated.get(String(item.productId)) !== item.quantity) throw shippingError('Os volumes não contêm exatamente todos os produtos do pedido.');
  return payloads;
}

function safePrintUrl(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && (url.hostname === 'melhorenvio.com.br' || url.hostname.endsWith('.melhorenvio.com.br'))) return url.toString(); } catch {}
  throw shippingError('O provedor não retornou um link de impressão reconhecido.', 502);
}
function summary(order) {
  return { orderId: order.id, orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, shippingIntegrationStatus: order.shippingIntegrationStatus, melhorEnvioIds: order.melhorEnvioIds || [], shippingCartCost: order.shippingCartCost, shippingPrintUrl: order.shippingPrintUrl || null, trackingCode: order.trackingCode || null, shippingLastError: order.shippingLastError || null, shippingProviderData: order.shippingProviderData || null };
}
async function claim(db, order, fromStates, nextState) {
  const result = await db.order.updateMany({ where: { id: order.id, paymentStatus: 'PAID', shippingIntegrationStatus: { in: fromStates } }, data: { shippingIntegrationStatus: nextState, shippingAttemptedAt: new Date(), shippingLastError: null } });
  if (result.count !== 1) throw shippingError('Este envio já está em processamento ou mudou de estado. Atualize a consulta.', 409);
}
async function shippingAction(db, orderId, { action, invoiceKey, confirmedCost, confirmation } = {}, { env = process.env, client = createShippingClient({ env }) } = {}) {
  const order = await db.order.findFirst({ where: { OR: [{ id: orderId }, { orderNumber: orderId }] }, include: { items: true } });
  if (!order) throw shippingError('Pedido não encontrado.', 404);
  if (action === 'status') return summary(order);
  if (!['prepare', 'purchase', 'generate', 'print', 'track'].includes(action)) throw shippingError('Ação de envio inválida.');
  if (order.paymentStatus !== 'PAID') throw shippingError('O pagamento deste pedido ainda não está confirmado.', 409);
  const state = order.shippingIntegrationStatus || 'NONE';
  const ids = order.melhorEnvioIds || [];
  if (action === 'prepare') {
    if (state !== 'NONE') return summary(order); // Never blindly insert a second cart item.
    const payloads = buildCartPayloads(order, invoiceKey, env);
    await claim(db, order, ['NONE'], 'PREPARING');
    const created = []; let cost = 0;
    try {
      for (const payload of payloads) {
        const result = await client.request('/me/cart', payload);
        if (typeof result.id !== 'string' || !/^[A-Za-z0-9-]+$/.test(result.id) || !positive(result.price)) throw shippingError('Resposta incompleta ao criar o envio.', 502);
        created.push(result.id); cost += cents(result.price);
        await db.order.update({ where: { id: order.id }, data: { melhorEnvioIds: created.slice(), shippingCartCost: cost / 100, shippingInvoiceKey: invoiceKey, shippingProviderData: { expectedLabels: payloads.length, preparedLabels: created.length } } });
      }
      return summary(await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'CART_READY' } }));
    } catch {
      await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'REVIEW', shippingLastError: 'A criação pode ter sido recebida pelo provedor. Confira o carrinho do Melhor Envio antes de qualquer nova tentativa.' } });
      throw shippingError('Criação do envio precisa de conferência no Melhor Envio. Nenhuma nova etiqueta será criada automaticamente.', 409);
    }
  }
  if (!ids.length) throw shippingError('Prepare a etiqueta antes de continuar.', 409);
  if (action === 'purchase') {
    if (['PURCHASED', 'GENERATED', 'PRINTED'].includes(state)) return summary(order);
    if (env.SHIPPING_PURCHASE_ENABLED !== 'true') throw shippingError('Compra de etiquetas está desabilitada na configuração.', 409);
    if (confirmation !== `COMPRAR ${order.orderNumber}` || typeof confirmedCost !== 'number' || !positive(order.shippingCartCost) || cents(confirmedCost) !== cents(order.shippingCartCost)) throw shippingError('Confirme o pedido e o custo exato da etiqueta antes de debitar a carteira.');
    await claim(db, order, ['CART_READY'], 'PURCHASING');
    try {
      await client.request('/me/shipment/checkout', { orders: ids });
      return summary(await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'PURCHASED' } }));
    } catch {
      await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'REVIEW', shippingLastError: 'Resultado da compra não confirmado. Consulte o Melhor Envio; não repita o débito.' } });
      throw shippingError('Confira o pagamento da etiqueta no Melhor Envio antes de continuar.', 409);
    }
  }
  if (action === 'generate') {
    if (['GENERATED', 'PRINTED'].includes(state)) return summary(order);
    await claim(db, order, ['PURCHASED'], 'GENERATING');
    try {
      await client.request('/me/shipment/generate', { orders: ids });
      return summary(await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'GENERATED' } }));
    } catch {
      await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'REVIEW', shippingLastError: 'Resultado de geração não confirmado. Confira as etiquetas no Melhor Envio.' } });
      throw shippingError('A geração precisa de conferência no Melhor Envio.', 409);
    }
  }
  if (action === 'print') {
    if (!['GENERATED', 'PRINTED'].includes(state)) throw shippingError('Compre e gere a etiqueta antes de imprimir.', 409);
    const result = await client.request('/me/shipment/print', { mode: 'private', orders: ids });
    const url = safePrintUrl(result.url);
    return summary(await db.order.update({ where: { id: order.id }, data: { shippingIntegrationStatus: 'PRINTED', shippingPrintUrl: url } }));
  }
  const details = await Promise.all(ids.map(id => client.request(`/me/orders/${encodeURIComponent(id)}`)));
  const sanitized = details.map((detail, index) => ({ id: ids[index], status: String(detail.status || 'unknown').slice(0, 40), tracking: typeof detail.tracking === 'string' ? detail.tracking.slice(0, 100) : null }));
  const tracking = sanitized.map(detail => detail.tracking).filter(Boolean);
  return summary(await db.order.update({ where: { id: order.id }, data: { shippingProviderData: { labels: sanitized }, ...(tracking.length ? { trackingCode: tracking.join(', ') } : {}) } }));
}

module.exports = { createShippingClient, senderFromEnvironment, buildCartPayloads, safePrintUrl, shippingAction, shippingError, summary };
