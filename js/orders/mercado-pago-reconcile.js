const API_ROOT = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? '' : 'https://aurea-pix-api.onrender.com';

export async function reconcileReturnedPayment(token) {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const paymentId = hash.get('payment_id') || query.get('payment_id');
    if (!/^[a-f0-9]{64}$/i.test(token) || !/^\d{1,24}$/.test(paymentId || '')) return;
    // Ignorar status/collection_status do retorno: o servidor consulta a API oficial.
    const response = await fetch(`${API_ROOT}/api/payments/mercado-pago/reconcile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentId }), signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) console.info('[TRACKING] Conferência direta indisponível; consultando o status registrado.');
}
