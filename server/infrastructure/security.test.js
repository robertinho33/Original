'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {securityHeaders}=require('./security');
test('CSP restringe scripts e objetos sem permitir inline arbitrário',()=>{
  const headers={};securityHeaders({get:()=>''},{setHeader:(key,value)=>headers[key]=value},()=>{});
  assert.match(headers['Content-Security-Policy'],/object-src 'none'/);
  assert.match(headers['Content-Security-Policy'],/script-src 'self' https:\/\/www.gstatic.com 'sha256-/);
  assert.doesNotMatch(headers['Content-Security-Policy'].split(';').find(s=>s.includes('script-src')),/unsafe-inline|unsafe-eval/);
  assert.equal(headers['Strict-Transport-Security'],undefined);
});
test('HSTS é aplicado em HTTPS direto ou no proxy de produção',()=>{
  for(const req of [{secure:true},{get:()=> 'https'}]){
    const headers={};securityHeaders(req,{setHeader:(key,value)=>headers[key]=value},()=>{});
    assert.equal(headers['Strict-Transport-Security'],'max-age=31536000');
  }
});
