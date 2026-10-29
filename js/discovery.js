import {mountCareQuiz} from './care-quiz.js?v=20261029-3';
import {mountRitualGallery} from './ritual-gallery.js?v=20261029-eco';
import {mountPublicCommunity} from './influencers/public-community.js';
import {mergeCareCart,cleanMatchReasons} from './care-selection.js';
import {careConsent} from './analytics/care-consent.js';
import {createCareQueryController} from './care-query-controller.js';
import {readConsent,CONSENT_KEY} from './analytics/analytics-policy.js';
import { installProductImageFallbacks } from './catalog/image-fallback.js';
installProductImageFallbacks();
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('storePhoto')?.addEventListener('error',()=>{$('storePhoto').hidden=true;});
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const params=new URLSearchParams(location.search), coupon=(params.get('cupom')||'').slice(0,60);
const steps={kit:'Kit',wash:'Limpar',treat:'Tratar',condition:'Condicionar',finish:'Finalizar'};
let selected=[],currentCoupon=coupon,selectionOptions=[],selectedOption=0;
function updatePartnerLinks(){
  for(const link of document.querySelectorAll('a[href="/index.html"]'))if(currentCoupon)link.href='/index.html?cupom='+encodeURIComponent(currentCoupon);
}
updatePartnerLinks();
const image=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
function cards(products){return products.map((p,index)=>`<article class="portal-product-card">${image(p.image)?`<img class="product-image" src="${esc(image(p.image))}" alt="${esc(p.name)}" loading="lazy">`:'<div class="product-image-placeholder">Imagem indisponível</div>'}<div>${p.step?`<span class="eyebrow">${String(index+1).padStart(2,'0')} · ${esc(steps[p.step])}</span>`:''}<h3>${esc(p.name)}</h3><p>${esc(p.reason||'')}</p>${cleanMatchReasons(p.matchReasons).length?`<div class="ritual-match"><p class="ritual-match-title">Por que esta opção?</p><ul>${cleanMatchReasons(p.matchReasons).map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul></div>`:''}<strong>${money(p.price)}</strong><p><a class="quiet-link" href="/index.html?${new URLSearchParams({search:p.sku,...(currentCoupon?{cupom:currentCoupon}:{})})}#colecao">Conhecer este produto ↗</a></p></div></article>`).join('');}
async function api(path,body){const res=await fetch('/api/discovery/'+path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const result=await res.json();if(!res.ok||!result.success)throw Error(result.error||'Não foi possível consultar agora.');return result.data;}
const careForm=$('ritualForm');
if(careForm){
 const quizSteps=mountCareQuiz(careForm);
 const button=careForm.querySelector('[type="submit"]'),message=$('discoveryMessage'),dialog=$('ritualQuiz');let timer;
 const openQuiz=()=>{if(dialog&&!dialog.open){quizSteps?.open();dialog.showModal();}};
 $('openRitualQuiz')?.addEventListener('click',openQuiz);
 dialog?.querySelector('[data-close-quiz]').addEventListener('click',()=>dialog.close());
 dialog?.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
 const suggestion=$('ritualSuggestion');
 const focusResult=()=>{$('ritualResult').focus({preventScroll:true});$('ritualResult').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
 suggestion?.querySelector('[data-close-suggestion]').addEventListener('click',()=>suggestion.close());
 $('viewRitualSelection')?.addEventListener('click',()=>suggestion.close());
 suggestion?.addEventListener('close',focusResult);
 openQuiz();
 const measurement=()=>{
  try{
   if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||readConsent(localStorage.getItem(CONSENT_KEY))!=='granted'||careConsent()!=='granted')return undefined;
   const key='fp-care-session-v1',now=Date.now();let session=JSON.parse(sessionStorage.getItem(key)||'null');
   if(!session||!Number.isFinite(session.startedAt)||session.startedAt>now||now-session.startedAt>=30*60000){session={id:crypto.randomUUID(),startedAt:now};sessionStorage.setItem(key,JSON.stringify(session));}
   return {consent:true,session:session.id};
  }catch{return undefined;}
 };
 const query=createCareQueryController({
  request:async(input,signal)=>{
   const response=await fetch('/api/discovery/ritual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,measurement:measurement()}),signal:typeof AbortSignal.any==='function'?AbortSignal.any([signal,AbortSignal.timeout(60000)]):signal});
   const payload=await response.json();if(!response.ok||!payload.success)throw Error(payload.error||'Não foi possível consultar agora.');return payload.data;
  },
  start(){$('quizMessage').textContent='Estamos montando sua seleção…';selectionOptions=[];selectedOption=0;button.disabled=true;message.textContent='Um instante, estamos escolhendo suas opções…';$('ritualResult').hidden=true;selected=[];},
  result(data){
   const input=answers(),hairs={straight:'liso',wavy:'ondulado',curly:'cacheado',coily:'crespo'},goals={hydration:'hidratação e maciez',repair:'cuidado de fios danificados',frizz:'controle do frizz',curls:'definição dos cachos',color:'cuidado da cor',nutrition:'Nutrição dos fios',oiliness:'Controle da oleosidade'};
   $('ritualProfile').textContent='Para cabelo '+hairs[input.hair]+', '+(input.chemistry==='treated'?'com química ou coloração':'sem química')+', buscando '+goals[input.goal]+({normal:'',dry:', com comprimento e pontas ressecados',damaged:', com comprimento e pontas danificados',frizzy:', buscando também menos frizz no comprimento'}[input.ends]||'')+'. Limite de '+money(input.budget)+' em produtos.';
   selectionOptions=[data,...(Array.isArray(data.alternatives)?data.alternatives:[])].filter(option=>option.products?.length);selectedOption=0;
   if(selectionOptions.length){showSelection();dialog?.close();$('openRitualQuiz').textContent='Ajustar minhas respostas ↗';const first=selected[0],photo=$('suggestionImage'),src=image(first.image);$('suggestionName').textContent=first.name;$('suggestionTotal').textContent=(first.step==='kit'?'1 kit completo'+(selected.length>1?' + '+(selected.length-1)+' '+(selected.length===2?'complemento':'complementos'):''):selected.length+' '+(selected.length===1?'produto':'produtos'))+' · Total de '+money(selectionOptions[0].total)+' em produtos';photo.hidden=!src;if(src){photo.src=src;photo.alt=first.name;}$('suggestionName').hidden=selectionOptions.length>1;const comparisons=$('suggestionComparisons');comparisons.hidden=selectionOptions.length<2;comparisons.innerHTML=selectionOptions.length>1?selectionOptions.map((option,index)=>'<div class="suggestion-option">'+(image(option.products[0]?.image)?'<img src="'+esc(image(option.products[0].image))+'" alt="">':'')+'<div><span>Opção '+(index+1)+'</span><strong>'+esc(option.products[0]?.name||option.line)+'</strong></div><b>'+money(option.total)+'</b></div>').join(''):'';if(selectionOptions.length>1){photo.hidden=true;$('suggestionTitle').textContent=selectionOptions.length+' opções para você escolher';$('suggestionTotal').textContent='Compare as combinações e escolha a sua. Todas dentro de '+money(input.budget)+'.';$('viewRitualSelection').textContent='Comparar minhas opções →';}else{$('suggestionTitle').textContent='Uma seleção especial para você!';$('viewRitualSelection').textContent='Ver minha seleção →';}if(suggestion&&!suggestion.open)suggestion.showModal();else focusResult();}else{selected=[];message.textContent=data.message;$('quizMessage').textContent=data.message;$('ritualResult').hidden=true;}
  },
  error(reason){message.textContent=reason.message;$('quizMessage').textContent=reason.message;},finish(){button.disabled=false;}
 });
 function showSelection(){
  const data=selectionOptions[selectedOption];selected=data.products;message.textContent=data.message;
  $('discoveryProducts').innerHTML=cards(selected);if($('ritualGallery'))mountRitualGallery($('ritualGallery'),selected,{money,esc,safeImage:image});$('ritualExplanation').textContent=data.explanation||'';
  const remaining=Math.max(0,Number(answers().budget)-Number(data.total));
  $('ritualTotal').textContent=(selectionOptions.length>1?'Opção '+(selectedOption+1)+' selecionada: ':'Sua seleção: ')+money(data.total)+' em produtos'+(remaining>0?' · '+money(remaining)+' abaixo do seu limite.':'.')+' Frete calculado ao finalizar.';
  const options=$('ritualOptions');options.hidden=selectionOptions.length<2;
  options.innerHTML=selectionOptions.length>1?'<p>Escolha uma combinação para conhecer os produtos e adicionar à sacola:</p><div>'+selectionOptions.map((option,index)=>'<button type="button" data-ritual-option="'+index+'" aria-pressed="'+(index===selectedOption)+'"><span class="ritual-option-label">Opção '+(index+1)+(index===selectedOption?' · selecionada':'')+'</span>'+(image(option.products[0]?.image)?'<img src="'+esc(image(option.products[0].image))+'" alt="" loading="lazy">':'')+'<strong>'+esc(option.products[0]?.name||option.line||'Seleção de cuidados')+'</strong><span class="ritual-option-price">'+money(option.total)+'</span><small>'+option.products.length+' '+(option.products[0]?.step==='kit'?'itens · kit completo'+(option.products.length>1?' e complementos':''):'produtos')+'</small><small>'+option.products.slice(1).map(p=>esc(p.name)).join(' · ')+'</small></button>').join('')+'</div>':'';
  $('addRitual').textContent=selectionOptions.length>1?'Adicionar esta opção à sacola ↗':'Quero estes produtos na sacola ↗';
  $('ritualResult').hidden=false;
 }
 $('ritualOptions').addEventListener('click',event=>{const button=event.target.closest('[data-ritual-option]');if(!button)return;const index=Number(button.dataset.ritualOption);if(Number.isInteger(index)&&selectionOptions[index]){selectedOption=index;showSelection();$('ritualOptions').querySelector('[data-ritual-option="'+index+'"]')?.focus({preventScroll:true});}});
 const answers=()=>Object.fromEntries(new FormData(careForm));
 const valid=()=>[...careForm.querySelectorAll('select,input')].every(field=>field.disabled||field.validity.valid);
 const run=(force=false)=>{clearTimeout(timer);if(valid())void query.query(answers(),{force});};
 careForm.addEventListener('submit',event=>{event.preventDefault();run(true);});
 const shadeField=careForm.elements.shade,shadeLabel=$('ritualShade');
 const syncShade=()=>{if(!shadeField||!shadeLabel)return;const needsTone=careForm.elements.goal.value==='color';shadeLabel.hidden=!needsTone;shadeField.disabled=!needsTone;shadeField.required=needsTone;};
 careForm.addEventListener('change',syncShade);syncShade();
 careForm.addEventListener('input',()=>{
  clearTimeout(timer);query.invalidate();selected=[];selectionOptions=[];$('ritualResult').hidden=true;button.disabled=false;
  message.textContent=valid()?'Vamos atualizar suas opções…':'Conte um pouquinho mais para a gente encontrar suas opções.';
  $('quizMessage').textContent='';
 });
}

function cart(items){
  let current;try{current=JSON.parse(localStorage.getItem('aurea-cart')||'[]');}catch{current=[];}
  if(!Array.isArray(current))current=[];
  const rows=mergeCareCart(current,items);
  localStorage.setItem('aurea-cart',JSON.stringify(rows));
}
$('addRitual')?.addEventListener('click',()=>{try{if(!selected.length)return;cart(selected);location.href='/index.html?'+new URLSearchParams({sacola:'1',...(currentCoupon?{cupom:currentCoupon}:{})});}catch{$('discoveryMessage').textContent='Não foi possível salvar sua sacola neste aparelho. Abra os produtos pela loja.';}});
if($('publicStore')){
  (async()=>{try{
    const id=params.get('loja');if(!id)throw Error('Abra o link de uma vitrine compartilhada pela loja.');
    const data=await api('stores/'+encodeURIComponent(id));currentCoupon=data.coupon;updatePartnerLinks();
    $('storeName').textContent=data.name;$('storeBio').textContent=data.bio;
    if(image(data.image)){$('storePhoto').src=image(data.image);$('storePhoto').hidden=false;}
    if(data.videoUrl){$('storeVideo').href=data.videoUrl;$('storeVideo').hidden=false;}
    $('storeCouponTitle').textContent='Seu cupom com '+data.name;
    $('storeCoupon').textContent=data.coupon;
    $('shopStoreCoupon').href='/index.html?cupom='+encodeURIComponent(data.coupon);
    $('copyStoreCoupon').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(data.coupon);$('storeCouponMessage').textContent='Cupom copiado! Use no checkout para conferir o desconto.';}
      catch{$('storeCouponMessage').textContent='Copie o código '+data.coupon+' e use no checkout.';}
    });
    $('storeRitual').href='/pages/monte-seu-ritual.html?cupom='+encodeURIComponent(data.coupon);
    $('discoveryProducts').innerHTML=cards(data.products);$('discoveryMessage').textContent=data.products.length?'Entre, fique à vontade e descubra seus novos favoritos.':'Nenhum produto desta seleção está disponível no momento.';
    $('publicStore').hidden=false;
    if(data.features?.followers||data.features?.gallery)void mountPublicCommunity($('storeCommunity'),{owner:id,name:data.name,coupon:data.coupon,features:data.features});
  }catch(error){$('discoveryMessage').textContent=error.message;}})();
}
