'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {quoteShipping,configuration}=require('./melhor-envio-service');
const {authorizeShipping}=require('./shipping-provider');
const env={SHIPPING_PROVIDER:'melhor_envio',MELHOR_ENVIO_TOKEN:'private-test-token',MELHOR_ENVIO_USER_AGENT:'Fios Perfeitos (test@example.com)',CORREIOS_PACKAGE_TARE_GRAMS:'100',CORREIOS_PACKAGE_MAX_ITEMS:'3'};
const input={cep:'01001-000',items:[{sku:'A',quantity:2}]};
function result(overrides={}) {return {id:1,name:'PAC',company:{id:1},price:'10.00',custom_price:'25.90',delivery_time:2,custom_delivery_time:6,packages:[{}],...overrides};}
function dependencies(overrides={}) {return {env,lookup:async()=>({active:true,shippingWeightGrams:500,price:40}),fetch:async()=>({ok:true,json:async()=>[result(),result({id:2,name:'SEDEX',custom_price:'35.50',custom_delivery_time:3})]}),...overrides};}
test('production quote uses server weights and values, known box and customized rates',async()=>{
    const deps=dependencies({fetch:async(url,options)=>{
        assert.equal(url,'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate');
        assert.equal(options.headers.Authorization,'Bearer private-test-token');
        const body=JSON.parse(options.body);
        assert.deepEqual(body.volumes,[{length:16,width:24,height:8,weight:1.1,insurance:80}]);
        assert.deepEqual(body.from,{postal_code:'04883000'}); assert.deepEqual(body.to,{postal_code:'01001000'});
        assert.equal(body.services,'1,2'); assert.equal(options.redirect,'error');
        return {ok:true,json:async()=>[result()]};
    }});
    const quote=await quoteShipping({...input,weight:1,cost:0},deps);
    assert.equal(quote.options[0].cost,25.9);assert.equal(quote.options[0].transitDays,6);assert.equal(quote.options[0].preparationDays,3);
    assert.doesNotMatch(JSON.stringify(quote),/private-test-token|test@example/);
});
test('configuration requires account and explicit safe package capacity',()=>{
    assert.throws(()=>configuration({}));
    for(const values of [{MELHOR_ENVIO_TOKEN:''},{CORREIOS_PACKAGE_MAX_ITEMS:''},{CORREIOS_PACKAGE_TARE_GRAMS:''},{SHIPPING_PACKAGE_MAX_WEIGHT_GRAMS:'3000'}]) assert.throws(()=>configuration({...env,...values}));
});
test('authorized fixed weight includes box and allows products without measured shipping weights',async()=>{
    const fixedEnv={...env,CORREIOS_PACKAGE_TARE_GRAMS:'40',CORREIOS_PACKAGE_MAX_ITEMS:'4',SHIPPING_WEIGHT_MODE:'fixed',SHIPPING_PACKAGE_FIXED_WEIGHT_GRAMS:'2000'};
    for(const quantity of [1,4]) {
        const quote=await quoteShipping({cep:input.cep,items:[{sku:'A',quantity}],weight:1},dependencies({env:fixedEnv,lookup:async()=>({price:40,weight:'250ml'}),fetch:async(url,options)=>{
            const body=JSON.parse(options.body); assert.equal(body.volumes[0].weight,2); assert.equal(body.volumes[0].insurance,40*quantity);
            return {ok:true,json:async()=>[result()]};
        }}));
        assert.equal(quote.options[0].estimatedWeight,true);assert.equal(quote.options[0].quoteWeightGrams,2000);
    }
    await assert.rejects(quoteShipping({cep:input.cep,items:[{sku:'A',quantity:5}]},dependencies({env:fixedEnv})),e=>e.code==='PACKAGE_CAPACITY');
    await assert.rejects(quoteShipping(input,dependencies({env:fixedEnv,lookup:async()=>({price:40,shippingWeightGrams:1100})})),e=>e.code==='PACKAGE_CAPACITY');
    await assert.rejects(quoteShipping(input,dependencies({env:fixedEnv,lookup:async()=>null})),e=>e.code==='SHIPPING_PRODUCT_DATA_MISSING');
    for(const value of ['','0','NaN','2040']) assert.throws(()=>configuration({...fixedEnv,SHIPPING_PACKAGE_FIXED_WEIGHT_GRAMS:value}));
});
test('missing shipping weights, overweight and capacity do not call provider',async()=>{
    const notCalled=async()=>assert.fail('provider should not be called');
    await assert.rejects(quoteShipping(input,dependencies({lookup:async()=>({price:40,weight:'500ml'}),fetch:notCalled})),e=>e.code==='SHIPPING_PRODUCT_DATA_MISSING');
    await assert.rejects(quoteShipping(input,dependencies({lookup:async()=>({price:40,shippingWeightGrams:1000}),fetch:notCalled})),e=>e.code==='PACKAGE_CAPACITY');
    await assert.rejects(quoteShipping({...input,items:[{sku:'A',quantity:4}]},dependencies({fetch:notCalled})),e=>e.code==='PACKAGE_CAPACITY');
});
test('only valid single-package PAC and SEDEX with price and deadline are offered',async()=>{
    const rows=[result(),result({id:99}),result({error:'unavailable'}),result({custom_price:'bad'}),result({custom_delivery_time:null}),result({packages:[{},{}]}),result({company:{id:9}})];
    const quote=await quoteShipping(input,dependencies({fetch:async()=>({ok:true,json:async()=>rows})}));
    assert.equal(quote.options.length,1);
});
test('provider errors are sanitized and never become free shipping',async()=>{
    for(const fetch of [async()=>{throw Error('private-test-token');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({errors:'secret'})}),async()=>({ok:true,json:async()=>[result({custom_price:'0'})]})]) {
        await assert.rejects(quoteShipping(input,dependencies({fetch})),error=>error.code==='SHIPPING_UNAVAILABLE'&&!error.message.includes('private-test-token'));
    }
});
test('checkout requotes server side and rejects altered or stale service selections',async()=>{
    await assert.rejects(authorizeShipping({...input,selection:{code:'me:1',cost:0.01}},dependencies()),e=>e.code==='SHIPPING_QUOTE_CHANGED');
    await assert.rejects(authorizeShipping({...input,selection:{code:'03298',cost:25.9}},dependencies()),e=>e.code==='SHIPPING_QUOTE_CHANGED');
    const shipping=await authorizeShipping({...input,selection:{code:'me:1',cost:25.9}},dependencies());
    assert.equal(shipping.cost,25.9);assert.equal(shipping.provider,'melhor_envio');assert.equal(shipping.carrier,'Correios');
});
