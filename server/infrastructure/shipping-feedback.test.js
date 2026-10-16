const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../js/checkout/shipping-feedback.js'),'utf8');
const feedback=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('filled CEP is recognized with or without mask and does not request reentry',async()=>{
    const {shippingPrompt}=await feedback;
    for(const cep of ['04883-000','04883000']) assert.match(shippingPrompt({cep,method:'delivery',available:true}),/^CEP preenchido/);
    assert.match(shippingPrompt({cep:'04883',method:'delivery',available:true}),/8 dígitos/);
});
test('pickup and unavailable delivery take precedence over CEP prompt',async()=>{
    const {shippingPrompt}=await feedback;
    assert.match(shippingPrompt({method:'pickup',available:false}),/Não há frete/);
    assert.equal(shippingPrompt({cep:'04883000',method:'delivery',available:false,unavailableMessage:'Indisponível'}),'Indisponível');
});
test('provider access denial never asks customer to correct the CEP',async()=>{
    const {shippingFailureMessage}=await feedback;
    for(const code of ['SHIPPING_AUTH_FAILED','SHIPPING_ACCESS_DENIED']) {
        const message=shippingFailureMessage(code,'generic error');
        assert.match(message,/Não é necessário redigitar/);assert.match(message,/recusou o acesso da loja/);
    }
    assert.equal(shippingFailureMessage('PACKAGE_CAPACITY','Sacola excede limite'),'Sacola excede limite');
});
test('checkout API preserves provider access error code for correct feedback',async()=>{
    const apiSource=fs.readFileSync(path.join(__dirname,'../../js/checkout/shipping-service.js'),'utf8');
    const {calcularFretePorCEP}=await import('data:text/javascript;base64,'+Buffer.from(apiSource).toString('base64'));
    const previous=global.fetch;
    global.fetch=async()=>({ok:false,json:async()=>({success:false,code:'SHIPPING_ACCESS_DENIED',message:'Acesso recusado'})});
    try {await assert.rejects(calcularFretePorCEP('04883000',[{sku:'A',quantity:1}]),error=>error.code==='SHIPPING_ACCESS_DENIED'&&error.message==='Acesso recusado');}
    finally {global.fetch=previous;}
});
