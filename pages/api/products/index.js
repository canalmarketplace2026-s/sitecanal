import prisma from '../../../lib/prisma';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { category, q, sort } = req.query;
    const take = Math.min(Math.max(parseInt(req.query.limit, 10) || 16, 1), 100);
    const page = Math.min(Math.max(parseInt(req.query.page,10)||1,1),10000);
    const where = { active: true, ...(typeof category === 'string' ? { category } : {}), ...(typeof q === 'string' && q ? { name: { contains: q.slice(0, 120), mode: 'insensitive' } } : {}) };
    const products = await prisma.product.findMany({ where, take, skip: (page-1)*take, orderBy: sort === 'price-asc' ? { price: 'asc' } : sort === 'price-desc' ? { price: 'desc' } : { name: 'asc' } });
    const total = await prisma.product.count({where});
    return res.json({ page, total, totalPages: Math.ceil(total/take), products: products.map(p => ({ ...p, stock: Math.max(0, p.stock - p.reservedStock) })) });
  } catch { return res.status(503).json({ error: 'Catálogo temporariamente indisponível.' }); }
}
