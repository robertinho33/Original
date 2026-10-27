const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heart='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const bag='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>';
const memoryKey='fp-shopping-affection-v1';let memory;
function readMemory(){try{const parsed=JSON.parse(localStorage.getItem(memoryKey)||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};return Object.fromEntries(Object.entries(parsed).filter(([sku,value])=>sku.length<=100&&value&&typeof value==='object'&&(value.like===true||value.want===true)).slice(0,200).map(([sku,value])=>[sku,{like:value.like===true,want:value.want===true}]));}catch{return {};}}
function state(){if(!memory)memory=readMemory();return memory;}
export function savedShopping(){return Object.entries(state()).map(([sku,value])=>({sku,...value}));}
function syncButtons(){for(const node of document.querySelectorAll('[data-product-reactions]'))for(const button of node.querySelectorAll('[data-product-reaction]')){const kind=button.dataset.productReaction,active=state()[node.dataset.productReactions]?.[kind]===true;button.setAttribute('aria-pressed',String(active));}}
export function setSavedShopping(sku,kind,active){
 if(!['like','want'].includes(kind)||typeof sku!=='string'||!sku||sku.length>100)throw Error('Escolha um produto válido.');
 const values=state();if(active&&!values[sku]&&Object.keys(values).length>=200)throw Error('Sua lista está cheia. Retire um cuidado antes de guardar outro.');
 values[sku]={...(values[sku]||{}),[kind]:active};if(!values[sku].like&&!values[sku].want)delete values[sku];let persisted=true;try{localStorage.setItem(memoryKey,JSON.stringify(values));}catch{persisted=false;}
 syncButtons();window.dispatchEvent(new CustomEvent('fp-shopping-change'));return persisted;
}
export function productReactionMarkup(sku){return '<div class="product-community" data-product-reactions="'+esc(sku)+'"><div class="product-community-actions" aria-label="Curtidas e desejos"><button type="button" data-product-reaction="like" aria-label="Gostei deste cuidado" aria-pressed="false" title="Gostei">'+heart+'<span>…</span></button><button type="button" data-product-reaction="want" aria-label="Guardar nos meus desejos" aria-pressed="false" title="Quero · guardar nos meus desejos">'+bag+'<span>…</span></button><small>Curtidas e desejos</small></div><p data-product-reaction-notice role="status" aria-live="polite" hidden></p></div>';}
let snapshot=null,until=0,pending=null,writeQueue=Promise.resolve();
async function totals(){if(snapshot&&Date.now()<until)return snapshot;if(!pending)pending=fetch('/api/community/products/reactions',{signal:AbortSignal.timeout(15000)}).then(async response=>{const result=await response.json();if(!response.ok||!result.success||!Array.isArray(result.data))throw Error('Interações indisponíveis');snapshot=new Map(result.data.map(row=>[row.sku,row]));until=Date.now()+15000;return snapshot;}).finally(()=>{pending=null;});return pending;}
function showCounts(rows,root=document){for(const node of root.querySelectorAll('[data-product-reactions]')){const row=rows.get(node.dataset.productReactions);for(const button of node.querySelectorAll('[data-product-reaction]')){const count=Math.max(0,Number(row?.[button.dataset.productReaction==='like'?'likes':'wants'])||0);button.querySelector('span').textContent=count.toLocaleString('pt-BR');}}}
export function recordShoppingReaction(sku,kind,active){
 const job=writeQueue.then(async()=>{if(pending)try{await pending;}catch{}const response=await fetch('/api/community/products/react',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({sku,kind,active}),signal:AbortSignal.timeout(20000)}),result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Não foi possível atualizar o contador agora.');if(!snapshot)snapshot=new Map();snapshot.set(sku,result.data);until=Date.now()+15000;showCounts(snapshot);return result.data;});writeQueue=job.catch(()=>{});return job;
}
export async function hydrateProductReactions(root){
 const nodes=[...root.querySelectorAll('[data-product-reactions]')];if(!nodes.length)return;
 for(const node of nodes)for(const button of node.querySelectorAll('[data-product-reaction]')){if(button.dataset.noticeBound)continue;button.dataset.noticeBound='true';button.addEventListener('click',event=>{
  event.stopPropagation();const sku=node.dataset.productReactions,kind=button.dataset.productReaction,active=state()[sku]?.[kind]!==true,notice=node.querySelector('[data-product-reaction-notice]');
  try{const persisted=setSavedShopping(sku,kind,active);notice.hidden=true;window.dispatchEvent(new CustomEvent('fp-shopping-toast',{detail:{message:active?(kind==='like'?'Um cuidado que ganhou seu coração.':'Guardado nos seus desejos.'):kind==='like'?'Curtida desfeita.':'Retirado dos seus desejos.',persisted}}));void recordShoppingReaction(sku,kind,active).catch(()=>{notice.hidden=false;notice.textContent='Sua escolha ficou neste aparelho. O contador está indisponível no momento.';});}
  catch(error){notice.hidden=false;notice.textContent=error.message;}
 });}
 syncButtons();try{showCounts(await totals(),root);}catch{for(const node of nodes)for(const button of node.querySelectorAll('[data-product-reaction]'))button.querySelector('span').textContent='—';}
}
export function refreshShoppingMemory(){memory=readMemory();syncButtons();window.dispatchEvent(new CustomEvent('fp-shopping-change'));}
