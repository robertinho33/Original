import {readConsent} from './analytics-policy.js';
import {META_CONSENT_KEY,metaContext} from './meta-policy.js';
const context=metaContext(location.href);
const allows=()=>navigator.globalPrivacyControl!==true&&navigator.doNotTrack!=='1';
export function metaChoice(){try{return readConsent(localStorage.getItem(META_CONSENT_KEY));}catch{return null;}}
let consent=metaChoice(),frame=null;
function clearMetaCookies(){
 for(const entry of document.cookie.split(';')){
  const name=entry.split('=')[0].trim();if(!['_fbp','_fbc'].includes(name))continue;
  for(const domain of ['',location.hostname,'.fiosperfeitos.com.br'])document.cookie=name+'=; Max-Age=0; Path=/; Secure; SameSite=Lax'+(domain?'; Domain='+domain:'');
 }
}
function stop(){frame?.contentWindow.postMessage({type:'fp-meta-revoke'},location.origin);frame?.remove();frame=null;clearMetaCookies();}
function start(){
 if(!context||!allows()||consent!=='granted'||frame)return;
 frame=document.createElement('iframe');frame.hidden=true;frame.title='Medição opcional da Meta';frame.referrerPolicy='no-referrer';frame.src='/pages/meta-measurement.html?v=20261104';document.body.append(frame);
}
export function chooseMeta(value){
 consent=value==='granted'&&allows()?'granted':'denied';
 try{localStorage.setItem(META_CONSENT_KEY,JSON.stringify({value:consent,savedAt:Date.now()}));}catch{}
 if(consent==='granted')start();else stop();
}
export function mountMetaChoice(panel){
 const label=document.createElement('label');label.className='ads-consent-choice';
 const input=document.createElement('input');input.type='checkbox';input.dataset.metaConsent='';input.checked=metaChoice()==='granted';input.disabled=!allows();
 const text=document.createElement('span');text.textContent='Permitir o Pixel da Meta (Facebook e Instagram) para medir visitas e o desempenho dos anúncios. Opcional.';
 label.append(input,text);panel.append(label);return accepted=>chooseMeta(accepted&&input.checked?'granted':'denied');
}
window.addEventListener('storage',event=>{
 if(event.key!==META_CONSENT_KEY&&event.key!==null)return;
 consent=metaChoice();if(consent==='granted')start();else stop();
});
window.addEventListener('pageshow',()=>{consent=metaChoice();if(consent==='granted')start();else stop();});
start();
