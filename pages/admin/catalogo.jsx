import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';

const input = { padding: 8, border: '1px solid #ccd5df', borderRadius: 6, width: '100%' };
export default function CatalogoAdmin() {
  const [products, setProducts] = useState([]), [query, setQuery] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('cm.auth_token') || ''}` });
  async function load() {
    const r = await fetch('/api/admin/products', { headers: headers() });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setProducts(data.products);
  }
  useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
  async function save(event, product) {
    event.preventDefault(); setBusy(true); setMessage('');
    const fields = new FormData(event.currentTarget);
    const body = { id: product.id, tinyId: fields.get('tinyId'), sku: fields.get('sku') };
    for (const key of ['weight', 'width', 'height', 'length']) body[key] = Number(fields.get(key));
    try {
      const r = await fetch('/api/admin/products', { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setMessage(data.message); await load();
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 1100, margin: '32px auto', padding: 20, fontFamily: 'system-ui', color: '#152b40' }}>
    <Head><title>Produtos e estoque — Canal</title><meta name="robots" content="noindex,nofollow" /></Head>
    <Link href="/admin">← Painel</Link><h1>Produtos e estoque</h1>
    <p>O Tiny é o cadastro oficial. Altere nomes, preços, imagens, variações, peso e medidas diretamente no Tiny; a sincronização traz as alterações para o site.</p>
    <p role="status">{message}</p><input style={input} placeholder="Buscar produto" value={query} onChange={e => setQuery(e.target.value)} />
    {products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => <form key={p.id} onSubmit={e => save(e, p)} style={{ margin: '18px 0', padding: 18, border: '1px solid #dce4eb', borderRadius: 10 }}>
      <strong>{p.name}</strong><p>Saldo Tiny: {p.stock} · Reservas locais: {p.reservedStock} · Disponível: {Math.max(0, p.stock - p.reservedStock)}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
        <label>Código Tiny<input required style={input} name="tinyId" defaultValue={p.tinyId || ''} /></label>
        <label>SKU<input required style={input} name="sku" defaultValue={p.sku || ''} /></label>
        {[['weight', 'Peso (kg)'], ['width', 'Largura (cm)'], ['height', 'Altura (cm)'], ['length', 'Comprimento (cm)']].map(([key, label]) => <label key={key}>{label}<input required min="0.001" step="0.001" type="number" style={input} name={key} defaultValue={p[key] || ''} /></label>)}
      </div><button disabled={true} style={{ marginTop: 14, padding: '10px 20px' }}>Gerenciado no Tiny</button>
    </form>)}
  </main>;
}
