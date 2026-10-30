import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';

const statuses = { PAID: 'Pagamento confirmado', PENDING: 'Aguardando pagamento', PROCESSING: 'Pedido recebido; pagamento em processamento', CANCELLED: 'Pedido cancelado', REFUNDED: 'Pagamento estornado' };
export default function Rastrear() {
  const router = useRouter();
  const [orderQuery, setOrderQuery] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fetchOrder = async (id, suppliedAccess) => {
    if (!id) return;
    setLoading(true); setError(''); setOrder(null);
    try {
      const access = suppliedAccess || localStorage.getItem(`cm.order_access:${id}`);
      const auth = localStorage.getItem('cm.auth_token');
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}${access ? `?access=${encodeURIComponent(access)}` : ''}`, { cache: 'no-store', headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o pedido.');
      if (access) {
        try { localStorage.setItem(`cm.order_access:${data.orderNumber}`, access); localStorage.setItem(`cm.order_access:${data.id}`, access); } catch { /* Read access remains valid for this request. */ }
      }
      setOrder(data);
    } catch (err) { setError(err.message || 'Erro de conexão ao buscar pedido.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!router.isReady || typeof router.query.id !== 'string') return;
    const id = router.query.id;
    const access = typeof router.query.access === 'string' ? router.query.access : undefined;
    setOrderQuery(id);
    fetchOrder(id, access);
    // Remove the access credential from the address bar once it has been read.
    if (access) router.replace({ pathname: '/rastrear', query: { id } }, undefined, { shallow: true });
  }, [router.isReady, router.query.id]);

  return <>
    <Head><title>Acompanhar Pedido — Canal Marketplace</title><meta name="referrer" content="no-referrer" /><meta name="robots" content="noindex, nofollow" /></Head>
    <Header />
    <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <h1 style={{ color: '#0F253C' }}>Acompanhe seu pedido</h1>
        <p style={{ color: '#64748B' }}>Use o navegador da compra ou entre na sua conta para consultar o pedido. Se precisar de acesso em outro aparelho, fale com o atendimento.</p>
        <form onSubmit={event => { event.preventDefault(); fetchOrder(orderQuery.trim()); }} style={{ display: 'flex', gap: '12px', margin: '24px 0' }}>
          <input aria-label="Número do pedido" required placeholder="Número do pedido" value={orderQuery} onChange={event => setOrderQuery(event.target.value)} style={{ flex: 1, minWidth: 0, padding: '12px', border: '1px solid #CBD5E1', borderRadius: '8px' }} />
          <button type="submit" disabled={loading} className="hero-cta-btn">{loading ? 'Consultando...' : 'Consultar'}</button>
        </form>
        {error && <p role="alert" style={{ background: '#FEF2F2', color: '#991B1B', padding: '16px', borderRadius: '8px' }}>{error}</p>}
        {order && <section style={{ background: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '28px' }}>
          <h2 style={{ fontSize: '20px', color: '#0F253C', overflowWrap: 'anywhere' }}>Pedido {order.orderNumber}</h2>
          <p role="status" style={{ color: order.paymentStatus === 'PAID' ? '#166534' : '#92400E', fontWeight: 700 }}>{statuses[order.paymentStatus] || 'Acompanhamento em atualização'}</p>
          <p>Total: <strong>R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong></p>
          <p>Forma de pagamento: {order.paymentMethod === 'PIX' ? 'Pix' : 'Cartão de crédito'}</p>
          <p>Recebido em: {new Date(order.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
          {order.trackingCode ? <p>Código de rastreamento: <strong>{order.trackingCode}</strong></p> : <p>O código de rastreamento aparecerá após a preparação e postagem do pedido.</p>}
        </section>}
      </div>
    </main>
    <Footer />
  </>;
}
