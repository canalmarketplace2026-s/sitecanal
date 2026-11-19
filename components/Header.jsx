import React, {useEffect,useState} from 'react';
export default function Header({onOpenCart}) {
 const [cartCount,setCartCount]=useState(0),[searchQuery,setSearchQuery]=useState('');
 useEffect(()=>{const update=()=>{try{setCartCount(JSON.parse(localStorage.getItem('cm.cart')||'[]').reduce((n,p)=>n+Number(p.qty||p.quantity||1),0));}catch{setCartCount(0);}};update();window.addEventListener('cart-updated',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('cart-updated',update);window.removeEventListener('storage',update);};},[]);
 const openCart=onOpenCart||(()=>{window.location.href='/carrinho';});
 const handleSearch=event=>{event.preventDefault();if(searchQuery.trim())window.location.href='/loja?q='+encodeURIComponent(searchQuery.trim());};
 return <><div className="top-bar">
<div className="container top-bar-inner">
<div className="top-bar-left">
<span className="top-bar-badge">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<rect x="1" y="3" width="15" height="13"></rect>
<polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
<circle cx="5.5" cy="18.5" r="2.5"></circle>
<circle cx="18.5" cy="18.5" r="2.5"></circle>
</svg>{"Entrega"}</span>
<span>{"para todo o Brasil • 10% OFF no Pix"}</span>
</div>
<div className="top-bar-right">
<a href="https://wa.me/5519992893859?text=Ol%C3%A1%2C%20Canal!%20Preciso%20de%20atendimento." target="_blank" className="top-bar-link">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
</svg>{"\n          Atendimento\n        "}</a>
<a href="/rastrear" className="top-bar-link">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
<circle cx="12" cy="10" r="3"></circle>
</svg>{"\n          Rastrear pedido\n        "}</a>
<a href="/conta" className="top-bar-link">{"Minha conta"}</a>
</div>
</div>
</div><header className="main-header" id="mainHeader">
<div className="container header-inner">

<a href="/" className="header-brand" aria-label="Canal Marketplace Home">
<img src="/imgs/canal logo.png" alt="Canal Marketplace" className="brand-logo-img" />
<div className="brand-mascot-avatar" title="Cora, Mascote Oficial">
<img src="/imgs/canaltop.png" alt="Cora" />
</div>
</a>

<div className="header-search">
<form className="search-form" id="globalSearchForm" onSubmit={handleSearch}>
<span className="search-icon-left">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
<circle cx="11" cy="11" r="8"></circle>
<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>
</span>
<input type="text" className="search-input" id="globalSearchInput" placeholder="Buscar produtos, marcas, categorias..." autoComplete="off" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
<button type="submit" className="search-btn" aria-label="Buscar">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<circle cx="11" cy="11" r="8"></circle>
<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>
</button>
</form>

<div className="search-results-dropdown" id="searchResultsDropdown"></div>
</div>

<div className="header-actions">
<a href="/conta" className="header-action-btn" title="Minha Conta">
<div className="action-icon-wrap">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
<circle cx="12" cy="7" r="4"></circle>
</svg>
</div>
<div className="action-text-col">
<span className="action-text-label">{"Minha conta"}</span>
<span className="action-text-val">{"Entrar ou criar"}</span>
</div>
</a>
<a href="/favoritos" className="header-action-btn" title="Favoritos">
<div className="action-icon-wrap">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
</svg>
<span className="badge-count js-fav-count" style={{"display": "none"}}>{"0"}</span>
</div>
<div className="action-text-col">
<span className="action-text-val">{"Favoritos"}</span>
</div>
</a>
<button className="header-action-btn js-open-cart" title="Ver Sacola" type="button" onClick={openCart}>
<div className="action-icon-wrap">
<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="8" cy="21" r="1"></circle>
<circle cx="19" cy="21" r="1"></circle>
<path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
</svg>
<span className="badge-count js-cart-count" style={{display: cartCount ? 'flex' : 'none'}}>{cartCount}</span>
</div>
<div className="action-text-col">
<span className="action-text-val">{"Carrinho"}</span>
</div>
</button>
</div>
</div>
</header><nav className="category-nav">
<div className="container category-nav-inner">
<a href="/loja" className="cat-nav-link" style={{"fontWeight": "700"}}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
<line x1="4" y1="12" x2="20" y2="12"></line>
<line x1="4" y1="6" x2="20" y2="6"></line>
<line x1="4" y1="18" x2="20" y2="18"></line>
</svg>{"\n        Todas as categorias\n      "}</a>
<a href="/loja?ofertas=true" className="cat-nav-link highlight">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
</svg>{"\n        Ofertas do Dia\n      "}</a>
<a href="/loja?category=Fitness+%26+Pilates" className="cat-nav-link">{"\n        🧘 Fitness & Pilates\n      "}</a>
<a href="/loja?category=Saúde+%26+Ortopedia" className="cat-nav-link">{"\n        🩺 Saúde & Ortopedia\n      "}</a>
<a href="/loja?category=Esportes" className="cat-nav-link">{"\n        ⚽ Esportes\n      "}</a>
<a href="/loja?category=Tecnologia+%26+Segurança" className="cat-nav-link">{"\n        🛡️ Tecnologia & Segurança\n      "}</a>
<a href="/loja?category=Casa+%26+Churrasco" className="cat-nav-link">{"\n        🍖 Casa & Churrasco\n      "}</a>
<a href="/loja?category=Utilidades+%26+Infantil" className="cat-nav-link">{"\n        🧸 Infantil & Utilidades\n      "}</a>
</div>
</nav></>;
}
