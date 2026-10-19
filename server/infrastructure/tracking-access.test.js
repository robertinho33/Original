const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../js/orders/order-repository.js'),'utf8');
const implementation=source.slice(source.indexOf('export async function findTrackingById('),source.indexOf('export async function findTrackingByToken')).replace('export ','');
test('number query recovers a historical session and preserves private access',async()=>{
const local=new Map(),session=new Map(),token='a'.repeat(64);let requested;
const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)});
const context={localStorage:storage(local),sessionStorage:storage(session),findTrackingByToken:async value=>{requested=value;return value||null}};
vm.createContext(context);vm.runInContext(implementation+';globalThis.lookup=findTrackingById;',context);
session.set('nefer-mp-pending-order',JSON.stringify({orderNumber:'AUR-ABC123',trackingToken:token}));
assert.equal(await context.lookup(' aur-abc123 '),token);
assert.equal(local.get('nefer-tracking-AUR-ABC123'),token);
assert.equal(await context.lookup('AUR-OTHER'),null);assert.equal(requested,'');
session.clear();assert.equal(await context.lookup('AUR-ABC123'),token);
});
