export const ADS_ID='AW-18532019425';
export const ADS_DESTINATION=ADS_ID+'/sM8dCPLXraYdEOHZ4IRF';
export const ADS_CONSENT_KEY='fp-ads-consent-v1';
export function adsContext(href) {
 try {
  const url=new URL(href);
  if(url.protocol!=='https:' || !['www.fiosperfeitos.com.br','fiosperfeitos.com.br'].includes(url.hostname))return null;
  if(url.pathname==='/pages/rastrear-pedido.html')return {tracking:true};
  if(!['/','/index.html','/produtos','/pages/checkout.html','/pages/privacidade.html','/pages/trocas.html'].includes(url.pathname) && !/^\/produto\/[^/]{1,160}$/.test(url.pathname))return null;
  if([...url.searchParams.keys()].some(k=>/token|pedido|payment|collection|merchant_order|preference/i.test(k)) || /token=/i.test(url.hash))return null;
  const gclid=url.searchParams.get('gclid');
  return {tracking:false,gclid:/^[a-zA-Z0-9_-]{1,250}$/.test(gclid||'')?gclid:''};
 }catch{return null;}
}
export function safePurchase(value) {
 if(!value || !/^[a-f0-9]{64}$/.test(value.transaction_id||'') || value.currency!=='BRL' ||
  typeof value.value!=='number' || !Number.isFinite(value.value) || value.value<=0)return null;
 return {transaction_id:value.transaction_id,value:Math.round(value.value*100)/100,currency:'BRL'};
}
