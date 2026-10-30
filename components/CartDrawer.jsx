import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CartDrawer({ isOpen, onClose }) {
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
    if (isOpen) {
      loadCart();
    }
  }, [isOpen]);

  const updateQuantity = (idx, delta) => {
    const updated = [...items];
    const newQty = (updated[idx].qty || updated[idx].quantity || 1) + delta;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else {
      updated[idx].qty = newQty;
      updated[idx].quantity = newQty;
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
      alert(`🎉 Cupom ${clean} aplicado com sucesso! 10% de desconto.`);
    } else {
      alert('Cupom inválido. Experimente usar CANAL10 ou CORA10.');
    }
  };

  const subtotal = items.reduce((acc, it) => acc + (parseFloat(it.price) * (it.qty || it.quantity || 1)), 0);
  const discount = (subtotal * discountPercent) / 100;
  const total = Math.max(subtotal - discount, 0);
  const freeShippingGoal = 199;
  const progressPercent = Math.min((subtotal / freeShippingGoal) * 100, 100);

  if (!isOpen) return null;

  return (
    <div className="cart-drawer-overlay" onClick={onClose}>
      <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cart-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/imgs/cora/1.png" alt="Cora Mascote" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Sacola de Compras ({items.length})</h3>
          </div>
          <button className="cart-drawer-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        {/* Frete Grátis Bar */}
        <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '12.5px', color: '#1E293B', marginBottom: '6px', fontWeight: 600 }}>
            {subtotal >= freeShippingGoal ? (
              <span style={{ color: '#059669', fontWeight: 800 }}>🎉 Parabéns! Você ganhou Frete Grátis!</span>
            ) : (
              <span>Faltam <strong>R$ {(freeShippingGoal - subtotal).toFixed(2).replace('.', ',')}</strong> para <strong>Frete Grátis</strong></span>
            )}
          </div>
          <div style={{ width: '100%', height: '7px', background: '#E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #FFB800, #059669)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        <div className="cart-drawer-items">
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
              <img src="/imgs/cora/6.png" alt="Cora Vazia" style={{ width: '100px', margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 700, fontSize: '16px', color: '#0F253C' }}>Sua sacola está vazia</p>
              <p style={{ fontSize: '13px' }}>Explore nosso catálogo de produtos originais e aproveite!</p>
              <Link href="/loja" onClick={onClose} className="hero-cta-btn" style={{ display: 'inline-flex', marginTop: '16px' }}>
                Ver Ofertas
              </Link>
            </div>
          ) : (
            items.map((it, idx) => (
              <div key={idx} className="cart-item-row">
                <img src={it.image || '/imgs/canaltop.png'} alt={it.name} className="cart-item-thumb" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cart-item-name">{it.name}</div>
                  <div className="cart-item-price">R$ {(it.price * (it.qty || 1)).toFixed(2).replace('.', ',')}</div>
                  <div className="cart-item-qty-wrap">
                    <button onClick={() => updateQuantity(idx, -1)} className="qty-btn">−</button>
                    <span className="qty-val">{it.qty || it.quantity || 1}</span>
                    <button onClick={() => updateQuantity(idx, 1)} className="qty-btn">+</button>
                    <button onClick={() => removeItem(idx)} className="cart-item-remove-btn" title="Remover item">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Cupom (CANAL10)"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                }}
              />
              <button
                onClick={applyCoupon}
                style={{
                  padding: '8px 14px',
                  background: '#0F253C',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Aplicar
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', marginBottom: '4px' }}>
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#059669', fontWeight: 700, marginBottom: '4px' }}>
                <span>Desconto Cupom (10%)</span>
                <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 900, color: '#0F253C', margin: '8px 0 16px' }}>
              <span>Total</span>
              <span>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>

            <div style={{ fontSize: '12px', color: '#059669', fontWeight: 800, textAlign: 'center', marginBottom: '12px' }}>
              ⚡ No Pix com 10% OFF: R$ {(total * 0.9).toFixed(2).replace('.', ',')}
            </div>

            <Link href="/checkout" onClick={onClose} className="hero-cta-btn" style={{ width: '100%', justifyContent: 'center', fontSize: '16px', padding: '14px' }}>
              🔒 Finalizar Compra Segura
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
