const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('private links carry the tracking token across tabs and devices without browser storage',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../js/orders/tracking-link.js'),'utf8');const {privateTrackingUrl}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const token='a'.repeat(64),link=privateTrackingUrl({orderNumber:'ORDER-1',publicTrackingToken:token},'https://www.fiosperfeitos.com.br');const url=new URL(link);assert.equal(url.hash,'#token='+token);assert.equal(url.search,'');assert.equal(url.pathname,'/pages/rastrear-pedido.html');
 assert.equal(privateTrackingUrl({orderNumber:'ORDER-1'},url.origin),'');assert.equal(privateTrackingUrl({publicTrackingToken:'invalid'},url.origin),'');assert.equal(privateTrackingUrl({trackingToken:token},'javascript:alert(1)'),'');
 const admin=fs.readFileSync(path.join(__dirname,'../../js/admin/admin.js'),'utf8');assert.ok(admin.includes('privateTrackingUrl(order, window.location.origin)'));assert.ok(!admin.includes('rastrear-pedido.html?pedido='));
});
