'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../../js/analytics',name+'.js'),'utf8');
const load=name=>import('data:text/javascript;base64,'+Buffer.from(read(name)).toString('base64'));
async function browser({href='https://www.fiosperfeitos.com.br/',consent=null,source='meta-measurement',navigator={}}={}){
 const policy=await load('meta-policy'),privacy=await load('analytics-policy'),values=new Map(),nodes=[],listeners={},cookies=[];
 if(consent)values.set(policy.META_CONSENT_KEY,JSON.stringify({value:consent,savedAt:Date.now()}));
 const document={title:'',head:{append:node=>nodes.push(node)},body:{append:node=>nodes.push(node)},createElement:tag=>({tag,dataset:{},children:[],contentWindow:{postMessage:message=>nodes.messages.push(message)},append(...children){this.children.push(...children);},remove(){this.removed=true;}})};
 nodes.messages=[];Object.defineProperty(document,'cookie',{get:()=> '_fbp=test; _fbc=click; other=keep',set:value=>cookies.push(value)});
 const window={addEventListener:(event,fn)=>listeners[event]=fn};
 const context={...policy,...privacy,document,window,location:new URL(source==='meta-frame'?'https://www.fiosperfeitos.com.br/pages/meta-measurement.html':href),navigator,URL,Date,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},console};
 window.location=context.location;window.parent=source==='meta-frame'?{location:new URL(href)}:window;
 context.history={replaceState:(_state,_title,url)=>{context.location=new URL(url);window.location=context.location;}};
 vm.createContext(context);vm.runInContext(read(source).replace(/^import .*;/gm,'').replace(/export /g,''),context);
 return {context,window,document,nodes,values,cookies,listeners,policy};
}
test('Meta pixel ID and public page policy exclude private portals, checkout and private URLs',async()=>{
 const {META_PIXEL_ID,metaContext}=await load('meta-policy');assert.equal(META_PIXEL_ID,'1139965348583728');
 for(const value of ['http://localhost:3000/','https://www.fiosperfeitos.com.br/pages/checkout.html','https://www.fiosperfeitos.com.br/pages/influenciadores.html','https://www.fiosperfeitos.com.br/pages/rastrear-pedido.html#token=secret','https://www.fiosperfeitos.com.br/?email=private@example.test','https://www.fiosperfeitos.com.br/#token=secret'])assert.equal(metaContext(value),null,value);
 assert.deepEqual(metaContext('https://www.fiosperfeitos.com.br/produto/SKU?fbclid=click_123&cupom=ROB'),{path:'/produto/SKU',fbclid:'click_123'});
});
test('no Meta script or iframe loads before separate permission or on privacy-blocked browsers',async()=>{
 for(const consent of [null,'denied'])assert.equal((await browser({consent})).nodes.length,0);
 for(const navigator of [{globalPrivacyControl:true},{doNotTrack:'1'}])assert.equal((await browser({consent:'granted',navigator})).nodes.length,0);
 assert.equal((await browser({consent:'granted',href:'https://www.fiosperfeitos.com.br/pages/admin.html'})).nodes.length,0);
});
test('grant starts one clean frame; revoke removes it and Meta cookies; another tab is respected',async()=>{
 const b=await browser();b.context.chooseMeta('granted');b.context.chooseMeta('granted');assert.equal(b.nodes.length,1);
 assert.equal(b.nodes[0].src,'/pages/meta-measurement.html?v=20261104');assert.equal(b.nodes[0].referrerPolicy,'no-referrer');
 b.context.chooseMeta('denied');assert.equal(b.nodes[0].removed,true);assert.equal(b.nodes.messages[0].type,'fp-meta-revoke');
 assert.ok(b.cookies.some(value=>value.startsWith('_fbp=;')));assert.ok(b.cookies.some(value=>value.startsWith('_fbc=;')));assert.ok(!b.cookies.some(value=>value.startsWith('other=')));
 b.values.set(b.policy.META_CONSENT_KEY,JSON.stringify({value:'granted',savedAt:Date.now()}));b.listeners.storage({key:b.policy.META_CONSENT_KEY});assert.equal(b.nodes.length,2);
 b.values.delete(b.policy.META_CONSENT_KEY);b.listeners.storage({key:null});assert.equal(b.nodes[1].removed,true);
});
test('official SDK receives exact pixel ID, one PageView and no coupon, private fields or automatic form matching',async()=>{
 const b=await browser({source:'meta-frame',consent:'granted',href:'https://www.fiosperfeitos.com.br/produto/SHAMPOO?cupom=ROB&fbclid=click_123&utm_source=instagram'});
 assert.equal(b.nodes.length,1);assert.equal(b.nodes[0].src,'https://connect.facebook.net/en_US/fbevents.js');
 assert.equal(b.context.location.href,'https://www.fiosperfeitos.com.br/produto/SHAMPOO?fbclid=click_123');
 b.nodes[0].onload();const commands=Array.from(b.window.fbq.queue,row=>Array.from(row));
 assert.deepEqual(commands.find(row=>row[0]==='init'),['init','1139965348583728']);
 assert.deepEqual(commands.find(row=>row[0]==='set'),['set','autoConfig',false,'1139965348583728']);
 assert.deepEqual(commands.filter(row=>row[0]==='track'),[['track','PageView']]);
 assert.ok(!JSON.stringify(commands).includes('ROB'));assert.ok(!JSON.stringify(commands).includes('utm_source'));
});
test('revoking while SDK downloads prevents initialization and events; private parents never load it',async()=>{
 const b=await browser({source:'meta-frame',consent:'granted'});b.values.set(b.policy.META_CONSENT_KEY,JSON.stringify({value:'denied',savedAt:Date.now()}));b.nodes[0].onload();assert.equal(b.window.fbq.queue.length,1);assert.equal(b.window.fbq.queue[0][1],'revoke');
 const privatePage=await browser({source:'meta-frame',consent:'granted',href:'https://www.fiosperfeitos.com.br/pages/rastrear-pedido.html#token=secret'});assert.equal(privatePage.nodes.length,0);
});
test('Meta script permissions are restricted to the clean measurement document',()=>{
 const {securityHeaders}=require('./security');
 const headers=pathname=>{const result={};securityHeaders({path:pathname,get:()=>''},{setHeader:(key,value)=>result[key]=value},()=>{});return result;};
 assert.match(headers('/pages/meta-measurement.html')['Content-Security-Policy'],/script-src 'self' https:\/\/connect.facebook.net/);
 for(const page of ['/index.html','/pages/checkout.html','/pages/admin.html','/pages/ads-measurement.html'])assert.ok(!headers(page)['Content-Security-Policy'].includes('connect.facebook.net'));
});
