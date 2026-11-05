(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FlashOfferPolicy=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
    'use strict';
    function active(campaign,now=Date.now()) {
        const end=Date.parse(campaign?.endsAt),start=campaign?.startsAt?Date.parse(campaign.startsAt):null;
        const percent=Number(campaign?.discountPercent);
        return Boolean(campaign?.offerId&&campaign?.flashSku&&campaign.status==='active'&&Number.isFinite(end)&&end>now&&(!start||start<=now)&&percent>0&&percent<=100);
    }
    function calculate(items,coupon,campaign,now=Date.now()) {
        const enabled=active(campaign,now),sku=String(campaign?.flashSku||'').trim();
        let subtotal=0,promotionalSubtotal=0,promotionalQuantity=0;
        for(const item of items||[]){const line=Math.round(Number(item.unitPrice)*100)*Number(item.quantity);subtotal+=line;if(enabled&&String(item.sku).trim()===sku){promotionalSubtotal+=line;promotionalQuantity+=Number(item.quantity);}}
        const promotionDiscount=enabled?Math.round(promotionalSubtotal*Number(campaign.discountPercent)/100):0;
        const eligible=Math.max(0,subtotal-promotionalSubtotal),value=Number(coupon?.discount??coupon?.value??0)||0;
        const type=coupon?.discountType??coupon?.type;
        const couponDiscount=coupon?Math.min(eligible,Math.max(0,type==='percentage'?Math.round(eligible*value/100):Math.round(value*100))):0;
        return {promotionDiscount:promotionDiscount/100,couponDiscount:couponDiscount/100,discount:(promotionDiscount+couponDiscount)/100,promotionalQuantity};
    }
    return {active,calculate};
});
