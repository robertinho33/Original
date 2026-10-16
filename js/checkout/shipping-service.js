export async function consultarDisponibilidadeEntrega() {
    const response = await fetch('/api/shipping/configuration', {cache:'no-store',signal:AbortSignal.timeout(15000)});
    const result = await response.json().catch(()=>null);
    if (!response.ok || typeof result?.enabled !== 'boolean') throw new Error('Não foi possível verificar a entrega agora.');
    return result;
}

export async function calcularFretePorCEP(cepDestino, itensCarrinho) {
    const response = await fetch('/api/shipping/quote', {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cep:cepDestino,items:itensCarrinho.map(item=>({sku:item.sku,quantity:item.quantity}))}),
        signal:AbortSignal.timeout(30000)
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok || !result.success || !Array.isArray(result.data?.options)) {
        const error = new Error(result.message || result.error?.message || 'Não foi possível calcular a entrega. Tente novamente ou fale com nosso atendimento.');
        error.code = result.code || '';
        throw error;
    }
    return result.data;
}
