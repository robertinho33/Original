'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {purchaseMeasurement}=require('../modules/orders/ads-conversion');
const read=name=>fs.readFileSync(path.join(__dirname,'../../js/analytics/',name+'.js'),'utf8');
const load=name=>import('data:text/javascript;base64,'+Buffer.from(read(name)).toString('base64'));
const policy=load('ads-policy'),consentPolicy=load('analytics-policy');
const now=Date.now();
const order=()=>({status:'confirmed',totals:{total:123.45},payment:{provider:'infinitepay',mode:'production',status:'paid',paymentId:'tx',confirmedAt:new Date(now).toISOString()}});
test('Ads purchase uses only authoritative, recent, paid production data and pseudonymous ID',()=>{
 const value=purchaseMeasurement('order-document',order(),now);
 assert.deepEqual(Object.keys(value),['transaction_id','value','currency']);assert.match(value.transaction_id,/^[a-f0-9]{64}$/);assert.equal(value.value,123.45);assert.equal(value.currency,'BRL');
 assert.deepEqual(purchaseMeasurement('order-document',order(),now),value);
 const invalid=[{status:'refunded'},{isTest:true},{totals:{total:0}},{totals:{total:'123'}},
  ...[{status:'pending'},{status:'refunded'},{mode:'sandbox'},{provider:'manual'},{reviewRequired:true},{paymentId:''},{confirmedAt:'invalid'},
   {confirmedAt:new Date(now+1000).toISOString()},{confirmedAt:new Date(now-31*86400000).toISOString()}].map(change=>({payment:{...order().payment,...change}}))];
 for(const change of invalid)assert.equal(purchaseMeasurement('id',{...order(),...change},now),null);
});
test('Ads page policy excludes admin, local, payment URLs; safe payload strips private fields',async()=>{
 const {adsContext,safePurchase}=await policy;
 for(const url of ['http://localhost:3000/','https://www.fiosperfeitos.com.br/admin.html','https://www.fiosperfeitos.com.br/?token=private','https://www.fiosperfeitos.com.br/pages/checkout.html?payment_id=1'])assert.equal(adsContext(url),null);
 assert.deepEqual(adsContext('https://www.fiosperfeitos.com.br/pages/rastrear-pedido.html#token=private'),{tracking:true});
 assert.deepEqual(adsContext('https://www.fiosperfeitos.com.br/produto/SKU?gclid=click_1&email=secret'),{tracking:false,gclid:'click_1'});
 const purchase=purchaseMeasurement('id',order(),now);
 assert.deepEqual(safePurchase({...purchase,email:'secret',token:'private'}),purchase);
 assert.equal(safePurchase({...purchase,transaction_id:'customer@email.test'}),null);
});
async function browser(href,choice=null,source='ads-measurement'){
 const p=await policy,c=await consentPolicy,values=new Map(),listeners={},nodes=[];
 if(choice)values.set(p.ADS_CONSENT_KEY,JSON.stringify({value:choice,savedAt:Date.now()}));
 const element=tag=>({tag,children:[],messages:[],contentWindow:{postMessage(message,origin){nodes.messages.push({message,origin});}},append(...items){this.children.push(...items);},addEventListener(){},setAttribute(){},remove(){this.removed=true;},querySelector(){return {focus(){}};},focus(){}});
 nodes.messages=[];
 const document={cookie:'',createElement:element,body:{append(node){nodes.push(node);}},head:{append(node){nodes.push(node);}},querySelector:()=>null};
 const window={addEventListener:(name,fn)=>listeners[name]=fn};
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const sandbox={...p,...c,location:new URL(href),navigator:{},document,window,localStorage:storage,URL,Date,console};
 sandbox.window.parent=source==='ads-frame'?{postMessage:(message,origin)=>nodes.messages.push({message,origin})}:window;
 const code=read(source).replace(/^import .*;/gm,'').replace(/export /g,'');
 vm.createContext(sandbox);vm.runInContext(code,sandbox);
 return {sandbox,listeners,nodes,values,document,window,p};
}
test('No Ads tag loads before separate consent, on blocked browsers, or on admin pages',async()=>{
 for(const choice of [null,'denied']){const b=await browser('https://www.fiosperfeitos.com.br/',choice);assert.equal(b.nodes.length,0);}
 const b=await browser('https://www.fiosperfeitos.com.br/admin.html','granted');assert.equal(b.nodes.length,0);
 const privatePage=await browser('https://www.fiosperfeitos.com.br/pages/rastrear-pedido.html#token=secret','granted');assert.ok(!privatePage.nodes.some(n=>n.tag==='iframe'));
});
test('Granted measurement uses clean no-referrer frame, validates sender, deduplicates and revokes',async()=>{
 const b=await browser('https://www.fiosperfeitos.com.br/?gclid=click_1&email=private','granted');
 const frame=b.nodes[0];assert.equal(frame.referrerPolicy,'no-referrer');assert.equal(frame.src,'/pages/ads-measurement.html?gclid=click_1');
 const purchase=purchaseMeasurement('id',order(),now);b.sandbox.measurePurchase({...purchase,token:'secret'});
 b.listeners.message({origin:b.sandbox.location.origin,source:{},data:{type:'fp-ads-ready'}});assert.equal(b.nodes.messages.length,0);
 const message=data=>b.listeners.message({origin:b.sandbox.location.origin,source:frame.contentWindow,data});
 message({type:'fp-ads-ready'});assert.equal(b.nodes.messages.length,1);assert.ok(!JSON.stringify(b.nodes.messages).includes('secret'));
 message({type:'fp-ads-queued',id:purchase.transaction_id});b.sandbox.measurePurchase(purchase);assert.equal(b.nodes.messages.length,1);
 b.sandbox.chooseAds('denied');assert.ok(frame.removed);
 b.sandbox.navigator.globalPrivacyControl=true;b.sandbox.chooseAds('granted');assert.equal(b.nodes.length,1);
});
test('Private page only opens measurement frame for server-provided eligible purchase',async()=>{
 const b=await browser('https://www.fiosperfeitos.com.br/pages/rastrear-pedido.html#token=secret','granted');
 b.sandbox.measurePurchase(null);assert.equal(b.nodes.filter(n=>n.tag==='iframe').length,0);
 b.sandbox.measurePurchase(purchaseMeasurement('id',order(),now));const frame=b.nodes.find(n=>n.tag==='iframe');assert.equal(frame.src,'/pages/ads-measurement.html');assert.equal(frame.referrerPolicy,'no-referrer');
});
test('Isolated tag emits exact conversion destination, real value, no token and no personalization',async()=>{
 const b=await browser('https://www.fiosperfeitos.com.br/pages/ads-measurement.html?gclid=click_1','granted','ads-frame');
 assert.equal(b.nodes.length,1);assert.match(b.nodes[0].src,/AW-18532019425$/);
 const purchase=purchaseMeasurement('id',order(),now);
 const event={origin:b.sandbox.location.origin,source:b.window.parent,data:{type:'fp-ads-purchase',purchase:{...purchase,email:'secret'}}};
 b.listeners.message({...event,source:{}});b.listeners.message(event);b.listeners.message(event);
 const commands=b.window.dataLayer.map(v=>Array.from(v)),conversions=commands.filter(v=>v[0]==='event');
 assert.equal(conversions.length,1);assert.equal(conversions[0][2].send_to,'AW-18532019425/sM8dCPLXraYdEOHZ4IRF');assert.equal(conversions[0][2].value,123.45);
 assert.equal(conversions[0][2].page_location,b.sandbox.location.origin+'/');assert.ok(!JSON.stringify(commands).includes('secret'));assert.equal(conversions[0][2].allow_ad_personalization_signals,false);
});

test('Ads vendor script permissions remain isolated from checkout and admin',()=>{
 const {securityHeaders}=require('./security');
 const headers=pathname=>{const h={};securityHeaders({path:pathname,get:()=>''},{setHeader:(k,v)=>h[k]=v},()=>{});return h;};
 assert.match(headers('/pages/ads-measurement.html')['Content-Security-Policy'],/script-src 'self' https:\/\/www.googleadservices.com/);
 for(const pathname of ['/pages/checkout.html','/admin.html'])assert.ok(!headers(pathname)['Content-Security-Policy'].includes('googleadservices'));
});
