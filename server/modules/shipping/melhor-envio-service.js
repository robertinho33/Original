'use strict';
const {AppError}=require('../../core/app-error');
const {normalizeItems,priceNumber}=require('./correios-service');
const services={'1':'PAC','2':'SEDEX'};
const unavailable=()=>new AppError('Não foi possível consultar PAC e SEDEX agora. Tente novamente mais tarde.',{status:503,code:'SHIPPING_UNAVAILABLE'});
function configuration(env=process.env) {
    const config={
        token:String(env.MELHOR_ENVIO_TOKEN || '').trim(),
        userAgent:String(env.MELHOR_ENVIO_USER_AGENT || '').trim(),
        origin:String(env.CORREIOS_ORIGIN_CEP || '04883000').replace(/\D/g,''),
        length:Number(env.CORREIOS_PACKAGE_LENGTH_CM || 16),width:Number(env.CORREIOS_PACKAGE_WIDTH_CM || 24),height:Number(env.CORREIOS_PACKAGE_HEIGHT_CM || 8),
        tare:Number(env.CORREIOS_PACKAGE_TARE_GRAMS),maxItems:Number(env.CORREIOS_PACKAGE_MAX_ITEMS),
        maxWeight:Number(env.SHIPPING_PACKAGE_MAX_WEIGHT_GRAMS || 2000),
        fixedWeight:env.SHIPPING_WEIGHT_MODE === 'fixed' ? Number(env.SHIPPING_PACKAGE_FIXED_WEIGHT_GRAMS) : null,
        preparationDays:Number(String(env.CORREIOS_PREPARATION_DAYS ?? '').trim() || 3)
    };
    if(!config.token || /[\r\n]/.test(config.token) || !config.userAgent.includes('@') || /[\r\n]/.test(config.userAgent) ||
        !/^\d{8}$/.test(config.origin) || ![config.length,config.width,config.height].every(n=>Number.isFinite(n)&&n>0&&n<=100) ||
        String(env.CORREIOS_PACKAGE_TARE_GRAMS ?? '').trim()==='' || !Number.isFinite(config.tare) || config.tare<0 ||
        !Number.isInteger(config.maxItems) || config.maxItems<1 || !Number.isFinite(config.maxWeight) || config.maxWeight<=0 || config.maxWeight>2000 ||
        !['actual','fixed'].includes(env.SHIPPING_WEIGHT_MODE || 'actual') ||
        (config.fixedWeight!==null && (!Number.isFinite(config.fixedWeight) || config.fixedWeight<=config.tare || config.fixedWeight>config.maxWeight)) ||
        !Number.isInteger(config.preparationDays) || config.preparationDays<0) {
        throw new AppError('A cotação automática ainda não está disponível. Consulte nosso atendimento.',{status:503,code:'SHIPPING_NOT_CONFIGURED'});
    }
    return config;
}
async function quoteShipping({cep,items},dependencies={}) {
    const destination=String(cep || '').replace(/\D/g,'');
    if(!/^\d{8}$/.test(destination)) throw new AppError('Informe um CEP válido para entrega.');
    const normalized=normalizeItems(items), config=configuration(dependencies.env || process.env);
    if(normalized.reduce((sum,item)=>sum+item.quantity,0)>config.maxItems) throw new AppError('Esta sacola precisa de uma cotação de embalagem com o atendimento.',{status:422,code:'PACKAGE_CAPACITY'});
    const lookup=dependencies.lookup || require('../catalog/product-resolver').findProductBySku;
    let weight=config.tare, insurance=0;
    for(const item of normalized) {
        const product=await lookup(item.sku), grams=Number(product?.shippingWeightGrams);
        const {getProductPrice}=require('../catalog/catalog-service');
        const {normalizePrice}=require('../catalog/product-resolver');
        const price=normalizePrice(getProductPrice(product || {}));
        if(!product || product.active===false || (config.fixedWeight===null && (!Number.isFinite(grams) || grams<=0)) || !Number.isFinite(price) || price<=0) throw new AppError('Este produto ainda não possui os dados necessários para cotar o frete.',{status:422,code:'SHIPPING_PRODUCT_DATA_MISSING'});
        if(Number.isFinite(grams) && grams>0) weight+=grams*item.quantity;
        insurance+=price*item.quantity;
    }
    if(weight>config.maxWeight) throw new AppError('Esta sacola ultrapassa o limite de 2 kg da embalagem. Consulte uma cotação de envio com o atendimento.',{status:422,code:'PACKAGE_CAPACITY'});
    // Fixed weight is the complete package, including tare; never add the box twice.
    if(config.fixedWeight!==null) {
        if(weight>config.fixedWeight) throw new AppError('Esta sacola ultrapassa o peso padrão de cotação. Consulte o atendimento.',{status:422,code:'PACKAGE_CAPACITY'});
        weight=config.fixedWeight;
    }
    const payload={from:{postal_code:config.origin},to:{postal_code:destination},
        volumes:[{length:config.length,width:config.width,height:config.height,weight:Math.ceil(weight)/1000,insurance:Number(insurance.toFixed(2))}],
        services:'1,2',options:{receipt:false,own_hand:false}};
    let rows;
    try {
        const response=await (dependencies.fetch || fetch)('https://www.melhorenvio.com.br/api/v2/me/shipment/calculate',{
            method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json',Accept:'application/json','User-Agent':config.userAgent},
            body:JSON.stringify(payload),signal:AbortSignal.timeout(12000),redirect:'error'
        });
        if(!response.ok) throw unavailable();
        rows=await response.json();
    } catch {throw unavailable();}
    if(!Array.isArray(rows)) throw unavailable();
    const options=rows.flatMap(row=>{
        const id=String(row.id), cost=priceNumber(row.custom_price), days=Number(row.custom_delivery_time);
        if(row.error || !services[id] || Number(row.company?.id)!==1 || String(row.name).toUpperCase()!==services[id] ||
            !Number.isFinite(cost) || cost<=0 || row.custom_delivery_time==null || !Number.isInteger(days) || days<0 ||
            !Array.isArray(row.packages) || row.packages.length!==1) return [];
        return [{code:'me:'+id,name:services[id],cost:Number(cost.toFixed(2)),transitDays:days,preparationDays:config.preparationDays,
            homeDelivery:false,provider:'melhor_envio',serviceId:id,package:payload.volumes[0],
            estimatedWeight:config.fixedWeight!==null,quoteWeightGrams:weight}];
    }).sort((a,b)=>a.cost-b.cost);
    if(!options.length) throw unavailable();
    return {originCep:config.origin,destinationCep:destination,options};
}
module.exports={configuration,quoteShipping};
