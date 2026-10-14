export async function calcularFretePorCEP(cepDestino, itensCarrinho) {
    const response = await fetch('/api/shipping/quote', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cep:cepDestino,items:itensCarrinho.map(item=>({sku:item.sku,quantity:item.quantity}))}),
        signal:AbortSignal.timeout(30000)
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok || !result.success || !Array.isArray(result.data?.options)) throw new Error(result.message || result.error?.message || 'Não foi possível calcular a entrega. Tente novamente ou fale com nosso atendimento.');
    return result.data;
}
