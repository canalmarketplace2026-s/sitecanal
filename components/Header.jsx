import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header({ onOpenCart }) {
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const updateCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('cm.cart') || '[]');
        const count = cart.reduce((acc, it) => acc + (it.qty || it.quantity || 1), 0);
        setCartCount(count);
      } catch (e) {
        setCartCount(0);
      }
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('cart-updated', updateCount);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('cart-updated', updateCount);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/loja?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="container top-bar-inner">
          <div className="top-bar-left">
            <span className="top-bar-badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              Frete grátis
            </span>
            <span>acima de R$ 199 • <strong>10% OFF</strong> no Pix • Em até 12x</span>
          </div>
          <div className="top-bar-right">
            <a href="https://wa.me/5519992893859?text=Ol%C3%A1%2C%20Canal!%20Preciso%20de%20atendimento." target="_blank" rel="noreferrer" className="top-bar-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
              Atendimento WhatsApp
            </a>
            <Link href="/rastrear" className="top-bar-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Rastrear pedido
            </Link>
            <Link href="/conta" className="top-bar-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Minha Conta
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="header-brand">
            <img src="/imgs/canal logo.png" alt="Canal Marketplace" className="brand-logo-img" />
          </Link>

          <form className="header-search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Buscar produtos, marcas (Hidrolight, Furukawa, Topper)..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="search-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </form>

          <div className="header-actions">
            <Link href="/loja" className="action-btn" title="Ver catálogo completo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span className="action-btn-text">Catálogo</span>
            </Link>

            <Link href="/favoritos" className="action-btn" title="Meus Favoritos">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
              </svg>
              <span className="action-btn-text">Favoritos</span>
            </Link>

            <button
              type="button"
              className="action-btn cart-btn-action"
              onClick={onOpenCart || (() => { window.location.href = '/carrinho'; })}
              title="Sacola de Compras"
            >
              <div style={{ position: 'relative' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                  <path d="M3 6h18"></path>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                {cartCount > 0 && <span className="cart-badge-count">{cartCount}</span>}
              </div>
              <span className="action-btn-text">Carrinho</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <nav className="header-categories-nav">
          <div className="container nav-cats-inner">
            <Link href="/loja" className="nav-cat-link">Todas as Categorias</Link>
            <Link href="/loja?category=Saúde+%26+Ortopedia" className="nav-cat-link">Saúde & Ortopedia</Link>
            <Link href="/loja?category=Fitness+%26+Pilates" className="nav-cat-link">Fitness & Pilates</Link>
            <Link href="/loja?category=Esportes" className="nav-cat-link">Esportes & Lazer</Link>
            <Link href="/loja?category=Tecnologia+%26+Segurança" className="nav-cat-link">Tecnologia & Cabos</Link>
            <Link href="/loja?category=Casa+%26+Churrasco" className="nav-cat-link">Casa & Churrasco</Link>
            <Link href="/loja?category=Utilidades+%26+Infantil" className="nav-cat-link">Utilidades & Infantil</Link>
            <Link href="/suporte" className="nav-cat-link special-tag">Ajuda & Garantia</Link>
          </div>
        </nav>
      </header>
    </>
  );
}
