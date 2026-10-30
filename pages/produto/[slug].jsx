import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import CartDrawer from '../../components/CartDrawer';
import CoraBot from '../../components/CoraBot';

export default function ProdutoDetail() {
  const router = useRouter();
  const { slug } = router.query;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState('');

  // Shipping simulation state
  const [cepInput, setCepInput] = useState('');
  const [shippingQuotes, setShippingQuotes] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/products/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setProduct(data);
          setActiveImage(data.image);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [slug]);

  const handleCalculateShipping = async (e) => {
    e.preventDefault();
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setShippingError('Digite um CEP válido com 8 dígitos.');
      return;
    }

    setShippingError('');
    setCalcLoading(true);
    setShippingQuotes(null);

    try {
      const res = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep: cleanCep,
          subtotal: (product?.price || 50) * quantity,
          items: [
            {
              id: product.id,
              slug: product.slug,
              width: product?.width,
              height: product?.height,
              length: product?.length,
              weight: product?.weight,
              price: product?.price || 50,
              quantity,
            },
          ],
        }),
      });

      const data = await res.json();
      if (data?.quotes) {
        setShippingQuotes(data.quotes);
      } else {
        setShippingError(data?.error || 'Não foi possível cotar o frete no momento.');
      }
    } catch (err) {
      setShippingError('Erro de conexão ao cotar frete.');
    } finally {
      setCalcLoading(false);
    }
  };

  const addToCart = (buyNow = false) => {
    if (!product || product.stock < quantity) { alert('Quantidade indisponível no estoque.'); return; }
    try {
      const cart = JSON.parse(localStorage.getItem('cm.cart') || '[]');
      const existing = cart.find((i) => i.slug === product.slug || i.id === product.id);
      if (existing) {
        existing.qty = (existing.qty || 1) + quantity;
      } else {
        cart.push({
          id: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          qty: quantity,
        });
      }
      localStorage.setItem('cm.cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-updated'));

      if (buyNow) {
        window.location.href = '/checkout';
      } else {
        setIsCartOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div style={{ textAlign: 'center', padding: '100px', color: '#64748B' }}>
          Carregando informações do produto...
        </div>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <h2>Produto não encontrado</h2>
          <p>O item solicitado não está mais disponível em nosso catálogo.</p>
          <Link href="/loja" className="hero-cta-btn" style={{ display: 'inline-flex', marginTop: '16px' }}>
            Explorar Loja
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const pixPrice = product.price * 0.9;
  const gallery = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image];

  return (
    <>
      <Head>
        <title>{product.name} — Canal Marketplace</title>
        <meta name="description" content={product.shortDesc || product.name} />
      </Head>

      <Header onOpenCart={() => setIsCartOpen(true)} />

      <main style={{ padding: '32px 0 80px', background: '#FAFAFA' }}>
        <div className="container">
          {/* Breadcrumb */}
          <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
            <Link href="/">Início</Link> &gt; <Link href={`/loja?category=${encodeURIComponent(product.category)}`}>{product.category}</Link> &gt; <span>{product.name}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', background: '#FFF', padding: '36px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            {/* Gallery Column */}
            <div>
              <div style={{ width: '100%', height: '420px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden' }}>
                <img
                  src={activeImage || product.image}
                  alt={product.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>

              {gallery.length > 1 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', overflowX: 'auto' }}>
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(img)}
                      style={{
                        width: '70px',
                        height: '70px',
                        border: activeImage === img ? '2px solid #0F253C' : '1px solid #CBD5E1',
                        borderRadius: '8px',
                        padding: '4px',
                        background: '#FFF',
                        cursor: 'pointer',
                      }}
                    >
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Purchase Column */}
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', background: '#E0F2FE', color: '#0369A1' }}>
                  {product.brand}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: '#DCFCE7', color: '#15803D' }}>
                  Estoque: {product.stock > 0 ? `${product.stock} un. prontas` : 'Indisponível'}
                </span>
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.3, marginBottom: '16px' }}>
                {product.name}
              </h1>

              {/* Price Box */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                {product.oldPrice && (
                  <div style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '14px' }}>
                    R$ {product.oldPrice.toFixed(2).replace('.', ',')}
                  </div>
                )}
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#0F253C', lineHeight: 1 }}>
                  R$ {product.price.toFixed(2).replace('.', ',')}
                </div>
                <div style={{ color: '#059669', fontWeight: 800, fontSize: '15px', marginTop: '6px' }}>
                  ⚡ R$ {pixPrice.toFixed(2).replace('.', ',')} à vista com 10% OFF no Pix
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  ou em até <strong>12x de R$ {(product.price / 12).toFixed(2).replace('.', ',')}</strong> sem juros
                </div>
              </div>

              {/* Quantity and Actions */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '8px', background: '#FFF' }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{ padding: '10px 16px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    −
                  </button>
                  <span style={{ padding: '0 8px', fontWeight: 800, fontSize: '15px' }}>{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    style={{ padding: '10px 16px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => addToCart(false)}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    borderRadius: '8px',
                    border: '2px solid #0F253C',
                    background: '#FFF',
                    color: '#0F253C',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: 'pointer',
                  }}
                >
                  Adicionar à Sacola
                </button>

                <button
                  onClick={() => addToCart(true)}
                  className="hero-cta-btn"
                  style={{ flex: 1.2, justifyContent: 'center', fontSize: '15px', padding: '14px 20px' }}
                >
                  ⚡ Comprar Agora
                </button>
              </div>

              {/* Melhor Envio Shipping Calculator */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', background: '#FFF', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '14px', fontWeight: 800, color: '#0F253C' }}>
                  🚚 Simular Frete e Prazo (Melhor Envio Oficial)
                </div>
                <form onSubmit={handleCalculateShipping} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Digite seu CEP (Ex: 13049-900)"
                    value={cepInput}
                    onChange={(e) => setCepInput(e.target.value)}
                    maxLength={9}
                    style={{ flex: 1, padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <button
                    type="submit"
                    disabled={calcLoading}
                    style={{ padding: '10px 18px', background: '#0F253C', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {calcLoading ? 'Calculando...' : 'Calcular'}
                  </button>
                </form>

                {shippingError && (
                  <p style={{ color: '#DC2626', fontSize: '12.5px', marginTop: '8px', fontWeight: 600 }}>{shippingError}</p>
                )}

                {shippingQuotes && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                    {shippingQuotes.map((q, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                        <div>
                          <strong>{q.company} · {q.name}</strong>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11.5px' }}>{q.deliveryTime}</span>
                        </div>
                        <div style={{ fontWeight: 800, color: q.isFree ? '#059669' : '#0F253C' }}>
                          {q.isFree ? 'GRÁTIS' : `R$ ${q.price.toFixed(2).replace('.', ',')}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Guarantees Box */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div>🛡️ <strong>Garantia Oficial:</strong> 90 dias direto com o distribuidor</div>
                <div>📄 <strong>Nota Fiscal:</strong> 100% faturado em seu nome/CPF</div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div style={{ marginTop: '32px', background: '#FFF', padding: '36px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F253C', marginBottom: '16px' }}>
              Descrição e Especificações
            </h3>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-line' }}>
              {product.description}
            </p>
          </div>
        </div>
      </main>

      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <CoraBot />
    </>
  );
}
