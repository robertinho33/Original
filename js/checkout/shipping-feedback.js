export function shippingPrompt({cep,method,available,unavailableMessage}) {
    if(method==='pickup') return 'Retirada selecionada. Não há frete.';
    if(available===false) return unavailableMessage;
    return String(cep || '').replace(/\D/g,'').length===8
        ? 'CEP preenchido. Clique em Calcular entrega para consultar as opções.'
        : 'Informe seu CEP com 8 dígitos para consultar a entrega.';
}
export function shippingFailureMessage(code,message) {
    if(String(code || '').startsWith('SHIPPING_OAUTH_')) return 'A consulta de frete está temporariamente indisponível. Fale com nosso atendimento.';
    if(['SHIPPING_AUTH_FAILED','SHIPPING_ACCESS_DENIED'].includes(code)) return 'Não é necessário redigitar o CEP. O serviço de frete recusou o acesso da loja; fale com nosso atendimento.';
    return message || 'Não foi possível consultar a entrega. Tente novamente ou fale com nosso atendimento.';
}
