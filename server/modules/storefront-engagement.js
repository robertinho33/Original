'use strict';
const {createHash} = require('node:crypto');
const {getFirestore} = require('../infrastructure/firebase/firebase-admin');
const {createAdminReadCache,isQuotaError,quotaMessage}=require('../infrastructure/admin-read-cache');
const hash = value => createHash('sha256').update(value).digest('hex');
const origins = new Set(['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br']);
const attempts = new Map();
function guard(req, res, next) {
    if (req.method === 'POST' && !origins.has(req.headers.origin)) return res.sendStatus(403);
    const now = Date.now(), key = req.socket?.remoteAddress || 'unknown';
    for (const [ip, value] of attempts) if (value.until < now) attempts.delete(ip);
    if (!attempts.has(key) && attempts.size >= 5000) return res.sendStatus(429);
    const value = attempts.get(key) || {until:now+60000,count:0};
    attempts.set(key,value);
    if (++value.count > 300) return res.sendStatus(429);
    res.set('Cache-Control','no-store'); next();
}
function dayKey(now = Date.now()) {
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
}
async function recordVisit(db, session, now = Date.now()) {
    const day = dayKey(now), stats = db.collection('storeVisitStats');
    const sessionRef = db.collection('storeVisitSessions').doc(hash(session));
    const dailyRef = stats.doc(day), totalRef = stats.doc('total');
    return db.runTransaction(async tx => {
        const [seen, daily, total] = await Promise.all([tx.get(sessionRef),tx.get(dailyRef),tx.get(totalRef)]);
        if (seen.exists) return false;
        tx.set(sessionRef,{expiresAt:new Date(now+2*86400000)});
        tx.set(dailyRef,{visits:(daily.data()?.visits || 0)+1});
        tx.set(totalRef,{visits:(total.data()?.visits || 0)+1,startedAt:total.data()?.startedAt || new Date(now).toISOString()});
        return true;
    });
}
const visitStatsRead=createAdminReadCache(async()=>{
 const db=getFirestore(),stats=db.collection('storeVisitStats');
 const keys=Array.from({length:30},(_,i)=>dayKey(Date.now()-i*86400000));
 const docs=await db.getAll(stats.doc('total'),...keys.map(key=>stats.doc(key)));
 return {total:docs[0].data()?.visits||0,today:docs[1].data()?.visits||0,last30Days:docs.slice(1).reduce((sum,doc)=>sum+(doc.data()?.visits||0),0),startedAt:docs[0].data()?.startedAt||null};
},120000);
async function visitStats(req,res) {
    try {
        res.set('Cache-Control','no-store');
        res.json({success:true,data:await visitStatsRead.get()});
    } catch(error) { res.status(503).json({success:false,code:isQuotaError(error)?'DATABASE_QUOTA_EXCEEDED':'VISIT_STATS_UNAVAILABLE',error:isQuotaError(error)?quotaMessage:'Contador temporariamente indisponível.'}); }
}
function eligible(order) {
    return !!order && order.testMode !== true && order.payment?.mode !== 'test' && order.payment?.liveMode !== false &&
        ['paid','confirmed','approved'].includes(order.payment?.status) &&
        !['cancelled','canceled','refunded'].includes(order.status) &&
        (order.logistics?.status === 'delivered' || order.status === 'delivered');
}
async function findOrder(db, req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer /,'');
    if (!/^[a-f0-9]{64}$/i.test(token)) return null;
    const snapshot = await db.collection('orders').where('publicTrackingToken','==',token).limit(1).get();
    return snapshot.docs[0] || null;
}
function trackingAccess(req,res,next) {
    if (!/^Bearer [a-f0-9]{64}$/i.test(String(req.headers.authorization || ''))) return res.sendStatus(404);
    next();
}
async function saveReview(db, orderRef, sku, stars) {
    if (typeof sku !== 'string' || !sku || sku.length > 180 || !Number.isInteger(stars) || stars < 1 || stars > 5) throw Object.assign(Error('Nota inválida.'),{status:400});
    const productRef = db.collection('productRatings').doc(hash(sku));
    const reviewRef = db.collection('verifiedProductReviews').doc(hash(orderRef.id+'\0'+sku));
    return db.runTransaction(async tx => {
        const [orderDoc, review, summary] = await Promise.all([tx.get(orderRef),tx.get(reviewRef),tx.get(productRef)]);
        const order = orderDoc.data();
        if (!eligible(order) || !(order.items || []).some(item=>item.sku===sku)) throw Object.assign(Error('Avaliação disponível somente para produtos de pedidos pagos e entregues.'),{status:403});
        if (review.exists) throw Object.assign(Error('Você já avaliou este produto neste pedido.'),{status:409});
        const count = (summary.data()?.count || 0)+1, sum = (summary.data()?.sum || 0)+stars;
        tx.create(reviewRef,{orderId:orderRef.id,sku,stars,createdAt:new Date().toISOString()});
        tx.set(productRef,{sku,count,sum,average:sum/count});
        return {count,average:sum/count};
    });
}
const router = require('express').Router();
router.use(guard);
router.post('/visit',async(req,res)=>{
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(req.body?.session || '') || req.body?.consent !== true) return res.sendStatus(400);
    try { await recordVisit(getFirestore(),req.body.session); res.sendStatus(204); }
    catch { res.sendStatus(503); }
});
router.get('/ratings',async(req,res)=>{
    const skus = [...new Set(String(req.query.skus || '').split(',').filter(Boolean))];
    if (!skus.length || skus.length > 24 || skus.some(sku=>sku.length>180)) return res.sendStatus(400);
    try {
        const docs = await getFirestore().getAll(...skus.map(sku=>getFirestore().collection('productRatings').doc(hash(sku))));
        res.json({success:true,data:docs.map((doc,i)=>({sku:skus[i],count:doc.data()?.count || 0,average:doc.data()?.average || 0}))});
    } catch { res.sendStatus(503); }
});
router.get('/review-products',trackingAccess,async(req,res)=>{
    try {
        const db=getFirestore(), doc=await findOrder(db,req);
        if (!doc) return res.sendStatus(404);
        const order=doc.data();
        const items=eligible(order)?[...new Map((order.items || []).map(item=>[item.sku,{sku:item.sku,name:item.name || item.sku}])).values()]:[];
        const reviews=items.length?await db.getAll(...items.map(item=>db.collection('verifiedProductReviews').doc(hash(doc.id+'\0'+item.sku)))):[];
        res.json({success:true,data:items.filter((_,i)=>!reviews[i].exists)});
    } catch { res.sendStatus(503); }
});
router.post('/reviews',trackingAccess,async(req,res)=>{
    try {
        const db=getFirestore(), doc=await findOrder(db,req);
        if (!doc) return res.sendStatus(404);
        res.json({success:true,data:await saveReview(db,doc.ref,req.body?.sku,req.body?.stars)});
    } catch(error) { res.status(error.status || 503).json({success:false,error:error.status?error.message:'Não foi possível salvar sua avaliação.'}); }
});
module.exports={router,visitStats,recordVisit,saveReview,eligible,dayKey};
