'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const express = require('express');
const {identity,renderBusinessIdentity,registerPublicIdentityPages,publicPages} = require('./business-identity');
const {deliveryHeaders} = require('../../infrastructure/web-delivery');
const {isPublicFile} = require('../../infrastructure/public-files');
const root = path.resolve(__dirname,'../../..');

test('visitor navigation connects shopping, care, orders, partnerships and help on public pages',async t=>{
 const app=express();registerPublicIdentityPages(app,{root});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});const base='http://127.0.0.1:'+server.address().port;
 const pages=['/index.html','/pages/monte-seu-ritual.html','/pages/rastrear-pedido.html','/pages/parcerias.html','/pages/candidatura-influenciador.html','/pages/influenciadores.html','/pages/parceiros.html','/pages/atendimento.html'];
 for(const page of pages){const response=await fetch(base+page);assert.equal(response.status,200);const html=await response.text(),nav=html.match(/<nav class="visitor-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];assert.ok(nav,page);assert.match(nav,/aria-current=/);for(const href of ['/index.html#colecao','/pages/monte-seu-ritual.html','/pages/rastrear-pedido.html','/pages/parcerias.html','/pages/atendimento.html']){assert.ok(nav.includes('href="'+href+'"'),page+' / '+href);assert.ok(isPublicFile(new URL(href,base).pathname));assert.equal((await fetch(new URL(href,base))).status,200);}}
 const hub=await(await fetch(base+'/pages/parcerias.html')).text();for(const href of ['/pages/candidatura-influenciador.html','/pages/influenciadores.html','/pages/parceiros.html'])assert.ok(hub.includes('href="'+href+'"'));assert.match(hub,/Cadastro sujeito à análise/);assert.match(hub,/store-identity/);
});

test('domain opens index store with influencer CTA and preserved catalog', async t => {
  assert.equal(publicPages['/'],'index.html');
  const app=express();registerPublicIdentityPages(app,{root});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>{server.close();server.closeAllConnections();});
  const base='http://127.0.0.1:'+server.address().port;
  const home=await(await fetch(base+'/')).text();
  assert.equal(home,await(await fetch(base+'/index.html')).text());
  const legacy=await fetch(base+'/pages/boas-vindas.html',{redirect:'manual'});assert.equal(legacy.status,302);assert.equal(legacy.headers.get('location'),'/index.html');
  assert.equal(home,await(await fetch(base+'/pages/boas-vindas.html')).text());
  assert.doesNotMatch(home,/Bem-vindo\.|Entrar na loja/);
  assert.match(home,/href="\/pages\/candidatura-influenciador.html">Seja um Influencer/);
  assert.match(home,/id="colecao"/);assert.match(home,/id="openCart"/);
  assert.doesNotMatch(home,/ESCOLHAS PARA A SUA ROTINA|class="hero-secondary"/);
});

test('business identity escapes document fields and omits missing or unsafe contacts', () => {
  const html = renderBusinessIdentity({brand:'<script>bad</script>',publicName:'" & company',cnpj:'123',address:'<img src=x>',email:'bad@<img>.com',whatsapp:'javascript:bad'});
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&quot; &amp; company/);
  assert.match(html,/&lt;img src=x&gt;/);
  assert.doesNotMatch(html,/<script|<img|mailto:|href="javascript:/);
  assert.doesNotMatch(renderBusinessIdentity({}),/<address>|mailto:/);
});

