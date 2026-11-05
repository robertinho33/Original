export const META_PIXEL_ID='1139965348583728';
export const META_CONSENT_KEY='fp-meta-consent-v1';
const pages=new Set(['/','/index.html','/produtos','/pages/monte-seu-ritual.html','/pages/parcerias.html','/pages/combos-profissionais.html','/pages/vitrine-influenciador.html','/pages/privacidade.html','/pages/trocas.html']);
const queryKeys=new Set(['fbclid','gclid','cupom','search','loja','utm_source','utm_medium','utm_campaign','utm_content','utm_term']);
export function metaContext(href){
 try{
  const url=new URL(href);
  if(url.protocol!=='https:'||!['www.fiosperfeitos.com.br','fiosperfeitos.com.br'].includes(url.hostname)||url.username||url.password||url.port)return null;
  if(!pages.has(url.pathname)&&!/^\/produto\/[a-zA-Z0-9_-]{1,100}$/.test(url.pathname))return null;
  if([...url.searchParams.keys()].some(key=>!queryKeys.has(key))||/token=|pedido=|payment=/i.test(url.hash))return null;
  const click=url.searchParams.get('fbclid')||'';
  return {path:url.pathname,fbclid:/^[a-zA-Z0-9_-]{1,500}$/.test(click)?click:''};
 }catch{return null;}
}
