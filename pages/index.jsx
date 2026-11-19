import React,{useState,useEffect} from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import CoraBot from '../components/CoraBot';
import ProductCard from '../components/ProductCard';
const banners=[
 {desktop:'canal-catalogo-desktop.png',mobile:'canal-catalogo-mobile.png',alt:'Tudo o que você precisa, em um só canal'},
 {desktop:'canal-ofertas-desktop.png',mobile:'canal-ofertas-mobile.png',alt:'Ofertas que combinam com sua rotina'},
 {desktop:'canal-bem-estar-desktop.png',mobile:'canal-bem-estar-mobile.png',alt:'Tudo para cuidar de você'}
];
export default function Home(){
 const [products,setProducts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const [isCartOpen,setIsCartOpen]=useState(false),[campaignSlide,setCampaignSlide]=useState(0),[category,setCategory]=useState('Todos');
 useEffect(()=>{let active=true;fetch('/api/products?limit=32').then(r=>{if(!r.ok)throw Error();return r.json();}).then(j=>{if(active)setProducts(j.products||[]);}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});const timer=setInterval(()=>setCampaignSlide(i=>(i+1)%3),6500);return()=>{active=false;clearInterval(timer);};},[]);
 const addToCart=p=>{try{const cart=JSON.parse(localStorage.getItem('cm.cart')||'[]');const item=cart.find(i=>i.id===p.id||i.slug===p.slug);if(item)item.qty=Math.min((item.qty||item.quantity||1)+1,100);else cart.push({id:p.id,slug:p.slug,name:p.name,price:p.price,image:p.image,qty:1});localStorage.setItem('cm.cart',JSON.stringify(cart));window.dispatchEvent(new Event('cart-updated'));setIsCartOpen(true);}catch{}}
 const categories=['Todos',...new Set(products.map(p=>p.category).filter(Boolean))];
 const shown=category==='Todos'?products.slice(4,12):products.filter(p=>p.category===category).slice(0,8);
 const grid=items=>loading?<p role="status" style={{padding:32}}>Carregando produtos oficiais...</p>:error?<p role="status">Catálogo temporariamente indisponível. Tente novamente.</p>:<div className="product-grid">{items.map(p=><ProductCard key={p.id} product={p} onAdd={addToCart}/>)}</div>;
 return <><Head><title>Canal Marketplace — Ofertas que valem a pena</title><meta name="description" content="Produtos do estoque oficial da Canal. Pix com 10% de desconto e entrega para todo o Brasil."/></Head><Header onOpenCart={()=>setIsCartOpen(true)}/><main><section className="home-banner" aria-label="Destaques da Canal">
<h1 className="home-banner-title">Canal Marketplace — tudo o que você precisa, em um só canal</h1>
{banners.map((banner,i)=><a href="/loja" key={banner.desktop} className={'home-banner-slide'+(campaignSlide===i?' active':'')}>
 <picture><source media="(max-width:767px)" srcSet={'/imgs/banners/'+banner.mobile}/><img src={'/imgs/banners/'+banner.desktop} alt={banner.alt} width="1920" height="268" fetchPriority={i===0?'high':'auto'}/></picture>
</a>)}
<div className="home-banner-controls" role="group" aria-label="Escolher banner principal">
 <button type="button" className="home-banner-arrow" onClick={()=>setCampaignSlide(i=>(i+2)%3)} aria-label="Banner anterior">‹</button>
 {banners.map((banner,i)=><button type="button" key={banner.desktop} className={'home-banner-dot'+(campaignSlide===i?' active':'')} onClick={()=>setCampaignSlide(i)} aria-label={'Banner '+(i+1)} aria-pressed={campaignSlide===i}/>)}
 <button type="button" className="home-banner-arrow" onClick={()=>setCampaignSlide(i=>(i+1)%3)} aria-label="Próximo banner">›</button>
</div></section><section className="trust-bar">
<div className="container">
<div className="trust-grid">

<a href="/loja" className="trust-card">
<div className="trust-icon-wrap">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<rect x="1" y="3" width="15" height="13"></rect>
<polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
<circle cx="5.5" cy="18.5" r="2.5"></circle>
<circle cx="18.5" cy="18.5" r="2.5"></circle>
</svg>
</div>
<div className="trust-info">
<div className="trust-title">{"Entrega rápida"}</div>
<div className="trust-desc">{"Para todo o Brasil"}</div>
</div>
<div className="trust-chevron">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</div>
</a>

<a href="/loja" className="trust-card">
<div className="trust-icon-wrap">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<rect x="2" y="5" width="20" height="14" rx="2"></rect>
<line x1="2" y1="10" x2="22" y2="10"></line>
</svg>
</div>
<div className="trust-info">
<div className="trust-title">{"Até 12x sem juros"}</div>
<div className="trust-desc">{"Nos principais cartões"}</div>
</div>
<div className="trust-chevron">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</div>
</a>

<a href="/suporte" className="trust-card">
<div className="trust-icon-wrap">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
<path d="m9 12 2 2 4-4"></path>
</svg>
</div>
<div className="trust-info">
<div className="trust-title">{"Compra segura"}</div>
<div className="trust-desc">{"Seus dados protegidos"}</div>
</div>
<div className="trust-chevron">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</div>
</a>
</div>
</div>
</section><section className="container" style={{marginBottom:56}}><div className="section-header"><div className="section-title-wrap"><div className="section-accent-bar"/><h2 className="section-title">Destaques da Canal</h2></div><a href="/loja" className="section-link">Ver todos →</a></div>{grid(products.slice(0,4))}</section>

<section className="container" style={{marginBottom:64}}><div className="section-header"><div className="section-title-wrap"><div className="section-accent-bar"/><h2 className="section-title">Catálogo por categoria</h2></div></div><div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:18}}>{categories.map(c=><button key={c} className="chat-chip" style={category===c?{background:'var(--color-navy)',color:'white'}:{}} onClick={()=>setCategory(c)}>{c}</button>)}</div>{grid(shown)}</section><section className="why-cora-section">
<div className="container">
<div style={{"textAlign": "center", "maxWidth": "600px", "margin": "0 auto"}}>
<span style={{"fontSize": "11px", "fontWeight": "800", "textTransform": "uppercase", "letterSpacing": "0.18em", "color": "#D97706"}}>{"Jeito Canal"}</span>
<h2 style={{"fontFamily": "var(--font-display)", "fontSize": "32px", "fontWeight": "800", "color": "var(--color-navy)", "margin": "6px 0 12px"}}>{"\n          Por que a Cora escolhe a Canal?\n        "}</h2>
<p style={{"fontSize": "14.5px", "color": "var(--color-text-muted)"}}>{"\n          Curadoria honesta, produtos com nota fiscal e suporte humano que resolve sem enrolação.\n        "}</p>
</div>
<div className="bento-grid">

