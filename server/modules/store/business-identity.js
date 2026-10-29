'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const identity=require('../../config/business-identity.json');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const whatsapp=data=>/^\d{12,13}$/.test(data.whatsapp||'')?'https://wa.me/'+data.whatsapp:'';
function renderBusinessIdentity(data=identity){
 const phone=whatsapp(data),email=typeof data.email==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(data.email)?data.email:'';
 return '<section class="store-identity" aria-label="Identificação e contato da loja"><strong>'+escape(data.brand)+'</strong><span>Nome comercial: '+escape(data.publicName||data.brand)+' · CNPJ '+escape(data.cnpj)+'</span>'+(data.address?'<address>'+escape(data.address)+'</address>':'')+'<span>'+(phone?'<a href="'+phone+'" target="_blank" rel="noopener noreferrer">WhatsApp '+escape(data.phone)+'</a>':'')+(email?' · <a href="mailto:'+encodeURIComponent(email)+'">'+escape(email)+'</a>':'')+'</span><a href="/pages/atendimento.html">Atendimento e informações da loja ↗</a></section>';
}
function injectBusinessIdentity(html,data=identity){let result=html.replaceAll('<!--STORE_IDENTITY-->',renderBusinessIdentity(data));const contact=whatsapp(data);if(contact)result=result.replaceAll('https://wa.me/5511986215473',contact);return result;}
const publicPages={'/':'index.html','/index.html':'index.html',...Object.fromEntries(['parceiros','atendimento','trocas','privacidade','checkout','rastrear-pedido','monte-seu-ritual','vitrine-influenciador','influenciadores'].map(name=>['/pages/'+name+'.html','pages/'+name+'.html']))};
function registerPublicIdentityPages(app,{root}){
 app.get('/pages/boas-vindas.html',(req,res)=>res.redirect(302,'/index.html'));
 for(const [route,file]of Object.entries(publicPages))app.get(route,async(req,res,next)=>{try{const html=await fs.readFile(path.join(root,file),'utf8');if(!res.getHeader('Cache-Control'))res.set('Cache-Control','public, max-age=0, must-revalidate');res.type('html').send(injectBusinessIdentity(html));}catch(error){next(error);}});
}
module.exports={identity,renderBusinessIdentity,injectBusinessIdentity,registerPublicIdentityPages,publicPages};
