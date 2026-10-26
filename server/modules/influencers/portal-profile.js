'use strict';
const credentials=require('./credentials');
const {randomBytes}=require('node:crypto');
const revision=data=>String(data.profileRevision||data.updatedAt||'');
function profile(body){
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['image','revision'].includes(k))||typeof body.revision!=='string'||body.revision.length>200||typeof body.image!=='string'||body.image.length>2000)throw Error('Você pode alterar somente sua foto de perfil.');
  const image=body.image.trim();
  if(image){let url;try{url=new URL(image);}catch{throw Error('Informe o endereço HTTPS da sua foto.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Use uma foto com endereço HTTPS, sem credenciais.');}
  return {image};
}
function createHandlers({getDb}){
  async function owner(req){const user=await credentials.identity(getDb(),req);return user&&!user.mustChangePassword?user:null;}
  return {
    read:async(req,res)=>{try{const user=await owner(req);if(!user)return res.status(401).json({success:false,error:'Entre com sua senha pessoal.'});const doc=await getDb().collection('influencerPublicStores').doc(user.id).get(),data=doc.exists?doc.data():{};res.json({success:true,data:{name:user.name,image:String(data.image||''),bio:String(data.bio||''),revision:revision(data)}});}catch{res.status(503).json({success:false,error:'Não foi possível carregar seu perfil.'});}},
    write:async(req,res)=>{
      try{
        const user=await owner(req);if(!user)return res.status(401).json({success:false,error:'Entre com sua senha pessoal.'});
        if(!['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br','http://localhost:3000','http://127.0.0.1:3000'].includes(req.get('origin')))return res.status(403).json({success:false,error:'Origem não autorizada.'});
        let input;try{input=profile(req.body);}catch(error){return res.status(400).json({success:false,error:error.message});}
        const ref=getDb().collection('influencerPublicStores').doc(user.id),next=randomBytes(16).toString('hex');
        const saved=await getDb().runTransaction(async tx=>{
          const doc=await tx.get(ref),current=doc.exists?doc.data():{};
          if(revision(current)!==req.body.revision)return false;
          const update={...input,profileRevision:next,updatedAt:new Date().toISOString(),updatedBy:'influencer:'+user.id};
          if(doc.exists)tx.update(ref,update);
          else tx.set(ref,{name:user.name,enabled:false,coupon:'',skus:[],...update});
          return true;
        });
        if(!saved)return res.status(409).json({success:false,error:'O perfil mudou em outra tela. Atualize antes de salvar.'});
        res.json({success:true,data:{...input,revision:next}});
      }catch{res.status(503).json({success:false,error:'Não foi possível salvar seu perfil.'});}
    }
  };
}
module.exports={createHandlers,profile};
