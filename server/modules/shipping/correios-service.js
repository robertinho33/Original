'use strict';
const { AppError } = require('../../core/app-error');
const SERVICES = { '03298': 'PAC', '03220': 'SEDEX', '03158': 'SEDEX 10', '03140': 'SEDEX 12' };
const unavailable = () => new AppError('A cotação de entrega está temporariamente indisponível. Fale com nosso atendimento.', {status:503,code:'SHIPPING_UNAVAILABLE'});
let cachedToken = null;

function configuration(env = process.env) {
  const config = {
    origin: String(env.CORREIOS_ORIGIN_CEP || '04883000').replace(/\D/g,''),
    user: env.CORREIOS_USERNAME, password: env.CORREIOS_ACCESS_CODE,
    contract: env.CORREIOS_CONTRACT, dr: env.CORREIOS_DR,
    length: Number(env.CORREIOS_PACKAGE_LENGTH_CM), width: Number(env.CORREIOS_PACKAGE_WIDTH_CM),
    height: Number(env.CORREIOS_PACKAGE_HEIGHT_CM), tare: Number(env.CORREIOS_PACKAGE_TARE_GRAMS),
    maxItems: Number(env.CORREIOS_PACKAGE_MAX_ITEMS), preparationDays: Number(env.CORREIOS_PREPARATION_DAYS),
    codes: String(env.CORREIOS_SERVICE_CODES || '03298,03220,03158,03140').split(',').map(s=>s.trim())
  };
  if (!/^\d{8}$/.test(config.origin) || !config.user || !config.password || !config.contract || !/^\d{1,2}$/.test(config.dr || '') ||
      ![config.length,config.width,config.height].every(n=>Number.isFinite(n)&&n>0&&n<=100) ||
      !Number.isFinite(config.tare) || config.tare<0 || !Number.isInteger(config.maxItems) || config.maxItems<1 ||
      !Number.isInteger(config.preparationDays) || config.preparationDays<0 ||
      !config.codes.length || config.codes.length>10 || config.codes.some(code=>!SERVICES[code])) throw unavailable();
  return config;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length || items.length>100) throw new AppError('Sacola inválida para calcular entrega.');
  const quantities=new Map();
  for (const item of items) {
    const sku=String(item?.sku || '').trim(); const quantity=Number(item?.quantity);
    if (!sku || sku.length>100 || !Number.isInteger(quantity) || quantity<1 || quantity>100) throw new AppError('Quantidade inválida para entrega.');
    quantities.set(sku,(quantities.get(sku)||0)+quantity);
  }
  return [...quantities].sort(([a],[b])=>a.localeCompare(b)).map(([sku,quantity])=>({sku,quantity}));
}

function priceNumber(value) {
  if (typeof value==='number') return value;
  const text=String(value || '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return NaN;
  return Number(text.replace(',','.'));
}

async function request(url, options, fetchImpl) {
  let response;
  try { response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(12000),redirect:'error'}); }
  catch { throw unavailable(); }
  if (!response.ok) throw unavailable();
  try { return await response.json(); } catch { throw unavailable(); }
}

async function accessToken(config, fetchImpl) {
  if (cachedToken?.expiresAt>Date.now()+60000) return cachedToken.value;
  const data=await request('https://api.correios.com.br/token/v1/autentica/contrato',{
    method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.user+':'+config.password).toString('base64'),'Content-Type':'application/json'},
    body:JSON.stringify({numero:config.contract,dr:Number(config.dr)})
  },fetchImpl);
  if (!data.token) throw unavailable();
  cachedToken={value:data.token,expiresAt:Math.min(Date.parse(data.expiraEm)||Date.now()+300000,Date.now()+300000)};
  return data.token;
}

async function quoteShipping({cep,items}, dependencies={}) {
  const destination=String(cep || '').replace(/\D/g,'');
  if (!/^\d{8}$/.test(destination)) throw new AppError('Informe um CEP válido para entrega.');
  const normalized=normalizeItems(items);
  const config=configuration(dependencies.env || process.env);
  if (normalized.reduce((sum,item)=>sum+item.quantity,0)>config.maxItems) throw new AppError('Esta sacola precisa de uma cotação de embalagem com o atendimento.',{status:422,code:'PACKAGE_CAPACITY'});
  const lookup=dependencies.lookup || require('../catalog/product-resolver').findProductBySku;
  let weight=config.tare;
  for (const item of normalized) {
    const product=await lookup(item.sku);
    const grams=Number(product?.shippingWeightGrams);
    if (!product || product.active===false || !Number.isFinite(grams) || grams<=0) throw unavailable();
    weight+=grams*item.quantity;
  }
  if (weight>30000) throw new AppError('Esta sacola precisa de uma cotação especial de entrega.',{status:422});
  const fetchImpl=dependencies.fetch || fetch;
  const token=dependencies.token || await accessToken(config,fetchImpl);
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  const options=await Promise.all(config.codes.map(async code=>{
    const common={cepOrigem:config.origin,cepDestino:destination};
    const priceParams=new URLSearchParams({...common,psObjeto:String(Math.ceil(weight)),tpObjeto:'2',comprimento:String(config.length),largura:String(config.width),altura:String(config.height),nuContrato:config.contract,nuDR:config.dr});
    try {
      const [price,deadline]=await Promise.all([
        request('https://api.correios.com.br/preco/v3/nacional/'+code+'?'+priceParams,{headers},fetchImpl),
        request('https://api.correios.com.br/prazo/v3/nacional/'+code+'?'+new URLSearchParams(common),{headers},fetchImpl)
      ]);
      const cost=priceNumber(price.pcFinal); const days=Number(deadline.prazoEntrega);
      if (price.txErro || deadline.txErro || price.coProduto!==code || deadline.coProduto!==code || !Number.isFinite(cost) || cost<=0 || deadline.prazoEntrega==null || !Number.isInteger(days) || days<0) return null;
      return {code,name:SERVICES[code],cost:Number(cost.toFixed(2)),transitDays:days,preparationDays:config.preparationDays,homeDelivery:deadline.entregaDomiciliar==='S'};
    } catch { return null; }
  }));
  const available=options.filter(Boolean).sort((a,b)=>a.cost-b.cost);
  if (!available.length) throw unavailable();
  return {originCep:config.origin,destinationCep:destination,options:available};
}

async function authorizeShipping({cep,items,selection}, dependencies) {
  if (!selection?.code || !Number.isFinite(selection.cost)) throw new AppError('Calcule a entrega e escolha uma opção dos Correios.');
  const quote=await quoteShipping({cep,items},dependencies);
  const option=quote.options.find(item=>item.code===selection.code);
  if (!option || Math.round(option.cost*100)!==Math.round(selection.cost*100)) throw new AppError('A cotação mudou. Calcule a entrega novamente antes de pagar.',{status:409,code:'SHIPPING_QUOTE_CHANGED'});
  return {...option,carrier:'Correios',originCep:quote.originCep,destinationCep:quote.destinationCep};
}
module.exports={quoteShipping,authorizeShipping,configuration,normalizeItems,priceNumber};
