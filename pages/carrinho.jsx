import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CoraBot from '../components/CoraBot';

export default function Carrinho() {
  const [items, setItems] = useState([]);
  const [coupon, setCoupon] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  const loadCart = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('cm.cart') || '[]');
      setItems(saved);
      const appliedCoupon = localStorage.getItem('cm.coupon');
      if (appliedCoupon === 'CANAL10' || appliedCoupon === 'CORA10') {
        setDiscountPercent(10);
      }
    } catch (e) {
      setItems([]);
    }
  };

  useEffect(() => {
    loadCart();
  }, []);

  const updateQuantity = (idx, delta) => {
    const updated = [...items];
    const newQty = (updated[idx].qty || 1) + delta;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else {
      updated[idx].qty = newQty;
    }
    setItems(updated);
    localStorage.setItem('cm.cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const removeItem = (idx) => {
    const updated = [...items];
    updated.splice(idx, 1);
    setItems(updated);
    localStorage.setItem('cm.cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const applyCoupon = () => {
    const clean = coupon.trim().toUpperCase();
    if (clean === 'CANAL10' || clean === 'CORA10') {
      localStorage.setItem('cm.coupon', clean);
      setDiscountPercent(10);
      alert(`🎉 Cupom ${clean} aplicado! 10% de desconto.`);
    } else {
      alert('Cupom inválido. Use CANAL10 ou CORA10.');
    }
  };

  const subtotal = items.reduce((acc, it) => acc + (parseFloat(it.price) * (it.qty || 1)), 0);
  const discount = (subtotal * discountPercent) / 100;
  const total = Math.max(subtotal - discount, 0);
  const isFreeShipping = subtotal >= 199;

  return (
    <>
      <Head>
        <title>Sacola de Compras — Canal Marketplace</title>
      </Head>

      <Header />

      <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
        <div className="container">
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F253C', marginBottom: '24px' }}>
            Minha Sacola de Compras ({items.length})
          </h1>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <img src="/imgs/cora/6.png" alt="Sacola vazia" style={{ width: '120px', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F253C', marginBottom: '8px' }}>
                Sua sacola está vazia
              </h2>
              <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
                Você ainda não escolheu nenhum produto. Conheça as ofertas oficiais da Canal Marketplace!
              </p>
              <Link href="/loja" className="hero-cta-btn" style={{ display: 'inline-flex' }}>
                Ir às Compras
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
              {/* Items List */}
              <div style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px' }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px 0', borderBottom: idx < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <img src={it.image || '/imgs/canaltop.png'} alt={it.name} style={{ width: '70px', height: '70px', objectFit: 'contain', border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F253C' }}>{it.name}</div>
                      <div style={{ fontWeight: 800, fontSize: '16px', color: '#0F253C', margin: '4px 0' }}>
                        R$ {(it.price * (it.qty || 1)).toFixed(2).replace('.', ',')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '6px' }}>
                          <button onClick={() => updateQuantity(idx, -1)} style={{ padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>−</button>
                          <span style={{ padding: '0 8px', fontWeight: 700, fontSize: '13px' }}>{it.qty || 1}</span>
                          <button onClick={() => updateQuantity(idx, 1)} style={{ padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>+</button>
                        </div>
                        <button onClick={() => removeItem(idx)} style={{ color: '#EF4444', background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', height: 'fit-content' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F253C', marginBottom: '16px' }}>
                  Resumo do Pedido
                </h3>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                  <button onClick={applyCoupon} style={{ padding: '10px 16px', background: '#0F253C', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                    Aplicar
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748B', marginBottom: '8px' }}>
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748B', marginBottom: '8px' }}>
                  <span>Frete estimado</span>
                  <span>{isFreeShipping ? <strong style={{ color: '#059669' }}>Grátis (acima de R$ 199)</strong> : 'Calculado no checkout'}</span>
                </div>

                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#059669', fontWeight: 700, marginBottom: '8px' }}>
                    <span>Desconto cupom</span>
                    <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 900, color: '#0F253C', margin: '16px 0', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <span>Total</span>
                  <span>R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>

                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '12px', textAlign: 'center', marginBottom: '16px', color: '#065F46', fontWeight: 800, fontSize: '13px' }}>
                  ⚡ Pagando no Pix (10% OFF): R$ {(total * 0.9).toFixed(2).replace('.', ',')}
                </div>

                <Link href="/checkout" className="hero-cta-btn" style={{ width: '100%', justifyContent: 'center', fontSize: '16px', padding: '14px' }}>
                  🔒 Prosseguir para Checkout
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <CoraBot />
    </>
  );
}
