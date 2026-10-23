import {readConsent,CONSENT_TTL} from './analytics-policy.js';
import {ADS_CONSENT_KEY,adsContext,safePurchase} from './ads-policy.js';
const context=adsContext(location.href);
const allows=()=>navigator.globalPrivacyControl!==true && navigator.doNotTrack!=='1';
export function adsChoice(){try{return readConsent(localStorage.getItem(ADS_CONSENT_KEY));}catch{return null;}}
let consent=adsChoice(),frame=null,ready=false,pending=null;
const sent=new Set();
function clearCookies(){for(const item of document.cookie.split(';')){const name=item.split('=')[0].trim();if(!/^_gcl_/.test(name))continue;for(const domain of ['',location.hostname,'.fiosperfeitos.com.br'])document.cookie=name+'=; Max-Age=0; Path=/; Secure; SameSite=Lax'+(domain?'; Domain='+domain:'');}}
function active(){return context && allows() && consent==='granted';}
function start(){
 if(!active() || frame || (context.tracking && !pending))return;
 frame=document.createElement('iframe'); frame.hidden=true; frame.title='Medição opcional de anúncios';
 frame.referrerPolicy='no-referrer';
 frame.src='/pages/ads-measurement.html'+(context.gclid?'?gclid='+encodeURIComponent(context.gclid):'');
 document.body.append(frame);
}
function flush(){if(active() && ready && pending && !sent.has(pending.transaction_id))frame.contentWindow.postMessage({type:'fp-ads-purchase',purchase:pending},location.origin);}
export function chooseAds(value){
 consent=value==='granted' && allows()?'granted':'denied';
 try{localStorage.setItem(ADS_CONSENT_KEY,JSON.stringify({value:consent,savedAt:Date.now()}));}catch{}
 if(consent!=='granted'){
  frame?.contentWindow.postMessage({type:'fp-ads-revoke'},location.origin);
  frame?.remove(); frame=null;ready=false;clearCookies();
 }else{start();flush();}
}
export function mountAdsChoice(panel){
 const label=document.createElement('label');label.className='ads-consent-choice';
 const input=document.createElement('input');input.type='checkbox';input.checked=adsChoice()==='granted';input.disabled=!allows();
 const text=document.createElement('span');text.textContent='Também permitir medição de anúncios pelo Google Ads para associar compras aos anúncios. Opcional, sem personalização.';
 label.append(input,text);panel.append(label);
 return accepted=>chooseAds(accepted && input.checked?'granted':'denied');
}
export function measurePurchase(value){
 pending=safePurchase(value);if(!pending)return;
 try{const timestamp=Number(localStorage.getItem('fp-ads-purchase-'+pending.transaction_id));if(timestamp && Date.now()-timestamp<CONSENT_TTL)sent.add(pending.transaction_id);}catch{}
 start();flush();
}
window.addEventListener('message',event=>{
 if(!frame || event.origin!==location.origin || event.source!==frame.contentWindow)return;
 if(event.data?.type==='fp-ads-ready'){ready=true;flush();}
 if(event.data?.type==='fp-ads-queued' && pending && event.data.id===pending.transaction_id){
  sent.add(pending.transaction_id);try{localStorage.setItem('fp-ads-purchase-'+pending.transaction_id,String(Date.now()));}catch{}
 }
});
window.addEventListener('storage',event=>{
 if(event.key!==ADS_CONSENT_KEY && event.key!==null)return;
 consent=readConsent(event.newValue);
 if(consent!=='granted'){frame?.remove();frame=null;ready=false;clearCookies();}else{start();flush();}
});
// Tracking pages do not load Analytics or any third-party tag in the private document.
if(context?.tracking){
 const button=document.createElement('button');button.type='button';button.className='analytics-preferences';button.textContent='Preferências de medição de anúncios';
 button.addEventListener('click',()=>{
  const panel=document.createElement('section');panel.className='analytics-consent';panel.setAttribute('aria-label','Medição opcional de anúncios');
  const title=document.createElement('strong');title.textContent='Medição dos anúncios';panel.append(title);
  const save=mountAdsChoice(panel),actions=document.createElement('div');actions.className='analytics-consent-actions';
  for(const [text,accepted] of [['Recusar',false],['Salvar preferência',true]]){const control=document.createElement('button');control.type='button';control.textContent=text;control.onclick=()=>{save(accepted);panel.remove();button.focus();};actions.append(control);}
  panel.append(actions);document.body.append(panel);panel.querySelector('input').focus();
 });(document.querySelector('footer')||document.body).append(button);
}
start();
