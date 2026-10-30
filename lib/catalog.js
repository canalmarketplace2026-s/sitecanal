export async function resolveCart(db, items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) throw new Error('Carrinho inválido.');
  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new Error('Produto inválido.');
    const key = item.slug || item.id;
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    if (typeof key !== 'string' || !key || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('Produto ou quantidade inválidos.');
    quantities.set(key, (quantities.get(key) || 0) + quantity);
  }
  const lines = new Map();
  for (const [key, quantity] of quantities) {
    const product = await db.product.findFirst({ where: { active: true, OR: [{ id: key }, { slug: key }] } });
    if (!product || !Number.isFinite(product.price) || product.price <= 0) throw new Error('Produto indisponível.');
    const syncedAt = new Date(product.stockSyncedAt || 0).getTime();
    if (!product.tinyId || !Number.isFinite(syncedAt) || Date.now() - syncedAt > 30 * 60 * 1000 || syncedAt > Date.now() + 60000) throw new Error(`Estoque em atualização: ${product.name}`);
    const previous = lines.get(product.id);
    const totalQty = quantity + (previous?.quantity || 0);
    if (totalQty > 100 || product.stock - (product.reservedStock || 0) < totalQty) throw new Error(`Estoque insuficiente: ${product.name}`);
    lines.set(product.id, { ...product, quantity: totalQty });
  }
  const products = [...lines.values()];
  const subtotal = products.reduce((sum, p) => sum + Math.round(p.price * 100) * p.quantity, 0) / 100;
  return { products, subtotal };
}
