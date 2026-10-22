const test=require('node:test'),assert=require('node:assert/strict');
const {createCachedRead}=require('./cached-read');
test('public read cache deduplicates, expires and never retains failed reads',async()=>{
 let time=0,calls=0,fail=false;
 const cache=createCachedRead(async()=>{calls++;if(fail)throw Error('offline');return calls;},30,()=>time);
 assert.deepEqual(await Promise.all([cache.get(),cache.get()]),[1,1]);assert.equal(calls,1);
 time=29;assert.equal(await cache.get(),1);time=31;fail=true;
 await assert.rejects(cache.get(),/offline/);fail=false;assert.equal(await cache.get(),3);
 cache.invalidate();assert.equal(await cache.get(),4);
});
test('invalidation during a pending read cannot repopulate an obsolete snapshot',async()=>{
 let finish,calls=0;
 const cache=createCachedRead(()=>++calls===1?new Promise(r=>finish=r):Promise.resolve('new'),30);
 const old=cache.get();await Promise.resolve();cache.invalidate();
 assert.equal(await cache.get(),'new');finish('old');assert.equal(await old,'old');assert.equal(await cache.get(),'new');
});
