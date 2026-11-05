import {META_PIXEL_ID,META_CONSENT_KEY,metaContext} from './meta-policy.js';
import {readConsent} from './analytics-policy.js';
const permitted=()=>navigator.globalPrivacyControl!==true&&navigator.doNotTrack!=='1'&&readConsent(localStorage.getItem(META_CONSENT_KEY))==='granted';
let context=null;
try{if(window.parent!==window&&window.parent.location.origin===location.origin)context=metaContext(window.parent.location.href);}catch{}
if(context&&permitted()){
 // This document contains no forms, saved order links, or customer details.
 const clean=location.origin+context.path+(context.fbclid?'?fbclid='+encodeURIComponent(context.fbclid):'');
 history.replaceState(null,'',clean);
 document.title='Fios Perfeitos';
 const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments);};
 fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];window.fbq=fbq;window._fbq=fbq;
 fbq('consent','revoke');
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='fp-meta-revoke')fbq('consent','revoke');});
 const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';script.referrerPolicy='no-referrer';
 script.onload=()=>{
  if(!permitted())return;
  fbq('set','autoConfig',false,META_PIXEL_ID);
  fbq('init',META_PIXEL_ID);
  fbq('consent','grant');
  fbq('track','PageView');
 };
 document.head.append(script);
}
