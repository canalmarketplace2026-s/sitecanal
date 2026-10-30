const { createTinyClient } = require('./tiny-sync.cjs');
// Only the syncTiny entry point performs production reads, under a shared DB lock.
// These helpers share one sequential queue for any same-process callers.
const clients = new Map();
function clientFor(token) {
  if (!clients.has(token)) clients.set(token, createTinyClient(token));
  return clients.get(token);
}
export async function fetchTinyProductsPage(token, page = 1) {
  return (await clientFor(token).productsPage(page)).products.map(produto => ({ produto }));
}
export async function fetchTinyProductDetail(token, tinyId) {
  return clientFor(token).productDetail(tinyId);
}
export async function fetchTinyProductStock(token, tinyId) {
  return clientFor(token).stock(tinyId);
}

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

export function categorize(title = '') {
  const t = title.toLowerCase();
  if (t.includes('cinta') || t.includes('corselet') || t.includes('bengala') || t.includes('calcanheira') || t.includes('suporte bolsa gel') || t.includes('bolsa água quente') || t.includes('bolsa termica') || t.includes('imobilizador')) {
    return 'Saúde & Ortopedia';
  }
  if (t.includes('band') || t.includes('faixa') || t.includes('faixas') || t.includes('elastica') || t.includes('pilates') || t.includes('yoga') || t.includes('bola overball') || t.includes('corda de pular') || t.includes('bola suíça') || t.includes('bola ginastica')) {
    return 'Fitness & Pilates';
  }
  if (t.includes('futsal') || t.includes('bola de futsal') || t.includes('topper') || t.includes('uhlsport') || t.includes('futebol')) {
    return 'Esportes';
  }
  if (t.includes('câmera') || t.includes('camera') || t.includes('cabo') || t.includes('dio') || t.includes('patch cord') || t.includes('furukawa') || t.includes('commscope') || t.includes('legrand')) {
    return 'Tecnologia & Segurança';
  }
  if (t.includes('cutelo') || t.includes('tábua') || t.includes('garra') || t.includes('afiador')) {
    return 'Casa & Churrasco';
  }
  if (t.includes('porta j') || t.includes('porta joia') || t.includes('bebê') || t.includes('brinquedo') || t.includes('boneca') || t.includes('palhaco')) {
    return 'Utilidades & Infantil';
  }
  return 'Geral';
}

export function detectBrand(title = '') {
  const t = title.toLowerCase();
  if (t.includes('hidrolight')) return 'Hidrolight';
  if (t.includes('esbelt')) return 'Esbelt';
  if (t.includes('topper')) return 'Topper';
  if (t.includes('furukawa')) return 'Furukawa';
  if (t.includes('legrand')) return 'Legrand';
  if (t.includes('commscope')) return 'Commscope';
  if (t.includes('uhlsport')) return 'Uhlsport';
  if (t.includes('diadora')) return 'Diadora';
  if (t.includes('king')) return 'King Premium';
  return 'Canal Distribuidora';
}


// The worker is the normal durable outbox consumer; this helper accepts only a stored order ID.
export async function sendOrderToTiny(orderData, db) {
  if (!db || !orderData?.id) throw new Error('Informe um pedido persistido e o banco para exportação.');
  const { exportPaidOrders } = require('./tiny-orders.cjs');
  return exportPaidOrders(db, { orderId: orderData.id });
}
