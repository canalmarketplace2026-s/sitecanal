import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import CoraBot from '../components/CoraBot';

export default function Loja() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [sortBy, setSortBy] = useState('relevance');

  const categories = [
    'Todos',
    'Saúde & Ortopedia',
    'Fitness & Pilates',
    'Esportes',
    'Tecnologia & Segurança',
    'Casa & Churrasco',
    'Utilidades & Infantil',
  ];

  useEffect(() => {
    if (router.query.category) {
      setSelectedCategory(router.query.category);
    }
  }, [router.query.category]);

  useEffect(() => {
    setLoading(true);
    let url = `/api/products?limit=100&page=${page}`;
    if (selectedCategory !== 'Todos') {
      url += `&category=${encodeURIComponent(selectedCategory)}`;
    }
    if (router.query.q) {
      url += `&q=${encodeURIComponent(router.query.q)}`;
    }
    if (sortBy === 'price-asc') url += '&sort=price-asc';
    if (sortBy === 'price-desc') url += '&sort=price-desc';

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data?.products) setProducts(data.products);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedCategory, sortBy, router.query.q, page]);
  useEffect(() => { setPage(1); }, [selectedCategory, sortBy, router.query.q]);

  const addToCart = (product) => {
    try {
      const cart = JSON.parse(localStorage.getItem('cm.cart') || '[]');
      const existing = cart.find((i) => i.slug === product.slug || i.id === product.id);
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        cart.push({
          id: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          qty: 1,
        });
      }
      localStorage.setItem('cm.cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-updated'));
      setIsCartOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Head>
        <title>Catálogo Completo de Produtos — Canal Marketplace</title>
        <meta name="description" content="Navegue por todas as categorias e produtos da Canal Marketplace com frete grátis e Pix 10% OFF." />
      </Head>

      <Header onOpenCart={() => setIsCartOpen(true)} />

      <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
        <div className="container">
          {/* Breadcrumb & Filter header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-navy)', margin: '0 0 6px' }}>
                Catálogo de Produtos
              </h1>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '14px' }}>
                {loading ? 'Carregando itens...' : `${products.length} produtos disponíveis com garantia oficial`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)' }}>Ordenar por:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="relevance">Mais Relevantes</option>
                <option value="price-asc">Menor Preço</option>
                <option value="price-desc">Maior Preço</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '24px' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '24px',
                  border: selectedCategory === cat ? '2px solid var(--color-navy)' : '1px solid #E2E8F0',
                  background: selectedCategory === cat ? 'var(--color-navy)' : '#FFF',
                  color: selectedCategory === cat ? '#FFF' : '#334155',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
              Buscando produtos no estoque...
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <img src="/imgs/cora/6.png" alt="Nenhum produto" style={{ width: '120px', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-navy)', marginBottom: '8px' }}>
                Nenhum produto encontrado
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                Tente selecionar outra categoria ou limpar os termos de busca.
              </p>
              <button
                onClick={() => { setSelectedCategory('Todos'); router.push('/loja'); }}
                className="hero-cta-btn"
                style={{ display: 'inline-flex' }}
              >
                Ver Todos os Produtos
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {products.map((p) => {
                const pixPrice = p.price * 0.9;
                return (
                  <div key={p.id || p.slug} className="product-card">
                    {p.badge && <span className="product-badge">{p.badge}</span>}
                    {p.freteGratis && <span className="product-free-ship-tag">Frete Grátis</span>}

                    <Link href={`/produto/${p.slug}`} className="product-img-wrap">
                      <img src={p.image || '/imgs/canaltop.png'} alt={p.name} className="product-thumb-img" />
                    </Link>

                    <div className="product-info-box">
                      <span className="product-brand-tag">{p.brand || 'Canal Distribuidora'}</span>
                      <h3 className="product-card-title">
                        <Link href={`/produto/${p.slug}`}>{p.name}</Link>
                      </h3>

                      <div className="product-price-box">
                        {p.oldPrice && <span className="product-old-price">R$ {p.oldPrice.toFixed(2).replace('.', ',')}</span>}
                        <div className="product-current-price">
                          R$ {p.price.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="product-pix-price">
                          ⚡ R$ {pixPrice.toFixed(2).replace('.', ',')} no Pix (10% off)
                        </div>
                        <div className="product-installments">
                          em até 12x de R$ {(p.price / 12).toFixed(2).replace('.', ',')} sem juros
                        </div>
                      </div>

                      <button
                        type="button"
                        className="product-add-cart-btn"
                        onClick={() => addToCart(p)}
                      >
                        Adicionar à Sacola
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      <nav aria-label="Páginas do catálogo" style={{display:'flex',gap:20,justifyContent:'center',padding:24}}><button disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page} de {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)}>Próxima</button></nav></main>

      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <CoraBot />
    </>
  );
}
