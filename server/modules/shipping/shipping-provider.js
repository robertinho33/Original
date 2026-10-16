'use strict';
const {AppError}=require('../../core/app-error');
function provider(env=process.env) {
    const name=String(env.SHIPPING_PROVIDER || 'correios');
    if(name==='correios') return require('./correios-service');
    if(name==='melhor_envio') return require('./melhor-envio-service');
    throw new AppError('A cotação automática ainda não está disponível.',{status:503,code:'SHIPPING_NOT_CONFIGURED'});
}
function configuration(env=process.env) {return provider(env).configuration(env);}
function quoteShipping(input,dependencies={}) {return provider(dependencies.env).quoteShipping(input,dependencies);}
async function authorizeShipping({cep,items,selection},dependencies={}) {
    if(!selection?.code || !Number.isFinite(selection.cost)) throw new AppError('Calcule a entrega e escolha uma opção dos Correios.');
    const quote=await quoteShipping({cep,items},dependencies);
    const option=quote.options.find(item=>item.code===selection.code);
    if(!option || Math.round(option.cost*100)!==Math.round(selection.cost*100)) throw new AppError('A cotação mudou. Calcule a entrega novamente antes de pagar.',{status:409,code:'SHIPPING_QUOTE_CHANGED'});
    return {...option,carrier:'Correios',originCep:quote.originCep,destinationCep:quote.destinationCep};
}
module.exports={configuration,quoteShipping,authorizeShipping};
