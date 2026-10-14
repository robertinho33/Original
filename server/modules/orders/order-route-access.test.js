'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const Module=require('node:module');const originalLoad=Module._load;
let router;
try {
  Module._load=function(name,parent,main) {
    if(parent?.filename.endsWith('order-routes.js') && name.startsWith('./') && name.endsWith('controller')) {
      return new Proxy({}, {get:()=>()=>{throw new Error('Order mutation must not be reached in this access test');}});
    }
    return originalLoad.call(this,name,parent,main);
  };
  router=require('./order-routes');
} finally {Module._load=originalLoad;}
const {requireAdmin}=require('../../core/admin-auth');
test('rotas legadas de criação não permitem contornar o checkout autorizado',()=>{
  for(const route of ['/','/transaction']) {
    const layer=router.stack.find(layer=>layer.route?.path===route && layer.route.methods.post);
    assert.equal(layer.route.stack[0].handle,requireAdmin);
    let rejection;layer.route.stack[0].handle({get:()=>''},{},error=>{rejection=error;});
    assert.ok(rejection);assert.ok([401,503].includes(rejection.status));
  }
  const complete=router.stack.find(layer=>layer.route?.path==='/complete');
  assert.notEqual(complete.route.stack[0].handle,requireAdmin);
});
