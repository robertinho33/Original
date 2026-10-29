'use strict';
const {normalize:normalizeCare}=require('../../../js/product-care-profile');
const key=v=>String(v??'').trim().toLowerCase();
function enrichProducts(products,base,sources=[]){
  const bySku=new Map(base.map(p=>[key(p.sku||p.SKU),p]));
  const bySource=new Map(sources.map(s=>[key(s.id),s]));
  return products.map(row=>{
    const sku=String(row.sku||row.SKU||row.Sku||'').trim(),reference=bySku.get(key(sku))||{};
    const sourceId=String(row.sourceId||reference.sourceId||'').trim(),source=bySource.get(key(sourceId));
    return {...row,id:row.id,sku,name:String(row.name||row.Nome||row.nome||reference.name||sku),sourceId,
      sourceName:String(row.sourceName||row.brand||row.marca||row.Marca||reference.sourceName||source?.name||sourceId||''),
      categoryName:String(row.categoryName||row.category_name||reference.categoryName||reference.category||'')};
  });
}
function mergePublicProducts(base,documents,sources=[]){
  const map=new Map(base.map(p=>[key(p.sku||p.SKU),p]));
  for(const row of enrichProducts(documents,base,sources)){
    if(!row.sku)continue;
    const before=map.get(key(row.sku))||{};
    const merged={...before,...row};
    // Keep public output limited to catalog fields; Firestore document metadata stays private.
    const result={...(['pending','approved','excluded'].includes(merged.catalogProfile?.reviewStatus)?{careReviewStatus:merged.catalogProfile.reviewStatus}:{}),careProfile:normalizeCare(merged.careProfile),sku:row.sku,name:row.name,price:row.price??row['Preço']??before.price,stock:row.stock??row.Estoque??before.stock??0,
      active:row.active??before.active??true,image:row.image||before.image||'',description:row.description||before.description||'',
      sourceId:row.sourceId,sourceName:row.sourceName,sourceUrl:merged.sourceUrl||'',category:row.categoryName||merged.category||'',
      categoryName:row.categoryName,weight:merged.weight||'',featured:merged.featured===true,priority:Number(merged.priority)||0};
    const care=merged.catalogProfile;
    if(care?.schemaVersion===3&&care.sourceId==='ecobelle')result.recommendationProfile={
      verified:care.reviewStatus==='approved'&&care.evidenceStatus==='purpose_verified'&&care.usage==='home',
      type:care.type,step:care.step,line:care.line,primaryGoal:care.primaryGoal,goals:care.goals,
      hairScope:care.hairScope,hair:care.hair,chemistryScope:care.chemistryScope,chemistry:care.chemistry,
      restrictions:care.restrictions,source:care.source,verifiedAt:care.verifiedAt,
      components:care.kitReviewStatus==='approved'?care.components:[]
    };
    map.set(key(row.sku),result);
  }
  for(const row of map.values())if(row.recommendationProfile)row.recommendationProfile.components=row.recommendationProfile.components.map(component=>({sku:component.sku,quantity:component.quantity,name:map.get(key(component.sku))?.name||'',step:map.get(key(component.sku))?.recommendationProfile?.step||''}));
  return [...map.values()];
}
module.exports={enrichProducts,mergePublicProducts};
