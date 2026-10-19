const API_ROOT = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? '' : 'https://aurea-pix-api.onrender.com';
const API = `${API_ROOT}/api/payments/mercado-pago`;
let embeddedPixEnabled = false;

export function showPendingCardOrder() {
    const heading = document.querySelector('.checkout-heading');
    if (!heading) return;
    document.getElementById('pendingCardOrder')?.remove();
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem('nefer-mp-pending-order') || 'null'); } catch { return; }
    if (!pending || !/^AUR-[A-F0-9]{16}$/.test(pending.orderNumber || '') ||
        !/^[a-f0-9]{64}$/i.test(pending.trackingToken || '') ||
        !Number.isFinite(pending.savedAt) || Date.now() - pending.savedAt > 7 * 86400000) return;
    const notice = document.createElement('p');
    notice.id = 'pendingCardOrder';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Você já iniciou um pagamento. Confira o pedido antes de tentar novamente. ';
    const link = document.createElement('a');
    link.href = `rastrear-pedido.html?mp_resume=1${pending.testMode ? '&mp_test=1' : ''}#token=${pending.trackingToken}`;
    link.textContent = 'Consultar meu pedido';
    notice.append(link);
    heading.append(notice);
}

export async function configureCardCheckout() {
    const choices = ['card', 'pix', 'boleto'].map(method => document.querySelector('input[name="paymentMethod"][value="' + method + '"]')).filter(Boolean);
    choices.forEach(input => { input.disabled = true; });
    let retry = document.getElementById('retryCardConfiguration');
    if (!retry && choices.length) {
        retry = document.createElement('button'); retry.id = 'retryCardConfiguration'; retry.type = 'button';
        retry.textContent = 'Verificar pagamento novamente';
        retry.addEventListener('click', () => configureCardCheckout()); choices[0].closest('label')?.after(retry);
    }
    if (retry) retry.hidden = true;
    try {
        const response = await fetch(API + '/configuration', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
        const result = await response.json();
        embeddedPixEnabled = result.embeddedPix === true;
        const preview = new URLSearchParams(window.location.search).get('mp_test') === '1';
        const livePreview = new URLSearchParams(window.location.search).get('mp_live_test') === '1';
        if (result.previewOnly && !livePreview) throw new Error();
        if (!response.ok || !result.enabled || (result.testMode && !preview)) throw new Error();
        for (const input of choices) {
            input.disabled = false;
            const content = input.closest('label')?.querySelector('.choice-content');
            if (content) {
                content.querySelector('strong').textContent = ({ pix: 'PIX', card: 'Cartão', boleto: 'Boleto bancário' }[input.value]) + (result.testMode ? ' — ambiente de teste' : '');
                content.querySelector('small').textContent = result.testMode ? 'Simulação no Mercado Pago. Nenhum estoque real será descontado.' : (input.value === 'card' ? 'Crédito e débito virtual Caixa, quando disponível. Você pode escolher outra forma no Mercado Pago.' : input.value === 'boleto' ? 'Gere o boleto no Mercado Pago. A liberação depende da confirmação do pagamento.' : (embeddedPixEnabled ? 'QR Code e código PIX aqui na loja. Após a confirmação, acompanhe sua entrega automaticamente.' : 'Escolha PIX no Mercado Pago. Você pode trocar a forma antes de pagar.'));
            }
        }
    } catch {
        if (retry) retry.hidden = false;
        choices.forEach(input => {
            const small = input.closest('label')?.querySelector('small');
            if (small) small.textContent = 'Pagamento temporariamente indisponível.';
        });
        if (choices.some(input => input.checked)) document.querySelector('input[name="paymentMethod"][value="cash"]')?.click();
    }
}

export async function startCardCheckout(order) {
    const payload = {
        items: order.items.map(item => ({ sku: item.sku, quantity: item.quantity })),
        customer: order.customer, address: order.delivery?.address || null, shippingSelection: order.shippingSelection,
        paymentMethod: order.payment.method, deliveryMethod: order.delivery?.method || 'delivery', coupon: order.coupon || null, notes: order.notes || '',
        ...(order.payment.method === 'pix' && embeddedPixEnabled ? {checkoutExperience: 'embedded_pix'} : {})
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
    if (!response.ok || !result.success) {
        // A failed preparation can belong to a newer order than the previous banner.
        const current = result.code === 'CHECKOUT_PREFERENCE_REVIEW' ? result.data : null;
        if (current && /^AUR-[A-F0-9]{16}$/.test(current.orderNumber || '') && /^[a-f0-9]{64}$/i.test(current.trackingToken || '')) {
            sessionStorage.setItem('nefer-mp-pending-order', JSON.stringify({
                orderNumber: current.orderNumber, trackingToken: current.trackingToken,
                testMode: current.testMode === true, savedAt: Date.now()
            }));
            showPendingCardOrder();
        }
        // Never rotate the attempt automatically after an uncertain payment result.
        throw new Error(result.message || 'Não foi possível abrir o pagamento.');
    }
    const data = result.data;
    if (!data || !/^AUR-[A-F0-9]{16}$/.test(data.orderNumber || '')) throw new Error('Resposta de pagamento inválida.');
    if (!/^[a-f0-9]{64}$/i.test(data.trackingToken || '')) throw new Error('Resposta de pagamento inválida.');
    sessionStorage.setItem('nefer-mp-pending-order', JSON.stringify({
        orderNumber: data.orderNumber, trackingToken: data.trackingToken, testMode: data.testMode, savedAt: Date.now()
    }));
    try { localStorage.setItem('nefer-tracking-' + data.orderNumber, data.trackingToken); } catch {}
    // Conservar sacola e rascunho: redirecionamento não comprova pagamento.
    if (data.kind === 'embedded_pix' && order.payment.method === 'pix') {
        window.location.assign('./pagar-pix.html' + (data.testMode ? '?mp_test=1' : '') + '#token=' + encodeURIComponent(data.trackingToken));
        return;
    }
    const url = new URL(data.checkoutUrl);
    if (url.protocol !== 'https:' || !['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'].includes(url.hostname)) throw new Error('Destino de pagamento inválido.');
    window.location.assign(url.href);
}
