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

test('business identity escapes document fields and omits missing or unsafe contacts', () => {
  const html = renderBusinessIdentity({brand:'<script>bad</script>',legalName:'" & company',cnpj:'123',address:'<img src=x>',email:'bad@<img>.com',whatsapp:'javascript:bad'});
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
    assert.ok(html.includes(identity.legalName),route);
    assert.ok(html.includes(identity.address),route);
    assert.ok(html.includes(identity.email),route);
    assert.doesNotMatch(html,/<!--STORE_IDENTITY-->/,route);
    if(['/pages/checkout.html','/pages/rastrear-pedido.html','/pages/influenciadores.html'].includes(route)) {
      assert.equal(response.headers.get('cache-control'),'no-store',route);
      assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow',route);
    }
  }
  const {renderProduct}=require('../catalog/product-pages');
  const product=renderProduct({name:'Produto teste',sku:'TEST',price:10,stock:1}).html;
  assert.ok(product.includes(identity.legalName));
  assert.ok(product.includes(identity.address));
  assert.match(product,/prazo de preparação/);
  assert.equal((await fetch(base+'/server/config/business-identity.json')).status,404);
  assert.equal(isPublicFile('/server/config/business-identity.json'),false);
  for(const file of ['/pages/atendimento.html','/js/store/support.js','/css/store-trust.css']) assert.equal(isPublicFile(file),true);
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
