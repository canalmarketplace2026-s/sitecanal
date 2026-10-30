import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import CoraBot from '../components/CoraBot';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      badge: 'PROMOÇÃO EXCLUSIVA DE LANÇAMENTO',
      title: 'Conheça o catálogo da Canal',
      desc: 'Distribuidor oficial Hidrolight, Topper, Furukawa e King Premium com envio imediato e nota fiscal.',
      cta: 'Ver Ofertas do Dia',
      img: '/imgs/hero_prod_bands.png',
      link: '/loja',
    },
    {
      badge: '10% DE DESCONTO IMEDIATO',
      title: 'Economize Pagando no Pix',
      desc: 'Aproveite 10% de desconto adicional à vista ou parcele suas compras em até 12x sem juros.',
      cta: 'Aproveitar Desconto',
      img: '/imgs/hero_prod_bolapilates.png',
      link: '/loja?category=Fitness+%26+Pilates',
    },
    {
      badge: 'COMPRA 100% SEGURA & PROTEGIDA',
      title: 'Frete Grátis para Todo o Brasil',
      desc: 'Receba seus pedidos com agilidade nas compras acima de R$ 199. Rastreamento em tempo real.',
      cta: 'Conhecer Catálogo',
      img: '/imgs/hero_prod_cutelo.png',
      link: '/loja',
    },
  ];

  useEffect(() => {
    fetch('/api/products?limit=16')
      .then((res) => res.json())
      .then((data) => {
        if (data?.products) setProducts(data.products);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao carregar produtos:', err);
        setLoading(false);
      });

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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
        <title>Canal Marketplace — Ofertas que Valem a Pena | Loja Oficial</title>
        <meta name="description" content="Distribuidor oficial Canal Marketplace. Produtos do estoque oficial da Canal, Pix 10% off e frete para todo o Brasil." />
      </Head>

      <Header onOpenCart={() => setIsCartOpen(true)} />

      <main>
        {/* Hero Section */}
        <section className="hero-section">
          <div className="container hero-container">
            <div className="hero-content">
              <span className="hero-tag">{heroSlides[currentSlide].badge}</span>
              <h1 className="hero-title">{heroSlides[currentSlide].title}</h1>
              <p className="hero-description">{heroSlides[currentSlide].desc}</p>
              <div className="hero-actions">
                <Link href={heroSlides[currentSlide].link} className="hero-cta-btn">
                  {heroSlides[currentSlide].cta}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </Link>
                <Link href="/rastrear" className="hero-secondary-btn">
                  Rastrear Pedido
                </Link>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-stage">
                <img
                  src={heroSlides[currentSlide].img}
                  alt="Destaque Canal Marketplace"
                  className="hero-product-img"
                />
              </div>
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="hero-slider-dots">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                className={`slider-dot ${i === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </section>

        {/* Trust Badges */}
        <section className="trust-badges-bar">
          <div className="container trust-badges-grid">
            <div className="trust-item">
              <div className="trust-icon">⚡</div>
              <div>
                <strong>10% OFF no Pix</strong>
                <p>Desconto imediato na finalização</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon">🚚</div>
              <div>
                <strong>Frete Grátis</strong>
                <p>Em compras acima de R$ 199</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon">💳</div>
              <div>
                <strong>Até 12x Sem Juros</strong>
                <p>Parcele no cartão de crédito</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon">🛡️</div>
              <div>
                <strong>Garantia Oficial</strong>
                <p>Produtos 100% originais com NF</p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="catalog-section" style={{ padding: '60px 0' }}>
          <div className="container">
            <div className="section-header-row">
              <div>
                <span className="section-eyebrow">Destaques da Loja</span>
                <h2 className="section-title">Ofertas Mais Procuradas</h2>
              </div>
              <Link href="/loja" className="section-more-link">
                Ver Catálogo Completo →
              </Link>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
                Carregando produtos oficiais...
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
        </section>

        {/* Cora Mascot Banner */}
        <section className="cora-banner-section">
          <div className="container cora-banner-card">
            <div className="cora-banner-content">
              <span className="cora-badge">Conheça a Cora</span>
              <h2 className="cora-title">Dúvidas sobre seu produto ou pedido?</h2>
              <p className="cora-desc">
                Nossa mascote inteligente e equipe humana estão disponíveis no WhatsApp oficial para te orientar
                em qualquer etapa da sua compra.
              </p>
              <a
                href="https://wa.me/5519992893859?text=Ol%C3%A1%2C%20Canal!%20Gostaria%20de%20tirar%20uma%20d%C3%BAvida."
                target="_blank"
                rel="noreferrer"
                className="hero-cta-btn"
                style={{ display: 'inline-flex' }}
              >
                Falar com a Canal no WhatsApp
              </a>
            </div>
            <div className="cora-banner-avatar">
              <img src="/imgs/cora/10.png" alt="Cora Assistente" className="cora-banner-img" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <CoraBot />
    </>
  );
}
