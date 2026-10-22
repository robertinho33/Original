'use strict';
const {randomBytes}=require('node:crypto');
const credentials=require('./credentials');
class StoreError extends Error{constructor(status,message){super(message);this.status=status;}}
function selection(body){
  if(!body||Array.isArray(body)||Object.keys(body).some(key=>!['skus','revision'].includes(key))||typeof body.revision!=='string'||body.revision.length>200)throw new StoreError(400,'Confira os dados da seleção.');
  if(!Array.isArray(body.skus)||body.skus.length<1||body.skus.length>6||body.skus.some(sku=>typeof sku!=='string'||!sku.trim()||sku.length>100))throw new StoreError(400,'Escolha de um a seis produtos.');
  const skus=body.skus.map(sku=>sku.trim());
  if(new Set(skus.map(sku=>sku.toLowerCase())).size!==skus.length)throw new StoreError(400,'Escolha produtos diferentes.');
  return skus;
}
const revision=config=>String(config.selectionRevision||config.updatedAt||'');
function createHandlers({getDb,getCatalog=()=>require('./discovery').publicCatalog()}){
  async function identity(req){const user=await credentials.identity(getDb(),req);if(!user)throw new StoreError(401,'Entre novamente para editar sua vitrine.');return user;}
  async function view(db,user){
    const [snapshot,catalog,person]=await Promise.all([db.collection('influencerPublicStores').doc(user.id).get(),getCatalog(),db.collection('influencers').doc(user.id).get()]);
    if(!snapshot.exists)throw new StoreError(404,'A loja ainda não configurou sua vitrine. Fale com o atendimento.');
    const config=snapshot.data(),discovery=require('./discovery');
    const coupon=await discovery.validCoupon(db,config.coupon,user.id);
    const publication=discovery.storePublication(config,person.exists?person.data():null,coupon);
    const products=catalog.map(p=>({sku:String(p.sku),name:String(p.name),price:Number(p.price),image:discovery.productView(p).image}));
    return {name:String(config.name||user.name),selectedSkus:Array.isArray(config.skus)?config.skus:[],revision:revision(config),published:publication.published,
      storeUrl:publication.published?'/pages/vitrine-influenciador.html?loja='+encodeURIComponent(user.id):'',catalog:products};
  }
  function fail(res,error){return res.status(error instanceof StoreError?error.status:503).json({success:false,error:error instanceof StoreError?error.message:'Não foi possível acessar sua vitrine agora.'});}
  return {
    read:async(req,res)=>{try{const user=await identity(req);res.json({success:true,data:await view(getDb(),user)});}catch(error){fail(res,error);}},
    write:async(req,res)=>{try{
      const user=await identity(req);
      if(!['https://www.fiosperfeitos.com.br','https://fiosperfeitos.com.br','http://localhost:3000','http://127.0.0.1:3000'].includes(req.get('origin')))throw new StoreError(403,'Origem não autorizada.');
      const skus=selection(req.body),catalog=await getCatalog(),available=new Set(catalog.map(p=>String(p.sku)));
      if(skus.some(sku=>!available.has(sku)))throw new StoreError(400,'Selecione somente produtos visíveis e disponíveis. Atualize a lista e tente novamente.');
      const db=getDb(),ref=db.collection('influencerPublicStores').doc(user.id),nextRevision=randomBytes(16).toString('hex');
      await db.runTransaction(async tx=>{
        const snapshot=await tx.get(ref);
        if(!snapshot.exists)throw new StoreError(404,'A loja ainda não configurou sua vitrine.');
        if(revision(snapshot.data())!==req.body.revision)throw new StoreError(409,'A vitrine foi alterada em outra tela. Atualize a lista antes de salvar novamente.');
        tx.update(ref,{skus,selectionRevision:nextRevision,updatedAt:new Date().toISOString(),updatedBy:'influencer:'+user.id});
      });
      res.json({success:true,data:{selectedSkus:skus,revision:nextRevision}});
    }catch(error){fail(res,error);}}
  };
}
module.exports={createHandlers,selection};
