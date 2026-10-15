'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const router=require('./shipping-routes');
function response(){return {statusCode:200,headers:{},setHeader(key,value){this.headers[key]=value;},status(value){this.statusCode=value;return this;},json(data){this.body=data;return this;}};}
test('falta de configuração é informada em JSON sem expor credenciais',async()=>{
  const previous=process.env.CORREIOS_USERNAME;process.env.CORREIOS_USERNAME='';
  try {
    const configuration=router.stack.find(layer=>layer.route?.path==='/configuration').route.stack[0].handle;
    const config=response();configuration({},config);assert.equal(config.body.enabled,false);
    assert.equal(config.headers['Cache-Control'],'no-store');assert.doesNotMatch(JSON.stringify(config.body),/USERNAME|ACCESS_CODE|CONTRACT/);
    const quote=router.stack.find(layer=>layer.route?.path==='/quote').route.stack[0].handle;
    const result=response();await quote({ip:'test-configuration',body:{cep:'01001000',items:[{sku:'TEST',quantity:1}]}},result);
    assert.equal(result.statusCode,503);assert.equal(result.body.code,'SHIPPING_NOT_CONFIGURED');assert.match(result.body.message,/atendimento/);
    const invalid=response();await quote({ip:'test-invalid',body:{cep:'123',items:[]}},invalid);
    assert.equal(invalid.statusCode,400);assert.equal(invalid.body.success,false);
  } finally {if(previous===undefined)delete process.env.CORREIOS_USERNAME;else process.env.CORREIOS_USERNAME=previous;}
});
