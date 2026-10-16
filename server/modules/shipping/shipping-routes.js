'use strict';
const router=require('express').Router();
const {AppError}=require('../../core/app-error');
const {quoteShipping,configuration}=require('./shipping-provider');
const requests=new Map();
router.get('/melhor-envio/callback',require('./melhor-envio-oauth').callback);
router.get('/configuration',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try {configuration();res.json({enabled:true});}
  catch {res.json({enabled:false,message:'A entrega pelos Correios ainda não está disponível. Consulte nosso atendimento antes de finalizar.'});}
});
router.post('/quote',async(req,res,next)=>{
  const now=Date.now(); const key=req.ip;
  for (const [ip,entry] of requests) if (entry.until<now) requests.delete(ip);
  const entry=requests.get(key)||{until:now+60000,count:0};
  entry.count++; requests.set(key,entry);
  if (entry.count>12 || requests.size>5000) return res.status(429).json({success:false,message:'Aguarde um minuto para calcular novamente.'});
  res.setHeader('Cache-Control','no-store');
  try { res.json({success:true,data:await quoteShipping(req.body || {})}); }
  catch(error) {
    const known=error instanceof AppError;
    res.status(known?error.status:503).json({success:false,code:known?error.code:'SHIPPING_UNAVAILABLE',
      message:known?error.message:'Não foi possível consultar a entrega agora. Tente novamente ou fale com nosso atendimento.'});
  }
});
module.exports=router;
