'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,activeCampaign,rankProducts,read,save}=require('./promotions');
const product={sku:'SKU1',name:'Produto',description:'Texto da oferta',image:'https://example.com/product.png'};
test('campaign enforces three unique products, safe images and valid schedule',()=>{
  assert.equal(normalize({products:[product]}).products.length,1);
  assert.throws(()=>normalize({products:[product,{...product,sku:'sku1'}]}));
  assert.throws(()=>normalize({products:[1,2,3,4].map(i=>({...product,sku:String(i)}))}));
  assert.throws(()=>normalize({products:[{...product,image:'javascript:alert(1)'}]}));
  assert.throws(()=>normalize({enabled:true,products:[]}));
  assert.throws(()=>normalize({startsAt:'invalid'}));
  const campaign={enabled:true,title:'Campanha',products:[product],startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-31T23:59:59Z'};
  assert.ok(activeCampaign(campaign,Date.parse('2026-10-19')));
  assert.equal(activeCampaign(campaign,Date.parse('2026-11-01')),null);
  assert.equal(activeCampaign({...campaign,enabled:false}),null);
});
test('ranking combines quantities per SKU and only exposes product fields',()=>{
  const result=rankProducts([{products:[{...product,quantity:2,customer:'PRIVATE'},{...product,sku:'SKU2',quantity:1}]},{products:[{...product,sku:'sku1',quantity:3},{...product,sku:'invalid',quantity:-1}]}]);
  assert.equal(result[0].quantity,5);assert.equal(result.length,2);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('campaign configuration rejects influencer and collaborator access',async()=>{
  for(const handler of [read,save])for(const role of [undefined,'collaborator','influencer']){
    let status;await handler({admin:role?{role}:undefined},{status(code){status=code;return this;},json(){}});assert.equal(status,403);
  }
});
