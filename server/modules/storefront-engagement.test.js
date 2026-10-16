const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recordVisit,saveReview,eligible,dayKey,router}=require('./storefront-engagement');
function database() {
    const values=new Map(); let queue=Promise.resolve();
    const snapshot=ref=>({exists:values.has(ref.path),data:()=>values.get(ref.path)});
    return {values,collection:name=>({doc:id=>({path:name+'/'+id,id})}),runTransaction:fn=>{
        const result=queue.then(async()=>{
            const writes=[];
            const value=await fn({get:async ref=>snapshot(ref),set:(ref,data)=>writes.push([ref.path,data]),create:(ref,data)=>{if(values.has(ref.path))throw Error('duplicate');writes.push([ref.path,data]);}});
            for(const [path,data] of writes) values.set(path,data);
            return value;
        }); queue=result.catch(()=>{}); return result;
    }};
}
const paidOrder=()=>({payment:{status:'paid',mode:'production'},logistics:{status:'delivered'},items:[{sku:'ABC',name:'Produto'}]});
test('visit retry and concurrent requests count one session; distinct sessions increment',async()=>{
    const db=database(), now=Date.UTC(2026,9,15,12);
    await Promise.all([recordVisit(db,'session-a',now),recordVisit(db,'session-a',now)]);
    await recordVisit(db,'session-b',now);
    assert.equal(db.values.get('storeVisitStats/total').visits,2);
    assert.equal(db.values.get('storeVisitStats/2026-10-15').visits,2);
    assert.equal([...db.values.keys()].some(key=>key.includes('session-a')),false);
});
test('visit days follow São Paulo and preserve total across days',async()=>{
    const db=database();
    const now=Date.UTC(2026,9,16,1);
    assert.equal(dayKey(now),'2026-10-15');
    await recordVisit(db,'first',now); await recordVisit(db,'second',now+86400000);
    assert.equal(db.values.get('storeVisitStats/total').visits,2);
    assert.equal(db.values.get('storeVisitStats/2026-10-16').visits,1);
});
test('only real paid delivered purchases are eligible',()=>{
    assert.equal(eligible(paidOrder()),true);
    for(const order of [null,{...paidOrder(),testMode:true},{...paidOrder(),payment:{status:'paid',mode:'test'}},{...paidOrder(),payment:{status:'refunded'}},{...paidOrder(),logistics:{status:'shipped'}},{...paidOrder(),status:'cancelled'}]) assert.equal(eligible(order),false);
});
test('review enforces product ownership and numeric star range without writes',async()=>{
    const db=database(), ref=db.collection('orders').doc('one'); db.values.set(ref.path,paidOrder());
    for(const [sku,stars,status] of [['ABC',0,400],['ABC',6,400],['ABC',1.5,400],['ABC','5',400],['OTHER',5,403]]) await assert.rejects(saveReview(db,ref,sku,stars),error=>error.status===status);
    assert.equal(db.values.size,1);
});
test('concurrent duplicate reviews do not inflate the average',async()=>{
    const db=database(), ref=db.collection('orders').doc('one'); db.values.set(ref.path,paidOrder());
    const result=await Promise.allSettled([saveReview(db,ref,'ABC',5),saveReview(db,ref,'ABC',1)]);
    assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(result.find(r=>r.status==='rejected').reason.status,409);
    const other=db.collection('orders').doc('two'); db.values.set(other.path,paidOrder());
    const summary=await saveReview(db,other,'ABC',3);
    assert.deepEqual(summary,{count:2,average:4});
});
test('order eligibility is rechecked inside the write transaction',async()=>{
    const db=database(),ref=db.collection('orders').doc('one');
    db.values.set(ref.path,{...paidOrder(),payment:{status:'refunded'}});
    await assert.rejects(saveReview(db,ref,'ABC',5),error=>error.status===403);
    assert.equal(db.values.size,1);
});
test('public write routes reject cross-origin traffic and invalid consent before storage',async()=>{
    const express=require('express'), app=express(); app.use(express.json()); app.use(router);
    const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
    try {
        const url='http://127.0.0.1:'+server.address().port;
        assert.equal((await fetch(url+'/visit',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'})).status,403);
        assert.equal((await fetch(url+'/visit',{method:'POST',headers:{Origin:'https://www.fiosperfeitos.com.br','Content-Type':'application/json'},body:JSON.stringify({session:'123',consent:false})})).status,400);
        assert.equal((await fetch(url+'/reviews',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'})).status,403);
        assert.equal((await fetch(url+'/review-products')).status,404);
        assert.equal((await fetch(url+'/reviews',{method:'POST',headers:{Origin:'https://www.fiosperfeitos.com.br','Content-Type':'application/json'},body:'{}'})).status,404);
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
