'use strict';
const router=require('express').Router();
const {quoteShipping}=require('./correios-service');
const requests=new Map();
router.post('/quote',async(req,res,next)=>{
  const now=Date.now(); const key=req.ip;
  for (const [ip,entry] of requests) if (entry.until<now) requests.delete(ip);
  const entry=requests.get(key)||{until:now+60000,count:0};
  entry.count++; requests.set(key,entry);
  if (entry.count>12 || requests.size>5000) return res.status(429).json({success:false,message:'Aguarde um minuto para calcular novamente.'});
  res.setHeader('Cache-Control','no-store');
  try { res.json({success:true,data:await quoteShipping(req.body || {})}); } catch(error) { next(error); }
});
module.exports=router;