<div className="bento-card">
<div className="bento-mascot-frame">
<img src="/imgs/cora/10.png" alt="Curadoria Canal" />
</div>
<div className="bento-tag">{"Curadoria Oficial"}</div>
<h3 className="bento-title">{"Produtos 100% Originais"}</h3>
<p className="bento-desc">{"\n            Trabalhamos direto com marcas líderes como Hidrolight, Esbelt, Motorola, Topper e Furukawa. Garantia de fábrica e procedência total.\n          "}</p>
</div>

<div className="bento-card">
<div className="bento-mascot-frame">
<img src="/imgs/cora/12.png" alt="Logística Rápida" />
</div>
<div className="bento-tag">{"Logística com Carinho"}</div>
<h3 className="bento-title">{"Entrega para todo o Brasil"}</h3>
<p className="bento-desc">{"\n            Cada embalagem é revisada e embalada com máximo cuidado. Rastreamento inteligente em tempo real e frete calculado para o seu endereço.\n          "}</p>
</div>

<div className="bento-card">
<div className="bento-mascot-frame">
<img src="/imgs/cora/14.png" alt="Atendimento no WhatsApp" />
</div>
<div className="bento-tag">{"Atendimento Humanizado"}</div>
<h3 className="bento-title">{"Fale Direto com a Gente"}</h3>
<p className="bento-desc">{"\n            Sem robôs infinitos ou respostas automáticas inúteis. Se precisar de ajuda, troca ou dúvida, nossa equipe no WhatsApp responde rapidinho!\n          "}</p>
</div>
</div>
</div>
</section></main><Footer/><CartDrawer isOpen={isCartOpen} onClose={()=>setIsCartOpen(false)}/><CoraBot/></>;}