test('all entry, product and purchase pages show the same business identity without client scripts', async t => {
  const app=express();
  app.use(deliveryHeaders);
  registerPublicIdentityPages(app,{root});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const route of Object.keys(publicPages)) {
    const response=await fetch(base+route);
    assert.equal(response.status,200,route);
    const html=await response.text();
    assert.ok(html.includes(identity.publicName),route);
    assert.ok(html.includes(identity.address),route);
    assert.ok(html.includes(identity.email),route);
    assert.ok(html.includes('mailto:fiosperfeitoscosmetcs%40gmail.com'),route);
    assert.doesNotMatch(html,/Roberto Ferreira Silva|Roberto Silva|sou_roberto@hotmail\.com/i,route);
    assert.doesNotMatch(html,/<!--STORE_IDENTITY-->/,route);
    if(['/pages/checkout.html','/pages/rastrear-pedido.html','/pages/influenciadores.html'].includes(route)) {
      assert.equal(response.headers.get('cache-control'),'no-store',route);
      assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow',route);
    }
  }
  const {renderProduct}=require('../catalog/product-pages');
  const product=renderProduct({name:'Produto teste',sku:'TEST',price:10,stock:1}).html;
  assert.ok(product.includes(identity.publicName));
  assert.doesNotMatch(product,/Roberto Ferreira Silva|Roberto Silva|sou_roberto@hotmail\.com/i);
  assert.ok(product.includes(identity.address));
  assert.match(product,/prazo de preparação/);
  assert.equal((await fetch(base+'/server/config/business-identity.json')).status,404);
  assert.equal(isPublicFile('/server/config/business-identity.json'),false);
  for(const file of ['/pages/atendimento.html','/js/store/support.js','/css/store-trust.css']) assert.equal(isPublicFile(file),true);
});

test('public identity uses commercial name without exposing internal legal identity',()=>{
  const html=renderBusinessIdentity({...identity,legalName:'PRIVATE LEGAL NAME',responsibleName:'PRIVATE PERSON'});
  assert.match(html,/Fios Perfeitos Cosmetcs/);
  assert.doesNotMatch(html,/PRIVATE LEGAL NAME|PRIVATE PERSON/);
});

test('all browser pages and product pages use FP favicon with cache version',()=>{
  const fs=require('node:fs');
  for(const file of ['index.html',...fs.readdirSync(path.join(root,'pages')).filter(name=>name.endsWith('.html')).map(name=>'pages/'+name)]){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(html,/rel="icon" type="image\/svg\+xml" href="\/assets\/brands\/fp.svg\?v=20261029"/,file);
    assert.match(html,/href="\/favicon.ico\?v=20261029"/,file);
  }
  const svg=fs.readFileSync(path.join(root,'assets/brands/fp.svg'),'utf8');assert.match(svg,/>FP<\/text>/);
  const ico=fs.readFileSync(path.join(root,'favicon.ico'));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),1);
  assert.equal(isPublicFile('/assets/brands/fp.svg'),true);
  const product=require('../catalog/product-pages').renderProduct({name:'Produto',sku:'TEST',price:10,stock:1}).html;
  assert.match(product,/\/assets\/brands\/fp.svg\?v=20261029/);
});

test('support messages do not require order number or withdrawal justification, and reject private tracking tokens', async () => {
  const source=readFileSync(path.join(root,'js/store/support.js'),'utf8');
  const {prepareSupportMessage,safeOrderNumber}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(prepareSupportMessage({subject:'arrependimento'}),'Olá, equipe Fios Perfeitos!\nAssunto: Devolução por arrependimento');
  assert.equal(safeOrderNumber('a'.repeat(64)),'');
  assert.equal(safeOrderNumber('AUR-123'),'AUR-123');
  assert.equal(safeOrderNumber('<img src=x>'),'');
  assert.throws(()=>prepareSupportMessage({subject:'constructor'}));
  const details='<img src=x onerror=alert(1)>';
  assert.ok(prepareSupportMessage({subject:'problema',details}).endsWith(details));
  assert.equal(prepareSupportMessage({subject:'duvida',details:'a'.repeat(900)}).split('\n').at(-1).length,600);
  // Preparing a request must not transmit it, persist its text, or register a false receipt.
  assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|innerHTML|window\.open\(/);
  const policy=readFileSync(path.join(root,'js/analytics/analytics-policy.js'),'utf8');
  const {analyticsPage}=await import('data:text/javascript;base64,'+Buffer.from(policy).toString('base64'));
  assert.equal(analyticsPage('https://www.fiosperfeitos.com.br/pages/atendimento.html'),null);
});
