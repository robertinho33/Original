import { installProductImageFallbacks } from './catalog/image-fallback.js';
installProductImageFallbacks();
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('storePhoto')?.addEventListener('error',()=>{$('storePhoto').hidden=true;});
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const params=new URLSearchParams(location.search), coupon=(params.get('cupom')||'').slice(0,60);
const steps={wash:'01 · Limpar',treat:'02 · Tratar',finish:'03 · Finalizar'};
let selected=[],currentCoupon=coupon;
function updatePartnerLinks(){
  for(const link of document.querySelectorAll('a[href="/index.html"]'))if(currentCoupon)link.href='/index.html?cupom='+encodeURIComponent(currentCoupon);
}
updatePartnerLinks();
const image=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function cards(products){return products.map(p=>`<article class="portal-product-card">${image(p.image)?`<img class="product-image" src="${esc(image(p.image))}" alt="${esc(p.name)}" loading="lazy">`:'<div class="product-image-placeholder">Imagem indisponível</div>'}<div>${p.step?`<span class="eyebrow">${esc(steps[p.step])}</span>`:''}<h3>${esc(p.name)}</h3><p>${esc(p.reason||'')}</p>${Array.isArray(p.matchReasons)&&p.matchReasons.length?`<details class="ritual-match"><summary>Por que este produto combina com você?</summary><ul>${p.matchReasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul></details>`:''}<strong>${money(p.price)}</strong><p><a class="quiet-link" href="/index.html?${new URLSearchParams({search:p.sku,...(currentCoupon?{cupom:currentCoupon}:{})})}#colecao">Ver detalhes na loja ↗</a></p></div></article>`).join('');}
async function api(path,body){const res=await fetch('/api/discovery/'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const result=await res.json();if(!res.ok||!result.success)throw Error(result.error||'Não foi possível consultar agora.');return result.data;}
$('ritualForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;$('discoveryMessage').textContent='Encontrando o cuidado do seu jeito…';$('ritualResult').hidden=true;
  try{const data=await api('ritual',Object.fromEntries(new FormData(event.currentTarget)));selected=data.products;$('discoveryMessage').textContent=data.message;$('discoveryProducts').innerHTML=cards(selected);if($('ritualExplanation'))$('ritualExplanation').textContent=data.explanation||'';$('ritualTotal').textContent=money(data.total)+' em produtos · frete calculado no checkout';$('ritualResult').hidden=!selected.length;}
  catch(error){$('discoveryMessage').textContent=error.message;}finally{button.disabled=false;}
});
function cart(items){
  let current;try{current=JSON.parse(localStorage.getItem('aurea-cart')||'[]');}catch{current=[];}
  if(!Array.isArray(current))current=[];
  const rows=current.filter(row=>typeof row?.sku==='string'&&Number.isInteger(row.quantity)&&row.quantity>0).map(row=>({sku:row.sku,quantity:row.quantity}));
  for(const item of items){const row=rows.find(row=>row.sku===item.sku);if(row)row.quantity++;else rows.push({sku:item.sku,quantity:1});}
  localStorage.setItem('aurea-cart',JSON.stringify(rows));
}
$('addRitual')?.addEventListener('click',()=>{try{if(!selected.length)return;cart(selected);location.href='/pages/checkout.html'+(currentCoupon?'?cupom='+encodeURIComponent(currentCoupon):'');}catch{$('discoveryMessage').textContent='Não foi possível salvar sua sacola neste aparelho. Abra os produtos pela loja.';}});
if($('publicStore')){
  (async()=>{try{
    const id=params.get('loja');if(!id)throw Error('Abra o link de uma vitrine compartilhada pela loja.');
    const data=await api('stores/'+encodeURIComponent(id));currentCoupon=data.coupon;updatePartnerLinks();
    $('storeName').textContent=data.name;$('storeBio').textContent=data.bio;
    if(image(data.image)){$('storePhoto').src=image(data.image);$('storePhoto').hidden=false;}
    if(data.videoUrl){$('storeVideo').href=data.videoUrl;$('storeVideo').hidden=false;}
    $('storeCoupon').textContent='Cupom desta parceria: '+data.coupon+'. A validade e as condições serão conferidas no checkout.';
    $('storeRitual').href='/pages/monte-seu-ritual.html?cupom='+encodeURIComponent(data.coupon);
    $('discoveryProducts').innerHTML=cards(data.products);$('discoveryMessage').textContent=data.products.length?'Seleção pessoal deste parceiro da Fios Perfeitos.':'Nenhum produto desta seleção está disponível no momento.';
    $('publicStore').hidden=false;
  }catch(error){$('discoveryMessage').textContent=error.message;}})();
}
