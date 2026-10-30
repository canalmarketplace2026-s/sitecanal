import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Admin() {
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [shippingOrder, setShippingOrder] = useState('');
  const [invoiceKey, setInvoiceKey] = useState('');
  const [shipment, setShipment] = useState(null);
  const [shippingBusy, setShippingBusy] = useState(false);
  const [shippingMessage, setShippingMessage] = useState('');
  const [confirmPurchase, setConfirmPurchase] = useState(false);
  const statusNames = { NONE: 'Envio ainda não preparado', PREPARING: 'Preparação em andamento', CART_READY: 'No carrinho do Melhor Envio', PURCHASING: 'Compra em andamento', PURCHASED: 'Etiqueta comprada', GENERATING: 'Geração em andamento', GENERATED: 'Geração solicitada', PRINTED: 'Impressão disponível', REVIEW: 'Conferência necessária no Melhor Envio' };
  const shippingAction = async (action) => {
    setShippingBusy(true); setShippingMessage('');
    try {
      const token = localStorage.getItem('cm.auth_token');
      if (!token) throw new Error('Entre com uma conta administradora.');
      const id = shippingOrder.trim();
      if (!id) throw new Error('Informe o número do pedido.');
      const response = await fetch(`/api/shipping/orders/${encodeURIComponent(id)}`, {
        method: action === 'status' ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(action === 'status' ? {} : { body: JSON.stringify({ action, invoiceKey: invoiceKey.replace(/\D/g, ''), ...(action === 'purchase' && confirmPurchase && shipment ? { confirmation: `COMPRAR ${shipment.orderNumber}`, confirmedCost: shipment.shippingCartCost } : {}) }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Operação não concluída.');
      setShipment(result); setConfirmPurchase(false);
      setShippingMessage(action === 'status' ? 'Pedido consultado.' : 'Operação recebida. Confira o estado do envio abaixo.');
    } catch (error) { setShippingMessage(error.message || 'Não foi possível consultar o envio.'); }
    finally { setShippingBusy(false); }
  };
  const triggerTinySync = async () => {
    setSyncLoading(true); setSyncResult(null);
    try {
      const token = localStorage.getItem('cm.auth_token');
      if (!token) throw new Error('Entre com uma conta administradora para solicitar a sincronização.');
      const response = await fetch('/api/cron/sync-tiny', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível solicitar a sincronização.');
      setSyncResult(data);
    } catch (err) { setSyncResult({ error: err.message || 'Não foi possível solicitar a sincronização.' }); }
    finally { setSyncLoading(false); }
  };
  return <>
    <Head><title>Administração — Canal Marketplace</title><meta name="robots" content="noindex, nofollow" /></Head>
    <Header />
    <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <h1 style={{ color: '#0F253C' }}>Administração da Canal</h1>
        <p style={{ color: '#64748B' }}>A sincronização requer uma conta com permissão de administração. <Link href="/conta">Entrar na conta</Link></p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', margin: '28px 0' }}>
          <section style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '19px', color: '#0F253C' }}>Estoque e catálogo</h2>
            <p style={{ fontSize: '14px', color: '#64748B' }}>Produtos e disponibilidade são consultados no Tiny/Olist. O resultado da sincronização será mostrado abaixo.</p>
            <button type="button" onClick={triggerTinySync} disabled={syncLoading} className="hero-cta-btn">{syncLoading ? 'Solicitando...' : 'Solicitar sincronização'}</button>
          </section>
          <section style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '19px', color: '#0F253C' }}>Entrega</h2>
            <p style={{ fontSize: '14px', color: '#64748B' }}>As opções de entrega são consultadas no Melhor Envio durante a compra. As etiquetas de pedidos pagos podem ser preparadas, compradas e impressas abaixo pela administração.</p>
          </section>
          <section style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h2 style={{ fontSize: '19px', color: '#0F253C' }}>Pagamentos</h2>
            <p style={{ fontSize: '14px', color: '#64748B' }}>O Asaas informa a confirmação dos pagamentos. A disponibilidade do checkout depende da configuração e da validação no servidor.</p>
          </section>
        </div>
        <section style={{ background: '#FFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '21px', color: '#0F253C' }}>Etiquetas e rastreio</h2>
          <p>Consulte um pedido pago. A compra de etiquetas utiliza o saldo da carteira do Melhor Envio e requer confirmação do custo.</p>
          <label style={{ display: 'block', marginBottom: '8px' }}>Número do pedido
            <input value={shippingOrder} onChange={event => { setShippingOrder(event.target.value); setShipment(null); setConfirmPurchase(false); }} style={{ display: 'block', width: '100%', padding: '10px', marginTop: '6px' }} />
          </label>
          <button type="button" className="hero-cta-btn" disabled={shippingBusy} onClick={() => shippingAction('status')}>Consultar envio</button>
          {shippingMessage && <p role="status">{shippingMessage}</p>}
          {shipment && <div style={{ marginTop: '20px' }}>
            <p><strong>{shipment.orderNumber}</strong>: {statusNames[shipment.shippingIntegrationStatus] || 'Aguardando conferência'}</p>
            {shipment.shippingLastError && <p style={{ color: '#991B1B' }}>{shipment.shippingLastError}</p>}
            {shipment.shippingIntegrationStatus === 'NONE' && <>
              <label>Chave da nota fiscal deste pedido (44 dígitos)
                <input value={invoiceKey} onChange={event => setInvoiceKey(event.target.value)} maxLength={44} style={{ display: 'block', width: '100%', padding: '10px', margin: '8px 0' }} />
              </label>
              <button type="button" className="hero-cta-btn" disabled={shippingBusy || invoiceKey.replace(/\D/g, '').length !== 44} onClick={() => shippingAction('prepare')}>Preparar etiqueta no carrinho</button>
            </>}
            {Number.isFinite(shipment.shippingCartCost) && <p>Custo das etiquetas: <strong>{shipment.shippingCartCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>}
            {shipment.shippingIntegrationStatus === 'CART_READY' && <>
              <label style={{ display: 'block', marginBottom: '12px' }}><input type="checkbox" checked={confirmPurchase} onChange={event => setConfirmPurchase(event.target.checked)} /> Confirmo o débito do custo acima na carteira do Melhor Envio para este pedido.</label>
              <button type="button" className="hero-cta-btn" disabled={shippingBusy || !confirmPurchase} onClick={() => shippingAction('purchase')}>Comprar etiquetas</button>
            </>}
            {shipment.shippingIntegrationStatus === 'PURCHASED' && <button type="button" className="hero-cta-btn" disabled={shippingBusy} onClick={() => shippingAction('generate')}>Solicitar geração das etiquetas</button>}
            {['GENERATED', 'PRINTED'].includes(shipment.shippingIntegrationStatus) && <button type="button" className="hero-cta-btn" disabled={shippingBusy} onClick={() => shippingAction('print')}>Obter impressão</button>}
            {shipment.shippingPrintUrl && <p><a href={shipment.shippingPrintUrl} target="_blank" rel="noopener noreferrer">Abrir etiquetas no Melhor Envio</a> (requer acesso à conta)</p>}
            {shipment.melhorEnvioIds?.length > 0 && <p><button type="button" disabled={shippingBusy} onClick={() => shippingAction('track')}>Atualizar rastreio</button></p>}
            {shipment.trackingCode && <p>Código de rastreio: {shipment.trackingCode}</p>}
          </div>}
        </section>
        {syncResult && <section role="status" style={{ padding: '20px', background: syncResult.error ? '#FEF2F2' : '#F0FDF4', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '18px', color: syncResult.error ? '#991B1B' : '#166534' }}>{syncResult.error ? 'Solicitação não concluída' : 'Resposta da sincronização'}</h2>
          <p>{syncResult.error || syncResult.message || 'Solicitação recebida.'}</p>
          {Number.isFinite(syncResult.syncedCount) && <p>Produtos sincronizados: {syncResult.syncedCount}</p>}
          {Number.isFinite(syncResult.failedCount) && <p>Produtos com falha: {syncResult.failedCount}</p>}
        </section>}
      </div>
    </main>
    <Footer />
  </>;
}
