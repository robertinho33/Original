import {loadProducts} from './catalog-service.js';
import {productReactionMarkup,hydrateProductReactions} from './product-reactions.js';
import {routinePairings} from './routine-pairings.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function storeProductPair(base,other,storage=localStorage){
 const raw=JSON.parse(storage.getItem('aurea-cart')||'[]'),cart=(Array.isArray(raw)?raw:[]).filter(row=>typeof row?.sku==='string'&&Number.isSafeInteger(row.quantity)&&row.quantity>0).map(row=>({sku:row.sku,quantity:row.quantity}));
 if(!base||!other||base.sku===other.sku)throw Error('Escolha dois cuidados diferentes.');
 for(const product of [base,other]){const row=cart.find(item=>item.sku===product.sku),quantity=(row?.quantity||0)+1;if(product.active===false||!Number.isFinite(Number(product.price))||Number(product.price)<=0||quantity>Number(product.stock)||!Number.isFinite(Number(product.stock)))throw Error('A quantidade disponível mudou. Confira sua sacola.');if(row)row.quantity=quantity;else cart.push({sku:product.sku,quantity});}
 storage.setItem('aurea-cart',JSON.stringify(cart));return cart;
}
export async function mountProductPageAffection(){
 const form=document.getElementById('productBuyForm'),target=document.getElementById('productPageShopping');if(!form||!target)return;
 const coupon=new URLSearchParams(location.search).get('cupom')||'',query=coupon?'?cupom='+encodeURIComponent(coupon):'',link=document.querySelector('[data-open-page-wishes]');if(link)link.href='/index.html'+query+'#desejos';
 target.innerHTML=productReactionMarkup(form.dataset.sku)+'<p class="product-affection-help">Guarde o que combina com você, sem cadastro. <a href="/index.html'+esc(query)+'#desejos">Ver meus desejos ↗</a></p>';void hydrateProductReactions(target);
 try{const catalog=await loadProducts(),base=catalog.find(p=>p.sku===form.dataset.sku),section=document.getElementById('productPageComplements');if(!base||!section)return;const choices=routinePairings(base,catalog);if(!choices.length)return;section.hidden=false;section.innerHTML='<h3>Um carinho a mais na sua rotina</h3><p>Da mesma linha. Uma unidade de cada cuidado, somente se você escolher.</p>'+choices.map(p=>'<article><strong>'+esc(p.name)+'</strong><small>'+money(p.price)+' individual</small><button type="button" data-page-pair="'+esc(p.sku)+'">Adicionar os dois · '+money(Number(base.price)+Number(p.price))+'</button></article>').join('')+'<p>O total soma os dois produtos, sem desconto adicional. Frete no checkout.</p><p data-page-pair-message role="status"></p>';section.addEventListener('click',event=>{const button=event.target.closest('[data-page-pair]');if(!button)return;try{storeProductPair(base,catalog.find(p=>p.sku===button.dataset.pagePair));location.assign('/index.html?sacola=1'+(coupon?'&cupom='+encodeURIComponent(coupon):''));}catch(error){section.querySelector('[data-page-pair-message]').textContent=error.message;}});
 }catch{/* Optional complements never prevent reading the product or buying it. */}
}
