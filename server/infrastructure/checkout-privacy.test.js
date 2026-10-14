'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../js/checkout/checkout.js'),'utf8').replace(/\r\n/g,'\n');
const functions=source.slice(source.indexOf('function saveCheckoutDraft()'),source.indexOf('/* =========================================================\n   UTILITÁRIOS',source.indexOf('function saveCheckoutDraft()')));
function setup() {
  const stored=new Map();const controls={rememberCheckout:{checked:false},customerName:{value:'Cliente de teste'}};
  const context={document:{getElementById:id=>controls[id],querySelector:()=>({value:'delivery'})},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},console,Date,Number,JSON,CSS:{escape:s=>s}};
  vm.createContext(context);vm.runInContext("const CHECKOUT_DRAFT_STORAGE_KEY='draft'; const CHECKOUT_DRAFT_TTL_MS=604800000; const CHECKOUT_DRAFT_FIELD_IDS=['customerName'];\n"+functions,context);
  return {context,stored,controls};
}
test('preenchimento não é salvo sem consentimento e desmarcar remove o rascunho',()=>{
  const {context,stored,controls}=setup();context.saveCheckoutDraft();assert.equal(stored.size,0);
  controls.rememberCheckout.checked=true;context.saveCheckoutDraft();assert.equal(JSON.parse(stored.get('draft')).consented,true);
  controls.rememberCheckout.checked=false;context.saveCheckoutDraft();assert.equal(stored.size,0);
});
test('rascunhos antigos sem consentimento e expirados são removidos',()=>{
  for(const draft of [{expiresAt:Date.now()+100000,fields:{customerName:'old'}},{consented:true,expiresAt:0,fields:{}}]) {
    const {context,stored}=setup();stored.set('draft',JSON.stringify(draft));assert.equal(context.restoreCheckoutDraft(),false);assert.equal(stored.size,0);
  }
});
test('rascunho consentido válido restaura os dados e o controle de consentimento',()=>{
  const {context,stored,controls}=setup();stored.set('draft',JSON.stringify({consented:true,expiresAt:Date.now()+100000,fields:{customerName:'Teste salvo'}}));
  assert.equal(context.restoreCheckoutDraft(),true);assert.equal(controls.rememberCheckout.checked,true);assert.equal(controls.customerName.value,'Teste salvo');
});
