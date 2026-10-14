'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {quoteShipping,authorizeShipping}=require('./correios-service');
const env={CORREIOS_USERNAME:'test',CORREIOS_ACCESS_CODE:'test',CORREIOS_CONTRACT:'123',CORREIOS_DR:'10',CORREIOS_PACKAGE_LENGTH_CM:'25',CORREIOS_PACKAGE_WIDTH_CM:'20',CORREIOS_PACKAGE_HEIGHT_CM:'15',CORREIOS_PACKAGE_TARE_GRAMS:'100',CORREIOS_PACKAGE_MAX_ITEMS:'4',CORREIOS_PREPARATION_DAYS:'2'};
const input={cep:'01310-100',items:[{sku:'TEST',quantity:2}]};
function dependencies(change={}) {
  return {env,token:'test',lookup:async()=>({active:true,shippingWeightGrams:500}),fetch:async url=>{
    const parsed=new URL(url); const code=parsed.pathname.split('/').pop();
    if (parsed.pathname.startsWith('/preco')) {
      assert.equal(parsed.searchParams.get('cepOrigem'),'04883000'); assert.equal(parsed.searchParams.get('psObjeto'),'1100');
      return {ok:true,json:async()=>code==='03158'?{txErro:'Not available'}:{coProduto:code,pcFinal:'25,90'}};
    }
    return {ok:true,json:async()=>({coProduto:code,prazoEntrega:3,entregaDomiciliar:'S'})};
  },...change};
}
test('cotação usa peso do servidor e exclui serviços indisponíveis',async()=>{
  const result=await quoteShipping({...input,weight:1,cost:0},dependencies());
  assert.equal(result.options.length,3); assert.equal(result.options.some(o=>o.code==='03158'),false);
  assert.equal(result.options[0].cost,25.9); assert.equal(result.options[0].preparationDays,2);
});
test('checkout recusa preço adulterado, serviço indisponível e CEP inválido',async()=>{
  await assert.rejects(authorizeShipping({...input,selection:{code:'03220',cost:.01}},dependencies()),e=>e.code==='SHIPPING_QUOTE_CHANGED');
  await assert.rejects(authorizeShipping({...input,selection:{code:'03158',cost:25.9}},dependencies()));
  await assert.rejects(quoteShipping({...input,cep:'123'},dependencies()));
  const authorized=await authorizeShipping({...input,selection:{code:'03220',cost:25.9}},dependencies()); assert.equal(authorized.carrier,'Correios');
});
test('sem configuração, peso ou resposta confiável, não inventa frete',async()=>{
  await assert.rejects(quoteShipping(input,dependencies({env:{}})),e=>e.status===503);
  await assert.rejects(quoteShipping(input,dependencies({lookup:async()=>({weight:'500ml'})})),e=>e.status===503);
  await assert.rejects(quoteShipping(input,dependencies({fetch:async()=>{throw new Error('secret-provider-payload');}})),e=>!e.message.includes('secret'));
  await assert.rejects(quoteShipping({...input,items:[{sku:'TEST',quantity:5}]},dependencies()),e=>e.code==='PACKAGE_CAPACITY');
});
