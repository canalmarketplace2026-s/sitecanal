import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

const panel = { background: '#FFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px' };
const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: '6px' };
const money = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
function Field({ label, ...props }) {
  return <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F253C' }}>{label}<input {...props} style={{ ...inputStyle, marginTop: '5px' }} /></label>;
}
function paymentLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'asaas.com' || url.hostname.endsWith('.asaas.com')) ? url.href : null;
  } catch { return null; }
}

export default function Checkout() {
  const [cartItems, setCartItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', cpf: '' });
  const [address, setAddress] = useState({ cep: '', street: '', number: '', complement: '', district: '', city: '', state: '' });
  const [shippingQuotes, setShippingQuotes] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [quotedCep, setQuotedCep] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [installments, setInstallments] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const checkoutKey = useRef('');
  const submitting = useRef(false);
  const quoteRequest = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cm.cart') || '[]');
      if (!Array.isArray(saved) || !saved.length) { window.location.href = '/carrinho'; return; }
      setCartItems(saved);
      setSubtotal(saved.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity ?? item.qty ?? 1), 0));
      const fingerprint = JSON.stringify(saved.map(item => [item.slug || item.id, Number(item.quantity ?? item.qty ?? 1)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
      let attempt = null;
      try { attempt = JSON.parse(sessionStorage.getItem('cm.checkout_attempt') || 'null'); } catch { /* Start a new attempt if storage is malformed. */ }
      if (!attempt || attempt.fingerprint !== fingerprint || typeof attempt.key !== 'string') {
        attempt = { fingerprint, key: crypto.randomUUID() };
        sessionStorage.setItem('cm.checkout_attempt', JSON.stringify(attempt));
      }
      checkoutKey.current = attempt.key;
    } catch {
      setError('Não foi possível preparar sua compra neste navegador. Ative o armazenamento do site e recarregue a página.');
    }
  }, []);

  const updateCustomer = (key, value) => setCustomer(current => ({ ...current, [key]: value }));
  const updateAddress = (key, value) => {
    setAddress(current => ({ ...current, [key]: value }));
    if (key === 'cep') {
      quoteRequest.current += 1;
      setShippingQuotes([]);
      setSelectedShipping(null);
      setQuotedCep('');
      setShippingLoading(false);
    }
  };

  const calculateShipping = async () => {
    const cep = address.cep.replace(/\D/g, '');
    if (cep.length !== 8) { setError('Digite um CEP válido com oito dígitos.'); return; }
    const request = ++quoteRequest.current;
    setError('');
    setShippingQuotes([]);
    setSelectedShipping(null);
    setQuotedCep('');
    setShippingLoading(true);
    try {
      const response = await fetch('/api/shipping/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cep, items: cartItems }),
      });
      const data = await response.json();
      if (request !== quoteRequest.current) return;
      if (!response.ok || !data.quotes?.length || !Number.isFinite(data.subtotal) || data.subtotal <= 0) throw new Error(data.error || 'Não foi possível calcular a entrega.');
      setSubtotal(data.subtotal);
      setShippingQuotes(data.quotes);
      setSelectedShipping(data.quotes[0]);
      setQuotedCep(cep);
    } catch (err) {
      if (request === quoteRequest.current) setError(err.message || 'Não foi possível calcular a entrega. Tente novamente.');
    } finally {
      if (request === quoteRequest.current) setShippingLoading(false);
    }
    // Address lookup is optional; the customer can fill every field manually.
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (request === quoteRequest.current && !data.erro) setAddress(current => ({ ...current, street: current.street || data.logradouro || '', district: current.district || data.bairro || '', city: data.localidade || current.city, state: data.uf || current.state }));
    } catch { /* Manual address entry remains available. */ }
  };

  const shippingCost = Number(selectedShipping?.price || 0);
  const pixDiscount = paymentMethod === 'PIX' ? Math.round(subtotal * 10) / 100 : 0;
  const total = Math.round((subtotal - pixDiscount + shippingCost) * 100) / 100;
  const shippingReady = !!selectedShipping && quotedCep === address.cep.replace(/\D/g, '') && !shippingLoading;

  const submitOrder = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    if (!shippingReady) { setError('Calcule e selecione a entrega antes de confirmar o pedido.'); return; }
    if (!checkoutKey.current) { setError('Recarregue a página para preparar sua compra.'); return; }
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      const auth = localStorage.getItem('cm.auth_token');
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
        body: JSON.stringify({ customer, shippingAddress: address, shippingMethod: selectedShipping, items: cartItems, paymentMethod, installments: paymentMethod === 'CREDIT_CARD' ? installments : 1, checkoutKey: checkoutKey.current, expectedTotal: total }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Consulte o atendimento antes de repetir o pagamento.');
      setOrderSuccess(data);
      // Failure to persist a receipt must never turn an accepted order into another payment attempt.
      try {
        if (data.orderAccessToken) {
          localStorage.setItem(`cm.order_access:${data.orderNumber}`, data.orderAccessToken);
          localStorage.setItem(`cm.order_access:${data.orderId}`, data.orderAccessToken);
        }
        if (!data.pendingRecovery) localStorage.removeItem('cm.cart');
        if (!data.pendingRecovery) sessionStorage.removeItem('cm.checkout_attempt');
        window.dispatchEvent(new Event('cart-updated'));
      } catch { /* The current confirmation still provides access to the order. */ }
    } catch (err) {
      setError(err.message || 'Não foi possível concluir. Consulte o atendimento antes de repetir o pagamento.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const invoiceUrl = paymentLink(orderSuccess?.invoiceUrl);
  return <>
    <Head><title>Finalizar Compra — Canal Marketplace</title></Head>
    <Header />
    <main style={{ padding: '40px 0 80px', background: '#FAFAFA' }}>
      <div className="container">
        {orderSuccess ? <section style={{ ...panel, maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ color: '#0F253C' }}>Pedido recebido</h1>
          <p>Pedido <strong>{orderSuccess.orderNumber}</strong></p>
          <p>Valor do pedido: <strong>{money(orderSuccess.total)}</strong>{orderSuccess.installments > 1 ? ` em ${orderSuccess.installments} parcelas` : ''}. {orderSuccess.paymentStatus === 'PAID' ? 'Pagamento confirmado. Seu pedido seguirá para atendimento.' : ['REFUNDED', 'CANCELLED'].includes(orderSuccess.paymentStatus) ? 'Este pagamento está encerrado. Consulte o acompanhamento do pedido.' : orderSuccess.requiresReview ? 'Este pedido precisa de conferência do atendimento antes de continuar.' : 'Aguardamos a confirmação do pagamento para iniciar o atendimento.'}</p>
          {orderSuccess.pendingRecovery && <div role="status" style={{ background: '#FEF3C7', padding: '16px', borderRadius: '12px' }}>Seu pedido foi salvo e estamos confirmando a cobrança. Não faça outro pagamento. <button type="button" onClick={() => { setOrderSuccess(null); setError('Toque em continuar para recuperar o mesmo pedido, sem criar outra cobrança.'); }}>Verificar pagamento novamente</button></div>}
          {orderSuccess.paymentMethod === 'PIX' && orderSuccess.pixCopiaECola && <div style={{ background: '#F0FDF4', padding: '20px', borderRadius: '12px', margin: '24px 0' }}>
            <h2 style={{ fontSize: '18px' }}>Pague com Pix</h2>
            {orderSuccess.pixQrCode && <img src={orderSuccess.pixQrCode} alt="QR Code para pagar este pedido" style={{ width: '200px', height: '200px' }} />}
            <label style={{ display: 'block', fontSize: '13px' }}>Pix Copia e Cola<input readOnly value={orderSuccess.pixCopiaECola} style={{ ...inputStyle, marginTop: '8px' }} /></label>
            <button type="button" className="hero-cta-btn" style={{ marginTop: '12px' }} onClick={async () => {
              try { await navigator.clipboard.writeText(orderSuccess.pixCopiaECola); setError('Código Pix copiado.'); } catch { setError('Selecione e copie o código Pix no campo acima.'); }
            }}>Copiar código Pix</button>
          </div>}
          {invoiceUrl && !orderSuccess.requiresReview && ['PENDING', 'PROCESSING'].includes(orderSuccess.paymentStatus) && <p><a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="hero-cta-btn">{orderSuccess.paymentMethod === 'CREDIT_CARD' ? 'Pagar com cartão no Asaas' : 'Abrir pagamento no Asaas'}</a></p>}
          {error && <p role="status">{error}</p>}
          <p><Link href={`/rastrear?id=${encodeURIComponent(orderSuccess.orderNumber)}${orderSuccess.orderAccessToken ? `&access=${encodeURIComponent(orderSuccess.orderAccessToken)}` : ''}`}>Acompanhar pedido</Link></p>
          <Link href="/loja">Voltar à loja</Link>
        </section> : <form onSubmit={submitOrder} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px' }}>
          <div>
            <section style={panel}>
              <h2 style={{ fontSize: '19px', color: '#0F253C' }}>1. Seus dados</h2>
              <div style={{ display: 'grid', gap: '14px' }}>
                <Field label="Nome completo" required autoComplete="name" value={customer.name} onChange={e => updateCustomer('name', e.target.value)} />
                <Field label="E-mail" type="email" required autoComplete="email" value={customer.email} onChange={e => updateCustomer('email', e.target.value)} />
                <Field label="Telefone com DDD" type="tel" required autoComplete="tel" value={customer.phone} onChange={e => updateCustomer('phone', e.target.value)} />
                <Field label="CPF" required inputMode="numeric" value={customer.cpf} onChange={e => updateCustomer('cpf', e.target.value)} />
              </div>
            </section>
            <section style={panel}>
              <h2 style={{ fontSize: '19px', color: '#0F253C' }}>2. Entrega</h2>
              <div style={{ display: 'grid', gap: '14px' }}>
                <Field label="CEP" required autoComplete="postal-code" inputMode="numeric" maxLength={9} value={address.cep} onChange={e => updateAddress('cep', e.target.value)} />
                <button type="button" className="hero-cta-btn" disabled={shippingLoading || !cartItems.length} onClick={calculateShipping}>{shippingLoading ? 'Calculando entrega...' : 'Calcular entrega'}</button>
                <Field label="Rua / Avenida" required autoComplete="address-line1" value={address.street} onChange={e => updateAddress('street', e.target.value)} />
                <Field label="Número" required value={address.number} onChange={e => updateAddress('number', e.target.value)} />
                <Field label="Complemento (opcional)" value={address.complement} onChange={e => updateAddress('complement', e.target.value)} />
                <Field label="Bairro" required value={address.district} onChange={e => updateAddress('district', e.target.value)} />
                <Field label="Cidade" required autoComplete="address-level2" value={address.city} onChange={e => updateAddress('city', e.target.value)} />
                <Field label="Estado (UF)" required autoComplete="address-level1" maxLength={2} pattern="[A-Z]{2}" value={address.state} onChange={e => updateAddress('state', e.target.value.toUpperCase())} />
              </div>
              {shippingQuotes.length > 0 && <fieldset style={{ border: 0, padding: 0, marginTop: '20px' }}><legend>Escolha a entrega</legend>{shippingQuotes.map(quote => <label key={quote.id} style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: '1px solid #E2E8F0' }}>
                <input type="radio" name="shipping" checked={selectedShipping?.id === quote.id} onChange={() => setSelectedShipping(quote)} />
                <span>{quote.company} · {quote.name}<br /><small>{quote.deliveryTime} · {quote.price === 0 ? 'Grátis' : money(quote.price)}</small></span>
              </label>)}</fieldset>}
            </section>
            <section style={panel}>
              <h2 style={{ fontSize: '19px', color: '#0F253C' }}>3. Pagamento</h2>
              <label style={{ display: 'block', marginBottom: '12px' }}><input type="radio" name="payment" checked={paymentMethod === 'PIX'} onChange={() => setPaymentMethod('PIX')} /> Pix com 10% de desconto</label>
              <label style={{ display: 'block' }}><input type="radio" name="payment" checked={paymentMethod === 'CREDIT_CARD'} onChange={() => setPaymentMethod('CREDIT_CARD')} /> Cartão de crédito em até 12 parcelas</label>
              {paymentMethod === 'CREDIT_CARD' && <label style={{ display: 'block', marginTop: '12px' }}>Parcelas <select value={installments} onChange={event => setInstallments(Number(event.target.value))} style={{ ...inputStyle, marginTop: '6px' }}>{Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count}x — total {money(total)}</option>)}</select></label>}
              <p style={{ fontSize: '13px', color: '#64748B' }}>{paymentMethod === 'PIX' ? 'O QR Code e o código Pix serão exibidos após recebermos o pedido.' : 'Você preencherá os dados do cartão na página de pagamento do Asaas após recebermos o pedido.'}</p>
            </section>
          </div>
          <aside style={{ ...panel, height: 'fit-content' }}>
            <h2 style={{ fontSize: '19px', color: '#0F253C' }}>Resumo do pedido</h2>
            {cartItems.map((item, index) => <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <img src={item.image || '/imgs/canaltop.png'} alt="" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
              <div style={{ fontSize: '13px' }}>{item.name}<br /><small>Quantidade: {item.quantity ?? item.qty ?? 1}</small></div>
            </div>)}
            <p>{quotedCep ? 'Subtotal atualizado' : 'Subtotal estimado'}: <strong>{money(subtotal)}</strong></p>
            <p>Entrega: <strong>{selectedShipping ? (shippingCost === 0 ? 'Grátis' : money(shippingCost)) : 'Calcule pelo CEP'}</strong></p>
            {paymentMethod === 'PIX' && <p>Desconto Pix: <strong>− {money(pixDiscount)}</strong></p>}
            <p style={{ fontSize: '21px', color: '#0F253C' }}>Total {shippingReady ? '' : 'estimado'}: <strong>{money(total)}</strong></p>
            {error && <p role="alert" style={{ color: '#991B1B', background: '#FEF2F2', padding: '12px', borderRadius: '8px' }}>{error}</p>}
            <button type="submit" className="hero-cta-btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading || !shippingReady || !checkoutKey.current}>{loading ? 'Enviando pedido...' : 'Confirmar pedido e continuar'}</button>
            <p style={{ fontSize: '12px', color: '#64748B' }}>Confira o valor e a entrega antes de confirmar. O pagamento será confirmado pelo Asaas.</p>
          </aside>
        </form>}
      </div>
    </main>
    <Footer />
  </>;
}
