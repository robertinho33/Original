'use strict';
const {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual}=require('node:crypto');
const {AppError}=require('../../core/app-error');
const CALLBACK='https://www.fiosperfeitos.com.br/api/shipping/melhor-envio/callback';
const COOKIE='__Host-fp_me_oauth';
const SCOPE='shipping-calculate';
const digest=value=>createHash('sha256').update(value).digest('hex');
function configuration(env=process.env) {
    const config={clientId:String(env.MELHOR_ENVIO_CLIENT_ID || ''),clientSecret:String(env.MELHOR_ENVIO_CLIENT_SECRET || ''),key:String(env.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY || ''),userAgent:String(env.MELHOR_ENVIO_USER_AGENT || ''),redirect:CALLBACK};
    if(!/^\d+$/.test(config.clientId)||!config.clientSecret||/[\r\n]/.test(config.clientSecret)||! /^[a-f0-9]{64}$/i.test(config.key)||!config.userAgent.includes('@')||/[\r\n]/.test(config.userAgent)) throw new AppError('A conexão do aplicativo de frete ainda não foi configurada.',{status:503,code:'SHIPPING_NOT_CONFIGURED'});
    return config;
}
function seal(value,key) {
    const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
    const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
}
function unseal(value,key) {
    const [iv,tag,data]=String(value).split('.');
    const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(iv,'base64url'));
    cipher.setAuthTag(Buffer.from(tag,'base64url'));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data,'base64url')),cipher.final()]).toString('utf8'));
}
function validState(state,cookie) {
    return typeof state==='string'&&typeof cookie==='string'&&/^[a-f0-9]{64}$/.test(state)&&/^[a-f0-9]{64}$/.test(cookie)&&timingSafeEqual(Buffer.from(state),Buffer.from(cookie));
}
function cookieValue(req) {
    return String(req.headers.cookie || '').split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || '';
}
function service(dependencies={}) {
    const env=dependencies.env || process.env, config=configuration(env);
    const db=dependencies.db || require('../../infrastructure/firebase/firebase-admin').getFirestore();
    const now=dependencies.now || Date.now, request=dependencies.fetch || fetch;
    const credentials=db.collection('shippingPrivateCredentials').doc('melhor_envio');
    async function exchange(body) {
        let response,data;
        try {
            response=await request('https://www.melhorenvio.com.br/oauth/token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':config.userAgent},body:JSON.stringify({...body,client_id:config.clientId,client_secret:config.clientSecret}),signal:AbortSignal.timeout(12000),redirect:'error'});
            if(!response.ok) throw Error();
            data=await response.json();
            if(typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=120||Number(data.expires_in)>90*86400||String(data.token_type).toLowerCase()!=='bearer') throw Error();
            if(data.scope && String(data.scope).trim()!==SCOPE) throw Error();
            const claims=JSON.parse(Buffer.from(data.access_token.split('.')[1],'base64url').toString('utf8'));
            if(!Array.isArray(claims.scopes)||claims.scopes.length!==1||claims.scopes[0]!==SCOPE) throw Error();
        } catch {throw new AppError('Não foi possível autorizar ou renovar o acesso de frete. Reconecte a conta no painel.',{status:503,code:'SHIPPING_OAUTH_FAILED'});}
        return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:now()+Number(data.expires_in)*1000};
    }
    return {
        async start(uid) {
            const state=randomBytes(32).toString('hex');
            await db.collection('shippingOAuthStates').doc(digest(state)).create({uid,expiresAt:new Date(now()+600000),used:false});
            const url=new URL('https://www.melhorenvio.com.br/oauth/authorize');
            url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirect,response_type:'code',state,scope:SCOPE}).toString();
            return {url:url.href,state};
        },
        async complete({state,cookie,code,denied}) {
            if(!validState(state,cookie)) throw new AppError('A autorização expirou ou pertence a outro navegador. Inicie novamente pelo painel.',{status:400});
            const ref=db.collection('shippingOAuthStates').doc(digest(state));
            await db.runTransaction(async tx=>{
                const saved=await tx.get(ref), record=saved.data();
                const expiry=record?.expiresAt?.toMillis?record.expiresAt.toMillis():new Date(record?.expiresAt).getTime();
                if(!saved.exists||record.used||!Number.isFinite(expiry)||expiry<=now()) throw new AppError('Autorização inválida ou já utilizada.',{status:400});
                tx.update(ref,{used:true});
            });
            if(denied) throw new AppError('A conexão não foi autorizada. Você pode tentar novamente pelo painel.',{status:400});
            if(typeof code!=='string'||!code||code.length>4096) throw new AppError('Código de autorização inválido.',{status:400});
            const token=await exchange({grant_type:'authorization_code',redirect_uri:config.redirect,code});
            await credentials.set({sealed:seal(token,config.key),expiresAt:token.expiresAt,generation:randomBytes(16).toString('hex'),clientId:config.clientId,connectedAt:new Date(now()).toISOString()});
        },
        async status() {
            const doc=await credentials.get(), record=doc.data();
            return {configured:true,connected:doc.exists&&record.clientId===config.clientId,connectedAt:record?.connectedAt || null};
        },
        async accessToken() {
            let record=(await credentials.get()).data();
            if(!record||record.clientId!==config.clientId) throw new AppError('Conecte a conta do Melhor Envio no painel administrativo.',{status:503,code:'SHIPPING_OAUTH_DISCONNECTED'});
            let token;
            try {token=unseal(record.sealed,config.key);}catch{throw new AppError('Reconecte a conta de frete no painel.',{status:503,code:'SHIPPING_OAUTH_FAILED'});}
            if(token.expiresAt>now()+120000) return token.accessToken;
            const lease=randomBytes(16).toString('hex');
            await db.runTransaction(async tx=>{
                const latest=(await tx.get(credentials)).data();
                if(!latest||latest.generation!==record.generation||latest.leaseUntil>now()) throw new AppError('A conexão de frete está sendo atualizada. Tente novamente.',{status:503,code:'SHIPPING_OAUTH_BUSY'});
                tx.update(credentials,{lease,leaseUntil:now()+30000});
            });
            try {
                const renewed=await exchange({grant_type:'refresh_token',refresh_token:token.refreshToken});
                await db.runTransaction(async tx=>{
                    const latest=(await tx.get(credentials)).data();
                    if(latest?.lease!==lease||latest.generation!==record.generation) throw new AppError('A conta de frete foi alterada. Tente novamente.',{status:503,code:'SHIPPING_OAUTH_BUSY'});
                    tx.update(credentials,{sealed:seal(renewed,config.key),expiresAt:renewed.expiresAt,generation:randomBytes(16).toString('hex'),lease:'',leaseUntil:0});
                });
                return renewed.accessToken;
            } catch(error) {
                await db.runTransaction(async tx=>{const latest=(await tx.get(credentials)).data();if(latest?.lease===lease)tx.update(credentials,{lease:'',leaseUntil:0});}).catch(()=>{});
                throw error;
            }
        }
    };
}
async function start(req,res) {
    if(!req.admin?.isMaster) return res.sendStatus(403);
    if(req.headers.origin!=='https://www.fiosperfeitos.com.br') return res.sendStatus(403);
    res.set('Cache-Control','no-store');
    try {
        const result=await service().start(req.admin.uid);
        res.cookie(COOKIE,result.state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600000});
        res.json({success:true,data:{url:result.url}});
    } catch {res.status(503).json({success:false,error:'Configure o aplicativo de frete no servidor antes de conectar.'});}
}
async function status(req,res) {
    if(!req.admin?.isMaster) return res.sendStatus(403);
    res.set('Cache-Control','no-store');
    try {res.json({success:true,data:await service().status()});}
    catch {res.json({success:true,data:{configured:false,connected:false}});}
}
async function callback(req,res) {
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});
    let success=false;
    try {await service().complete({state:req.query.state,cookie:cookieValue(req),code:req.query.code,denied:Boolean(req.query.error)});success=true;}catch{}
    res.clearCookie(COOKIE,{httpOnly:true,secure:true,sameSite:'lax',path:'/'});
    // Remove code and state from address bar; do not reflect any provider response in HTML.
    res.redirect(303,'/pages/conexao-frete.html?status='+(success?'connected':'failed'));
}
module.exports={configuration,service,seal,unseal,validState,start,status,callback,CALLBACK};
