import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import CoraBot from '../components/CoraBot';
import ProductCard from '../components/ProductCard';

export default function Favoritos() {
  const [favorites, setFavorites] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('cm.favorites') || '[]');
      setFavorites(favs);
    } catch (e) {
      setFavorites([]);
    }
  }, []);

  const removeFavorite = (slug) => {
    const updated = favorites.filter((f) => f.slug !== slug);
    setFavorites(updated);
    localStorage.setItem('cm.favorites', JSON.stringify(updated));
  };

  const addToCart = (product) => {
    try {
      const cart = JSON.parse(localStorage.getItem('cm.cart') || '[]');
      const existing = cart.find((i) => i.slug === product.slug);
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
        <title>Meus Favoritos — Canal Marketplace</title>
      </Head>

      <Header onOpenCart={() => setIsCartOpen(true)} />

      <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
        <div className="container">
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F253C', marginBottom: '24px' }}>
            Meus Produtos Favoritos ({favorites.length})
          </h1>

          {favorites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <img src="/imgs/cora/2.png" alt="Sem favoritos" style={{ width: '120px', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F253C', marginBottom: '8px' }}>
                Nenhum produto salvo como favorito
              </h2>
              <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
                Clique no ícone de coração nos produtos para salvá-los e acompanhar preços.
              </p>
              <Link href="/loja" className="hero-cta-btn" style={{ display: 'inline-flex' }}>
                Ver Catálogo
              </Link>
            </div>
          ) : (
            <div className="product-grid">
              {favorites.map((p) => <ProductCard key={p.id || p.slug} product={p} onAdd={addToCart} />)}
            </div>
          )}
        </div>
      </main>

      <Footer />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <CoraBot />
    </>
  );
}
