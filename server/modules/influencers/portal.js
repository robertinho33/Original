'use strict';
const express = require('express');
const firebase = require('../../infrastructure/firebase/firebase-admin');
const credentials = require('./credentials');
const normalizePhone = credentials.phone;
const passwordValid = credentials.passwordValid;
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
function orderDay(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value);
  const date = new Date(value || 'invalid');
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '';
}
function projectDashboard(id, overview, ledger, logistics, range = {}) {
  const owned = overview.attributedOrders.filter(row => row.influencerId === id && !row.unlinked)
    .filter(row => (!range.from || orderDay(row.createdAt) >= range.from) &&
      (!range.to || orderDay(row.createdAt) <= range.to));
  const recorded = new Map(ledger.filter(row => row.influencerId === id).map(row => [row.orderDocumentId, row]));
  let commissionPaid = 0, commissionPending = 0, commissionEstimated = 0;
  const rows = owned.map(row => {
    const entry = recorded.get(row.orderDocumentId);
    const approved = row.paymentStatus === 'Pago';
    const status = approved && entry?.status === 'paid' ? 'paid' : approved && entry?.status === 'pending' ? 'pending' : approved ? 'estimated' : 'not_eligible';
    const amount = approved ? Number(entry && ['paid', 'pending'].includes(entry.status) ? entry.amount : row.commissionAmount) || 0 : 0;
    if (status === 'paid') commissionPaid += amount;
    if (status === 'pending') commissionPending += amount;
    if (status === 'estimated') commissionEstimated += amount;
    const shipping = logistics.get(row.orderDocumentId) || {};
    return { orderNumber: row.orderId, createdAt: row.createdAt, couponCode: row.couponCode,
      total: row.orderTotal, paymentStatus: row.paymentStatus, commission: amount,
      commissionRate: row.commissionRate, commissionStatus: status,
      logisticsStatus: String(shipping.status || 'pending'), carrier: String(shipping.carrier || ''),
      trackingCode: String(shipping.trackingCode || ''), postedAt: shipping.postedAt || null };
  });
  const money = n => Math.round(n * 100) / 100;
  return { summary: { sales: owned.length, paidSales: owned.filter(row => row.paymentStatus === 'Pago').length,
    revenue: money(owned.filter(row => row.paymentStatus === 'Pago').reduce((n, row) => n + (Number(row.orderTotal) || 0), 0)),
    commissionPaid: money(commissionPaid), commissionPending: money(commissionPending), commissionEstimated: money(commissionEstimated) },
    orders: rows.slice(0, 200), truncated: rows.length > 200,
    note: 'Estimativas seguem as regras de contrato e cupom, sem frete. Comissões conciliadas e repasses são identificados separadamente.' };
}
function createRouter(deps = {}) {
  const router = express.Router();
  const getDb = deps.getDb || firebase.getFirestore;
  const getOverview = deps.getOverview || (() => require('../admin/services/partnership-service').getOverview());
  const attempts = new Map();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex, nofollow');
    const now = Date.now(), key = req.ip || 'unknown';
    if (attempts.size > 5000) for (const [id, entry] of attempts) if (entry.until < now) attempts.delete(id);
    const entry = attempts.get(key) || { count: 0, until: now + 60000 };
    if (entry.until < now) { entry.count = 0; entry.until = now + 60000; }
    entry.count++; attempts.set(key, entry);
    if (entry.count > 40) return res.status(429).json({ success: false, error: 'Aguarde um minuto para consultar novamente.' });
    next();
  });
  const loginAttempts = new Map();
  router.post('/login', async (req, res) => {
    try {
      const origin = req.get('origin');
      if (origin && !['https://www.fiosperfeitos.com.br', 'https://fiosperfeitos.com.br', 'http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin)) return res.sendStatus(403);
      const db = getDb(), email = credentials.email(req.body?.email), phone = normalizePhone(req.body?.phone);
      const key = credentials.hash((req.ip || '') + ':' + email), now = Date.now();
      if (loginAttempts.size > 5000) for (const [id, value] of loginAttempts) if (value.until < now) loginAttempts.delete(id);
      const entry = loginAttempts.get(key);
      if (entry && entry.until > now && entry.count >= 8) return res.status(429).json({ success: false, error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
      loginAttempts.set(key, { count: entry?.until > now ? entry.count + 1 : 1, until: entry?.until > now ? entry.until : now + 15 * 60000 });
      const lookup = await db.collection('influencerPortalEmails').doc(credentials.hash(email)).get();
      const id = lookup.exists ? lookup.data().influencerId : null;
      const accessDoc = id ? await db.collection('influencerPortalAccess').doc(id).get() : null;
      const access = accessDoc?.exists ? accessDoc.data() : null;
      const correct = await credentials.passwordMatches(req.body?.password, access);
      const personDoc = id ? await db.collection('influencers').doc(id).get() : null;
      const person = personDoc?.exists ? personDoc.data() : null;
      if (!correct || (access?.mustChangePassword && (!Number.isSafeInteger(access.temporaryExpiresAt)||access.temporaryExpiresAt<=now)) || !access?.enabled || access.email !== email || access.phone !== phone || !person || person.active === false || person.portalEnabled !== true || credentials.email(person.email) !== email || normalizePhone(person.phone) !== phone) return res.status(401).json({ success: false, error: 'Acesso não autorizado. Confira seus dados ou solicite a liberação à loja.' });
      const token = credentials.randomBytes(32).toString('hex');
      await db.collection('influencerPortalSessions').doc(credentials.hash(token)).set({ influencerId: id, version: access.version, expiresAt: now + 8 * 3600000 });
      res.cookie(credentials.cookieName, token, { ...credentials.cookieOptions, maxAge: 8 * 3600000 });
      res.json({ success: true });
    } catch { res.status(503).json({ success: false, error: 'Não foi possível acessar o portal agora. Tente novamente em instantes.' }); }
  });
  router.post('/logout', async (req, res) => {
    const token = credentials.token(req);
    try { if (token) await getDb().collection('influencerPortalSessions').doc(credentials.hash(token)).delete(); } catch {}
    res.clearCookie(credentials.cookieName, credentials.cookieOptions); res.json({ success: true });
  });
  router.post('/password', async (req,res)=>{
    try {
      if(!['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br','http://localhost:3000','http://127.0.0.1:3000'].includes(req.get('origin')))return res.status(403).json({success:false,error:'Origem não autorizada.'});
      const db=getDb(),user=await credentials.identity(db,req);
      if(!user)return res.status(401).json({success:false,error:'Entre novamente para alterar sua senha.'});
      const {currentPassword,newPassword}=req.body||{};
      if(!passwordValid(newPassword)||newPassword===currentPassword)return res.status(400).json({success:false,error:'Escolha uma nova senha de 8 a 16 caracteres com letras e números.'});
      const ref=db.collection('influencerPortalAccess').doc(user.id),snapshot=await ref.get(),access=snapshot.data();
      if(!await credentials.passwordMatches(currentPassword,access))return res.status(400).json({success:false,error:'A senha atual não confere.'});
      const secret=await credentials.passwordRecord(newPassword);
      const changed=await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);
        if(!fresh.exists||!fresh.data().enabled||fresh.data().version!==access.version)return false;
        tx.update(ref,{...secret,mustChangePassword:false,temporaryExpiresAt:null,version:credentials.randomBytes(16).toString('hex'),updatedAt:new Date().toISOString(),updatedBy:'influencer:'+user.id});return true;
      });
      if(!changed)return res.status(409).json({success:false,error:'Seu acesso mudou. Entre novamente e tente outra vez.'});
      res.clearCookie(credentials.cookieName,credentials.cookieOptions);res.json({success:true});
    }catch{res.status(503).json({success:false,error:'Não foi possível alterar sua senha agora.'});}
  });
  router.post('/session',async(req,res)=>{
    try{const user=await credentials.identity(getDb(),req);if(!user)return res.status(401).json({success:false,error:'Entre com seu e-mail, telefone e senha. Se o convite expirou, solicite um novo à loja.'});res.json({success:true,data:{profile:{name:user.name,email:user.email},mustChangePassword:user.mustChangePassword}});}
    catch{res.status(503).json({success:false,error:'Não foi possível conferir seu acesso.'});}
  });
  router.use(async(req,res,next)=>{
    try{const user=await credentials.identity(getDb(),req);if(user?.mustChangePassword)return res.status(403).json({success:false,code:'PASSWORD_CHANGE_REQUIRED',error:'Crie sua senha pessoal antes de continuar.'});next();}
    catch{res.status(503).json({success:false,error:'Não foi possível conferir seu acesso.'});}
  });
  router.use('/community',require('./community-routes').createOwnerRouter({getDb,getCatalog:deps.getStoreCatalog}));
  const profileHandlers=require('./portal-profile').createHandlers({getDb});
  router.post('/profile',profileHandlers.read);router.put('/profile',profileHandlers.write);
  const storeHandlers=require('./portal-store').createHandlers({getDb,getCatalog:deps.getStoreCatalog});
  router.post('/store',storeHandlers.read);
  router.put('/store',storeHandlers.write);
  router.post('/dashboard', async (req, res) => {
    let identity;
    try { identity = await credentials.identity(getDb(), req); } catch {}
    if (!identity) return res.status(401).json({ success: false, error: 'Acesso não autorizado. Entre novamente para consultar suas vendas.' });
    try {
      const range = { from: req.body?.from || '', to: req.body?.to || '' };
      for (const day of Object.values(range)) if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day)) return res.status(400).json({ success: false, error: 'Período inválido.' });
      if (range.from && range.to && range.from > range.to) return res.status(400).json({ success: false, error: 'Confira o período informado.' });
      const [overview, commissions] = await Promise.all([getOverview(), getDb().collection('influencerCommissions').where('influencerId', '==', identity.id).get()]);
      const owned = overview.attributedOrders.filter(row => row.influencerId === identity.id && !row.unlinked)
        .filter(row => (!range.from || orderDay(row.createdAt) >= range.from) && (!range.to || orderDay(row.createdAt) <= range.to)).slice(0, 200);
      const logistics = new Map();
      await Promise.all(owned.map(async row => {
        const snapshot = await getDb().collection('orders').doc(row.orderDocumentId).get();
        if (!snapshot.exists) return;
        const order = snapshot.data(), shipping = order.logistics || {};
        logistics.set(row.orderDocumentId, { status: shipping.status || order.logisticsStatus || 'pending',
          carrier: shipping.carrier || order.carrier || '', trackingCode: shipping.trackingCode || order.trackingCode || '',
          postedAt: shipping.postedAt || order.postedAt || null });
      }));
      const data = projectDashboard(identity.id, overview, commissions.docs.map(doc => doc.data()), logistics, range);
      const features = require('./promotions');
      const campaignSnapshot = await getDb().collection('influencerPortalCampaigns').doc('current').get();
      const publicStore = await getDb().collection('influencerPublicStores').doc(identity.id).get();
      data.storeUrl = publicStore.exists && publicStore.data().enabled ? '/pages/vitrine-influenciador.html?loja=' + encodeURIComponent(identity.id) : '';
      data.campaign = features.activeCampaign(campaignSnapshot.exists ? campaignSnapshot.data() : null);
      data.bestSellers = features.rankProducts(overview.attributedOrders.filter(row => row.influencerId === identity.id && !row.unlinked && row.paymentStatus === 'Pago' && (!range.from || orderDay(row.createdAt) >= range.from) && (!range.to || orderDay(row.createdAt) <= range.to)));
      res.json({ success: true, data: { profile: { name: identity.name, email: identity.email }, ...data, features:await require('./feature-access').getAccess(getDb(),identity.id) } });
    } catch { res.status(503).json({ success: false, error: 'Não foi possível consultar suas vendas agora. Tente novamente em instantes.' }); }
  });
  return router;
}
function createAccessHandler(deps = {}) {
  const getDb = deps.getDb || firebase.getFirestore;
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.admin || req.admin.role !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores podem liberar acessos.' });
    try {
      const data = await credentials.provision(getDb(), String(req.params.id || ''), req.body || {}, req.admin.uid || req.admin.email || 'admin');
      res.json({ success: true, data });
    } catch (error) { res.status(400).json({ success: false, error: error.message || 'Não foi possível alterar o acesso.' }); }
  };
}
module.exports = { createRouter, createAccessHandler, normalizePhone, passwordValid, projectDashboard };
