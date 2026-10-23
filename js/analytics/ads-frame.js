import {ADS_ID,ADS_DESTINATION,ADS_CONSENT_KEY,safePurchase,adsContext} from './ads-policy.js';
import {readConsent} from './analytics-policy.js';
const allowed=()=>adsContext(location.origin+'/') && navigator.globalPrivacyControl!==true && navigator.doNotTrack!=='1' && readConsent(localStorage.getItem(ADS_CONSENT_KEY))==='granted';
if(window.parent!==window && allowed()){
 window.dataLayer=window.dataLayer||[];
 const gtag=function(){window.dataLayer.push(arguments);};
 const clean=location.origin+'/';
 gtag('consent','default',{analytics_storage:'denied',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied'});
 gtag('js',new Date());
 gtag('config',ADS_ID,{send_page_view:false,page_location:location.href.split('#')[0],page_referrer:'',page_title:'Fios Perfeitos',allow_ad_personalization_signals:false,cookie_flags:'SameSite=Lax;Secure'});
 const queued=new Set();
 window.addEventListener('message',event=>{
  if(event.source!==window.parent || event.origin!==location.origin)return;
  if(event.data?.type==='fp-ads-revoke'){window['ga-disable-'+ADS_ID]=true;gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});return;}
  if(event.data?.type!=='fp-ads-purchase' || !allowed())return;
  const purchase=safePurchase(event.data.purchase);if(!purchase)return;
  if(!queued.has(purchase.transaction_id)){
   queued.add(purchase.transaction_id);
   gtag('event','conversion',{send_to:ADS_DESTINATION,...purchase,page_location:clean,page_referrer:'',page_title:'Compra confirmada',allow_ad_personalization_signals:false});
  }
  window.parent.postMessage({type:'fp-ads-queued',id:purchase.transaction_id},location.origin);
 });
 const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+ADS_ID;
 script.referrerPolicy='no-referrer';
 script.onload=()=>{if(allowed())window.parent.postMessage({type:'fp-ads-ready'},location.origin);};document.head.append(script);
}
