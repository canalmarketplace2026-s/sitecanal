import React, {useEffect,useState} from 'react';
import Link from 'next/link';
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function ProductCard({product:p,onAdd}){
 const [favorite,setFavorite]=useState(false);
 useEffect(()=>{try{setFavorite(JSON.parse(localStorage.getItem('cm.favorites')||'[]').some(f=>f.slug===p.slug));}catch{}},[p.slug]);
 const toggleFavorite=()=>{try{const list=JSON.parse(localStorage.getItem('cm.favorites')||'[]');const exists=list.some(f=>f.slug===p.slug);localStorage.setItem('cm.favorites',JSON.stringify(exists?list.filter(f=>f.slug!==p.slug):[...list,p]));setFavorite(!exists);window.dispatchEvent(new Event('favorites-updated'));}catch{}};
 const discount=Number(p.oldPrice)>Number(p.price)?Math.round((1-p.price/p.oldPrice)*100):0;
 return <article className="product-card"><div className="card-top">
  {discount>0&&<span className="card-badge-discount">-{discount}%</span>}
  <button type="button" className={'card-favorite-btn'+(favorite?' active':'')} onClick={toggleFavorite} aria-label={'Favoritar '+p.name} aria-pressed={favorite}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></button>
  <Link href={'/produto/'+p.slug}><img src={p.image||'/imgs/sem-imagem.svg'} alt={p.name} className="product-thumb" loading="lazy"/></Link>
 </div><div className="card-body"><div className="card-category">{p.category||p.brand||'Canal Marketplace'}</div><Link href={'/produto/'+p.slug}><h3 className="card-title" title={p.name}>{p.name}</h3></Link>
 <div className="card-price-row">{discount>0&&<span className="price-old">{money(p.oldPrice)}</span>}<div className="price-main">{money(p.price)}</div><div className="price-pix">no Pix: {money(p.price*0.9)} (10% OFF)</div></div>
 <button type="button" className="card-add-btn" disabled={!(Number(p.stock)>0)} onClick={()=>onAdd(p)}>{Number(p.stock)>0?'Adicionar à sacola':'Indisponível no momento'}</button></div></article>;
}
