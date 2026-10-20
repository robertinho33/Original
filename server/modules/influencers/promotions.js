'use strict';
const { getFirestore } = require('../../infrastructure/firebase/firebase-admin');
const clean = (value, max) => String(value || '').trim().slice(0,max);
function image(value) {
  const text=clean(value,1600);
  if (/^\/assets\/[a-z0-9/_\.\-]+$/i.test(text)) return text;
  try { return new URL(text).protocol === 'https:' ? text : ''; } catch { return ''; }
}
function normalize(body={}) {
  const products=Array.isArray(body.products) ? body.products : [];
  if(products.length>3) throw new Error('Escolha no máximo três produtos diferentes.');
  const seen=new Set();
  const rows=products.map(p=>{
    const sku=clean(p.sku,100), key=sku.toLowerCase();
    if(!sku || seen.has(key)) throw new Error('Informe produtos com SKUs diferentes.');
    seen.add(key);
    const row={sku,name:clean(p.name,180),description:clean(p.description,800),image:image(p.image)};
    if(!row.name||!row.description||!row.image) throw new Error('Cada produto precisa de nome, descrição e imagem HTTPS.');
    return row;
  });
  const startsAt=clean(body.startsAt,32),endsAt=clean(body.endsAt,32);
  for(const date of [startsAt,endsAt]) if(date && !Number.isFinite(Date.parse(date))) throw new Error('Confira as datas da campanha.');
  if(startsAt&&endsAt&&new Date(startsAt)>new Date(endsAt))throw new Error('O término deve ser posterior ao início.');
  const result={enabled:body.enabled===true,title:clean(body.title,120),description:clean(body.description,600),startsAt,endsAt,products:rows};
  if(result.enabled&&(!rows.length||!result.title))throw new Error('Informe um título e ao menos um produto para ativar.');
  return result;
}
function activeCampaign(value, now=Date.now()) {
  if(!value?.enabled) return null;
  try { const campaign=normalize(value);if(campaign.startsAt&&Date.parse(campaign.startsAt)>now || campaign.endsAt&&Date.parse(campaign.endsAt)<now)return null;return campaign; } catch { return null; }
}
function rankProducts(orders) {
  const totals=new Map();
  for(const order of orders) for(const item of order.products || []) {
    const sku=clean(item.sku,100), quantity=Number(item.quantity), key=sku.toLowerCase();
    if(!sku||!Number.isSafeInteger(quantity)||quantity<=0)continue;
    const row=totals.get(key)||{sku,name:clean(item.name,180)||sku,image:image(item.image),quantity:0};
    row.quantity+=quantity;totals.set(key,row);
  }
  return [...totals.values()].sort((a,b)=>b.quantity-a.quantity || a.sku.localeCompare(b.sku)).slice(0,6);
}
async function read(req,res) {
  if(req.admin?.role!=='admin')return res.status(403).json({success:false,error:'Acesso restrito ao administrador.'});
  try {const [snap,catalog]=await Promise.all([getFirestore().collection('influencerPortalCampaigns').doc('current').get(),require('../catalog/catalog-storefront-service').getPublicCatalog()]);res.set('Cache-Control','no-store');res.json({success:true,data:snap.exists?snap.data():{},catalog:catalog.filter(p=>p.active!==false).map(p=>({sku:p.sku,name:p.name,image:p.image,description:clean(p.description,800)}))});}catch{res.status(503).json({success:false,error:'Não foi possível carregar a campanha.'});}
}
async function save(req,res) {
  if(req.admin?.role!=='admin')return res.status(403).json({success:false,error:'Apenas o administrador pode alterar a campanha.'});
  let data;try{data=normalize(req.body);}catch(error){return res.status(400).json({success:false,error:error.message});}
  try {
    const catalog=await require('../catalog/catalog-storefront-service').getPublicCatalog();
    if(data.products.some(row=>!catalog.some(p=>p.active!==false&&String(p.sku).toLowerCase()===row.sku.toLowerCase())))return res.status(400).json({success:false,error:'Selecione produtos existentes e ativos no catálogo.'});
    await getFirestore().collection('influencerPortalCampaigns').doc('current').set({...data,updatedAt:new Date().toISOString(),updatedBy:req.admin.uid||req.admin.email});res.json({success:true,data});
  }catch{res.status(503).json({success:false,error:'Não foi possível salvar a campanha.'});}
}
module.exports={normalize,activeCampaign,rankProducts,read,save};
