'use strict';
const {createHash}=require('node:crypto');
const {AppError}=require('../../core/app-error');
const policy=require('../../../js/marketing/flash-policy');
function fail(message){return new AppError(message,{status:409,code:'FLASH_OFFER_LIMIT'});}
async function apply(order,coupon){
    const campaign=await require('../admin/services/marketing-service').getActiveHero();
    const pricing=policy.calculate(order.items,coupon,campaign);
    if(pricing.promotionalQuantity>1)throw fail('A promoção relâmpago permite apenas uma unidade por cliente. Ajuste sua sacola.');
    if(pricing.promotionalQuantity){
        order.flashOffer={id:campaign.offerId,sku:campaign.flashSku,discountPercent:campaign.discountPercent,endsAt:campaign.endsAt};
        // Require both existing customer identifiers; no raw identifier goes into the claim key.
        claimKeys(order);
    }
    order.totals.promotionDiscount=pricing.promotionDiscount;
    order.totals.couponDiscount=pricing.couponDiscount;
    return pricing.discount;
}
function claimKeys(order){
    const email=String(order.customer?.email||'').trim().toLowerCase();
    const phone=String(order.customer?.phone||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\d{10,11}$/.test(phone))throw fail('Informe e-mail e telefone válidos para comprar a promoção relâmpago.');
    return ['email:'+email,'phone:'+phone].map(value=>createHash('sha256').update(order.flashOffer.id+'|'+value).digest('hex'));
}
async function prepareClaim(tx,db,order,orderRef){
    if(!order.flashOffer)return ()=>{};
    const current=await tx.get(db.collection('settings').doc('storefrontHero'));
    const campaign=current.exists?current.data():null;
    const pricing=policy.calculate(order.items,order.coupon,campaign);
    if(!policy.active(campaign)||campaign.offerId!==order.flashOffer.id||campaign.flashSku!==order.flashOffer.sku||pricing.promotionalQuantity!==1||pricing.promotionDiscount!==order.totals.promotionDiscount||pricing.couponDiscount!==order.totals.couponDiscount)throw fail('A promoção foi alterada ou terminou. Atualize sua sacola antes de pagar.');
    const refs=claimKeys(order).map(key=>db.collection('flashOfferClaims').doc(key));
    const claims=await Promise.all(refs.map(ref=>tx.get(ref)));
    const priorRefs=claims.map(s=>s.exists?s.data().orderDocumentId:null);
    const priorOrders=await Promise.all(priorRefs.map(id=>id?tx.get(db.collection('orders').doc(id)):null));
    for(let i=0;i<claims.length;i++){
        if(!claims[i].exists||priorRefs[i]===orderRef.id)continue;
        const prior=priorOrders[i]?.exists?priorOrders[i].data():null;
        // A timeout or expired payment link is not proof of cancellation.
        if(!prior||!['cancelled','canceled'].includes(prior.payment?.status)||prior.payment?.confirmedAt||prior.payment?.paidAt)throw fail('Este cliente já possui um pedido desta promoção. Retome o pedido anterior ou fale com a loja.');
    }
    return ()=>refs.forEach(ref=>tx.set(ref,{offerId:order.flashOffer.id,orderDocumentId:orderRef.id,orderNumber:order.orderNumber,createdAt:new Date().toISOString()}));
}
module.exports={apply,prepareClaim,claimKeys};
