import {readConsent} from './analytics-policy.js';
export const CARE_CONSENT_KEY='fp-care-interests-consent-v1';
export function careConsent(){try{return readConsent(localStorage.getItem(CARE_CONSENT_KEY));}catch{return null;}}
export function mountCareChoice(panel){
 if(location.pathname!=='/pages/monte-seu-ritual.html')return ()=>{};
 const label=document.createElement('label');label.className='ads-consent-choice';
 const input=document.createElement('input');input.type='checkbox';input.dataset.careConsent='';input.checked=careConsent()==='granted';input.disabled=navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 const text=document.createElement('span');text.textContent='Permitir que minhas respostas somem nos totais de interesses da loja, sem identificar meu perfil. É opcional.';
 label.append(input,text);panel.append(label);
 return accepted=>{try{localStorage.setItem(CARE_CONSENT_KEY,JSON.stringify({value:accepted&&input.checked&&!input.disabled?'granted':'denied',savedAt:Date.now()}));}catch{}};
}
