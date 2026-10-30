require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

function initialProduct(p, association) {
  const confirmed = association?.confirmed === true;
  const shipping = {};
  for (const name of ['weight', 'height', 'width', 'length']) shipping[name] = confirmed && Number.isFinite(association[name]) && association[name] > 0 ? association[name] : null;
  const price = Number(p.price);
  if (!p.slug || !p.name || !Number.isFinite(price) || price <= 0) throw new Error('Produto do catálogo sem identificação ou preço válido.');
  return {
    // Catalog sequence IDs are not Tiny IDs. Associations must be reviewed first.
    tinyId: confirmed && /^\d+$/.test(String(association.tinyId || '')) ? String(association.tinyId) : null,
    sku: confirmed && typeof association.sku === 'string' && association.sku.trim() ? association.sku.trim() : null,
    slug: p.slug, name: p.name, category: p.category || 'Geral', brand: p.brand || 'Canal Distribuidora',
    price, oldPrice: Number.isFinite(Number(p.oldPrice)) && Number(p.oldPrice) > price ? Number(p.oldPrice) : null,
    discountPercent: Number.isFinite(p.discountPercent) ? p.discountPercent : 0,
    stock: 0, reservedStock: 0, freteGratis: false, badge: p.badge || null,
    rating: 0, reviewsCount: 0,
    image: p.image || '/imgs/canaltop.png', gallery: p.gallery || [p.image || '/imgs/canaltop.png'],
    meliLink: p.meliLink || null, description: p.description || p.short || p.name, shortDesc: p.short || p.name,
    // Shipping weights/dimensions must be confirmed; no invented default package.
    ...shipping, active: true,
  };
}

async function seed(db = prisma) {
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tiny-products.json'), 'utf8'));
  if (!Array.isArray(products) || !products.length) throw new Error('Catálogo Tiny ausente.');
  const { applyCatalog } = require('../lib/tiny-catalog.cjs');
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail || adminPassword) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail || '') || typeof adminPassword !== 'string' || adminPassword.length < 16) throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD exclusivos (mínimo 16 caracteres) são obrigatórios para criar administrador.');
  }
  await db.$transaction(tx => applyCatalog(tx, products), { timeout: 120000 });
  if (adminEmail) {
    const existing = await db.user.findUnique({ where: { email: adminEmail }, select: { role: true } });
    if (existing && existing.role !== 'ADMIN') throw new Error('O e-mail informado pertence a um cliente; não foi promovido automaticamente.');
    await db.user.upsert({ where: { email: adminEmail }, create: { name: 'Administrador Canal', email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12), role: 'ADMIN' }, update: {} });
  }
  return { products: products.length, source: 'TINY', adminRequested: Boolean(adminEmail) };
}
if (require.main === module) {
  seed().then(result => console.log('[SEED]', JSON.stringify(result))).catch(() => {
    console.error('[SEED] Não concluído. Confira o catálogo, banco e variáveis de administrador.');
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
module.exports = { seed, initialProduct };
