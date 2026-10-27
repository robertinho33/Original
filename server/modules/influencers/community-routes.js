'use strict';
const express=require('express');
const {createService,CommunityError}=require('./community-service');
const firebase=require('../../infrastructure/firebase/firebase-admin');
const credentials=require('./credentials');
const rollout=require('./feature-access');
const origins=['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br','http://localhost:3000','http://127.0.0.1:3000'];
const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(error){res.status(error instanceof CommunityError||error instanceof rollout.RolloutError?error.status:503).json({success:false,error:error instanceof CommunityError||error instanceof rollout.RolloutError?error.message:'Não foi possível concluir agora. Tente novamente em instantes.'});}};
function origin(req){if(!origins.includes(req.get('origin')))throw new CommunityError(403,'Origem não autorizada.');}
function rateLimit(max=60){const entries=new Map();return (req,res,next)=>{const now=Date.now(),key=req.ip||'local';if(entries.size>5000)for(const [id,value]of entries)if(value.until<now)entries.delete(id);let value=entries.get(key);if(!value||value.until<=now)value={count:0,until:now+3600000};entries.set(key,value);if(++value.count>max)return res.status(429).json({success:false,error:'Muitas tentativas. Aguarde antes de tentar novamente.'});next();};}
function sendPhoto(res,bytes){res.type('image/jpeg').set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}).send(bytes);}
function createPublicRouter(deps={}){
 const service=createService({getDb:firebase.getFirestore,...deps}),router=express.Router();router.use(rateLimit(120));
 router.get('/stores/:id/gallery',wrap(async(req,res)=>res.json({success:true,data:{photos:await service.gallery(req.params.id)}})));
 router.get('/photos/:id',wrap(async(req,res)=>sendPhoto(res,await service.photo(req.params.id))));
 router.post('/stores/:id/follow',rateLimit(8),wrap(async(req,res)=>{origin(req);res.json({success:true,data:await service.follow(req.params.id,req.body)});}));
 router.post('/follow/:id/status',wrap(async(req,res)=>{origin(req);res.json({success:true,data:await service.followStatus(req.params.id,req.body?.secret)});}));
 router.post('/follow/:id/cancel',wrap(async(req,res)=>{origin(req);await service.unfollow(req.params.id,req.body?.secret);res.json({success:true});}));
 return router;
}
function createOwnerRouter(deps={}){
 const getDb=deps.getDb||firebase.getFirestore,service=createService({getDb,...deps}),router=express.Router();router.use(rateLimit(80));
 router.use(async(req,res,next)=>{try{const user=await credentials.identity(getDb(),req);if(!user||user.mustChangePassword)return res.status(401).json({success:false,error:'Entre com sua senha pessoal.'});req.communityOwner=user.id;next();}catch{res.status(503).json({success:false,error:'Não foi possível conferir seu acesso.'});}});
 router.get('/',wrap(async(req,res)=>res.json({success:true,data:await service.ownerSummary(req.communityOwner)})));
 router.post('/photos',rateLimit(12),wrap(async(req,res)=>{origin(req);res.json({success:true,data:await service.upload(req.communityOwner,req.body)});}));
 router.get('/photos/:id',wrap(async(req,res)=>sendPhoto(res,await service.photo(req.params.id,req.communityOwner))));
 router.delete('/photos/:id',wrap(async(req,res)=>{origin(req);await service.remove(req.communityOwner,req.params.id);res.json({success:true});}));
 return router;
}
function adminHandlers(deps={}){
 const service=createService({getDb:firebase.getFirestore,...deps});
 const admin=fn=>wrap(async(req,res)=>{if(req.admin?.role!=='admin')return res.status(403).json({success:false,error:'Somente administradores podem moderar a comunidade.'});if(req.method!=='GET')origin(req);await fn(req,res);});
 return {
  rolloutRead:admin(async(req,res)=>res.json({success:true,data:await rollout.getSettings((deps.getDb||firebase.getFirestore)(),req.params.owner)})),
  rolloutWrite:admin(async(req,res)=>res.json({success:true,data:await rollout.saveSettings((deps.getDb||firebase.getFirestore)(),req.params.owner,req.body,req.admin.uid||'admin')})),
  list:admin(async(req,res)=>res.json({success:true,data:await service.adminQueue(req.query?.owner)})),
  image:admin(async(req,res)=>sendPhoto(res,await service.photo(req.params.id,null,true))),
  review:admin(async(req,res)=>{await service.reviewPhoto(req.params.id,req.body,req.admin.uid||'admin');res.json({success:true});}),
  rescan:admin(async(req,res)=>{await service.rescan(req.params.id);res.json({success:true});}),
  confirm:admin(async(req,res)=>{await service.confirmFollow(req.params.id,req.body,req.admin.uid||'admin');res.json({success:true});})
 };
}
module.exports={createPublicRouter,createOwnerRouter,adminHandlers};
