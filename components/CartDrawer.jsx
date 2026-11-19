import React,{useState,useEffect,useRef} from 'react';
import Link from 'next/link';
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function CartDrawer({isOpen,onClose}){
 const [items,setItems]=useState([]);const closeButton=useRef(null);
 useEffect(()=>{if(!isOpen)return;try{setItems(JSON.parse(localStorage.getItem('cm.cart')||'[]'));}catch{setItems([]);}const previous=document.body.style.overflow;document.body.style.overflow='hidden';const key=e=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);closeButton.current?.focus();return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key);};},[isOpen]);
 const save=updated=>{setItems(updated);localStorage.setItem('cm.cart',JSON.stringify(updated));window.dispatchEvent(new Event('cart-updated'));};
 const quantity=(i,delta)=>{const updated=items.map(p=>({...p}));const qty=Number(updated[i].qty||updated[i].quantity||1)+delta;if(qty<=0)updated.splice(i,1);else{updated[i].qty=Math.min(qty,100);updated[i].quantity=updated[i].qty;}save(updated);};
 const total=items.reduce((n,p)=>n+Math.round(Number(p.price||0)*100)*Number(p.qty||p.quantity||1),0)/100;
 if(!isOpen)return null;
 return <><div className="cart-backdrop open" onClick={onClose}/><aside className="cart-drawer open" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
  <div className="drawer-header"><h2 id="drawer-title" className="drawer-title">Sua sacola ({items.reduce((n,p)=>n+Number(p.qty||p.quantity||1),0)})</h2><button type="button" ref={closeButton} className="drawer-close-btn" onClick={onClose} aria-label="Fechar sacola">✕</button></div>
  <div className="drawer-body">
   {!items.length?<div className="cart-empty"><img src="/imgs/cora/6.png" alt="Cora" style={{height:120,margin:'0 auto 18px'}}/><p>Sua sacola está vazia.</p><Link href="/loja" onClick={onClose} className="card-add-btn">Ver catálogo</Link></div>:items.map((p,i)=><div key={p.id||p.slug} className="cart-item">
    <img src={p.image||'/imgs/sem-imagem.svg'} alt={p.name} className="cart-item-thumb"/>
    <div className="cart-item-details"><Link href={'/produto/'+p.slug} className="cart-item-title" onClick={onClose}>{p.name}</Link><div className="cart-item-price">{money(p.price)}</div>
     <div className="qty-counter"><button type="button" className="qty-btn" onClick={()=>quantity(i,-1)} aria-label={'Diminuir quantidade de '+p.name}>−</button><span className="qty-num">{p.qty||p.quantity||1}</span><button type="button" className="qty-btn" onClick={()=>quantity(i,1)} aria-label={'Aumentar quantidade de '+p.name}>+</button></div>
     <button type="button" onClick={()=>save(items.filter((_,idx)=>idx!==i))} style={{fontSize:12,color:'#64748b',padding:8}}>Remover</button>
    </div></div>)}
  </div>
  {!!items.length&&<div className="drawer-footer"><div className="cart-summary-line"><span>Subtotal</span><strong>{money(total)}</strong></div><div className="cart-summary-line"><span>Frete</span><span>Calculado com seu CEP</span></div><p style={{color:'#059669',fontSize:13,margin:'10px 0 16px'}}>No Pix: {money(total*0.9)} + frete</p><Link href="/checkout" className="checkout-btn" onClick={onClose}>Finalizar pedido</Link><Link href="/carrinho" onClick={onClose} style={{display:'block',textAlign:'center',marginTop:12,fontSize:13}}>Ver carrinho completo</Link></div>}
 </aside></>;
}
