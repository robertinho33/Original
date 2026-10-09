const API_ROOT = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? '' : 'https://aurea-pix-api.onrender.com';
const API = `${API_ROOT}/api/payments/mercado-pago`;

export async function configureCardCheckout() {
    const card = document.querySelector('input[name="paymentMethod"][value="card"]');
    if (!card) return;
    card.disabled = true;
    const content = card.closest('label')?.querySelector('.choice-content');
    try {
        const response = await fetch(`${API}/configuration`, {
            headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000)
        });
        const result = await response.json();
        const testPreview = new URLSearchParams(window.location.search).get('mp_test') === '1';
        if (!response.ok || !result.enabled || (result.testMode && !testPreview)) throw new Error();
        card.disabled = false;
        content.querySelector('strong').textContent = result.testMode ? 'Cartão — ambiente de teste' : 'Cartão de crédito';
        content.querySelector('small').textContent = result.testMode
            ? 'Simulação no Mercado Pago. Use somente uma conta compradora e cartões de teste.'
            : 'Pague no Mercado Pago. Débito virtual Caixa quando disponível. Confira as condições antes de pagar.';
    } catch {
        if (content) content.querySelector('small').textContent = 'Pagamento com cartão temporariamente indisponível.';
        if (card.checked) document.querySelector('input[name="paymentMethod"][value="pix"]')?.click();
    }
}

export async function startCardCheckout(order) {
    const payload = {
        items: order.items.map(item => ({ sku: item.sku, quantity: item.quantity })),
        customer: order.customer, address: order.delivery?.address || null,
        deliveryMethod: order.delivery?.method || 'delivery', coupon: order.coupon || null
    };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    const key = 'nefer-mp-checkout-attempt';
    let attempt;
    try { attempt = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
    if (!attempt || attempt.fingerprint !== fingerprint || Date.now() - attempt.createdAt > 30 * 60 * 1000) {
        attempt = { fingerprint, id: crypto.randomUUID(), createdAt: Date.now() };
        sessionStorage.setItem(key, JSON.stringify(attempt));
    }
    const response = await fetch(`${API}/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, checkoutAttemptId: attempt.id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Não foi possível abrir o pagamento com cartão.');
    const data = result.data;
    const url = new URL(data.checkoutUrl);
    if (url.protocol !== 'https:' || !['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'].includes(url.hostname)) throw new Error('Destino de pagamento inválido.');
    if (!/^[a-f0-9]{64}$/i.test(data.trackingToken || '')) throw new Error('Resposta de pagamento inválida.');
    sessionStorage.setItem('nefer-mp-pending-order', JSON.stringify({
        orderNumber: data.orderNumber, trackingToken: data.trackingToken, testMode: data.testMode, savedAt: Date.now()
    }));
    // Conservar sacola e rascunho: redirecionamento não comprova pagamento.
    window.location.assign(url.href);
}
