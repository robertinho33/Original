'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const identity=require('../../config/business-identity.json');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const whatsapp=data=>/^\d{12,13}$/.test(data.whatsapp||'')?'https://wa.me/'+data.whatsapp:'';
function renderBusinessIdentity(data=identity){
 const phone=whatsapp(data),email=typeof data.email==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(data.email)?data.email:'';
 return '<section class="store-identity" aria-label="Identificação e contato da loja"><strong>'+escape(data.brand)+'</strong><span>Nome comercial: '+escape(data.publicName||data.brand)+' · CNPJ '+escape(data.cnpj)+'</span>'+(data.address?'<address>'+escape(data.address)+'</address>':'')+'<span>'+(phone?'<a href="'+phone+'" target="_blank" rel="noopener noreferrer">WhatsApp '+escape(data.phone)+'</a>':'')+(email?' · <a href="mailto:'+encodeURIComponent(email)+'">'+escape(email)+'</a>':'')+'</span><a href="/pages/atendimento.html">Atendimento e informações da loja ↗</a></section>';
}
function addStoreContact(html, data = identity) {
 const phone = whatsapp(data);
 const googleReport = 'https://transparencyreport.google.com/safe-browsing/search?url=www.fiosperfeitos.com.br&amp;hl=pt_BR';
 const badge = `<a class="store-security-check" href="${googleReport}" target="_blank" rel="noopener noreferrer"><img src="/assets/brands/google-safe-browsing.svg" width="210" height="48" loading="lazy" alt="Consultar a segurança do site no Google"></a>`;
 const button = phone ? `<a class="store-whatsapp" href="${phone}" target="_blank" rel="noopener noreferrer" aria-label="Falar com a Fios Perfeitos pelo WhatsApp" title="Fale com a loja pelo WhatsApp"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M20.7 11.7a8.7 8.7 0 0 1-12.9 7.6L3 20.7l1.4-4.6a8.7 8.7 0 1 1 16.3-4.4Z"/><path d="M9 8.1c-.4-.3-.9 0-1.1.4-.9 1.9 2.8 5.8 4.9 6.5 1 .4 2.3.3 2.8-.7.2-.5.2-.8-.3-1l-1.4-.7c-.4-.2-.6.1-.9.5-.2.3-.5.4-.9.1a7.2 7.2 0 0 1-2.2-2.2c-.2-.3-.2-.5.1-.8.3-.3.4-.5.2-.8l-.7-1.1c-.1-.1-.3-.2-.5-.2Z"/></svg></a>` : '';
 return html.replace('</head>', '<link rel="stylesheet" href="/css/store-contact.css"></head>')
  .replace('</footer>', badge + '</footer>')
  .replace('</body>', button + '</body>');
}
function injectBusinessIdentity(html,data=identity){let result=html.replaceAll('<!--STORE_IDENTITY-->',renderBusinessIdentity(data));const contact=whatsapp(data);if(contact)result=result.replaceAll('https://wa.me/5511986215473',contact);return addStoreContact(result,data);}
const publicPages={'/':'index.html','/index.html':'index.html',...Object.fromEntries(['promocao-relampago','combos-profissionais','parcerias','candidatura-influenciador','parceiros','atendimento','trocas','privacidade','checkout','rastrear-pedido','monte-seu-ritual','vitrine-influenciador','influenciadores'].map(name=>['/pages/'+name+'.html','pages/'+name+'.html']))};
function registerPublicIdentityPages(app,{root}){
 app.get('/pages/boas-vindas.html',(req,res)=>res.redirect(302,'/index.html'));
 for(const [route,file]of Object.entries(publicPages))app.get(route,async(req,res,next)=>{try{const html=await fs.readFile(path.join(root,file),'utf8');if(!res.getHeader('Cache-Control'))res.set('Cache-Control','public, max-age=0, must-revalidate');res.type('html').send(injectBusinessIdentity(html));}catch(error){next(error);}});
}
module.exports={identity,addStoreContact,renderBusinessIdentity,injectBusinessIdentity,registerPublicIdentityPages,publicPages};
