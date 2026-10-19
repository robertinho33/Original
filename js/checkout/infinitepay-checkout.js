const root = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://aurea-pix-api.onrender.com';
const API = `${root}/api/payments/infinitepay`;
const pendingKey = 'fios-infinitepay-pending';
const attemptKey = 'fios-infinitepay-attempt';
export function checkoutUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.infinitepay.io' || url.username || url.password || url.port) throw new Error('Destino de pagamento inválido.');
    return url.href;
}
export async function configureInfinitePay() {
    showPending();
    const input = document.querySelector('input[name="paymentMethod"][value="infinitepay"]');
    if (!input) return;
    const label = input.closest('label');
    const description = label.querySelector('small');
    let retry = document.getElementById('retryInfinitePay');
    if (!retry) {
        retry = document.createElement('button'); retry.id = 'retryInfinitePay'; retry.type = 'button';
        retry.textContent = 'Verificar pagamento novamente'; retry.addEventListener('click', configureInfinitePay);
        label.after(retry);
    }
    retry.hidden = true;
    input.disabled = true;
    if (description) description.textContent = 'Verificando pagamento na InfinitePay…';
    try {
        const response = await fetch(API + '/configuration', { signal: AbortSignal.timeout(60000) });
        const result = await response.json();
        if (!response.ok || result.enabled !== true) throw new Error('Pagamento indisponível.');
        input.disabled = false;
        if (description) description.textContent = 'Escolha PIX ou cartão no ambiente seguro da InfinitePay.';
        const selected = document.querySelector('input[name="paymentMethod"]:checked');
        if (!selected || selected.disabled) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
    } catch {
        retry.hidden = false;
        if (description) description.textContent = 'Pagamento temporariamente indisponível. Tente verificar novamente em instantes.';
    }
}
function read(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
function showPending() {
    const pending = read(pendingKey);
    if (!pending || !/^AUR-[A-F0-9]{16}$/.test(pending.orderNumber) || !/^[a-f0-9]{64}$/i.test(pending.trackingToken)) return;
    const heading = document.querySelector('.checkout-heading');
    if (!heading) return;
    document.getElementById('infinitepayPending')?.remove();
    const notice = document.createElement('p'); notice.id = 'infinitepayPending'; notice.setAttribute('role', 'status');
    notice.textContent = 'Você iniciou um pagamento pela InfinitePay. ';
    const link = document.createElement('a'); link.textContent = 'Consultar meu pedido';
    link.href = `rastrear-pedido.html#token=${pending.trackingToken}`;
    notice.append(link); heading.append(notice);
}
async function post(path, body) {
    const response = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    const result = await response.json().catch(() => ({}));
    if (result.data?.trackingToken && /^AUR-[A-F0-9]{16}$/.test(result.data.orderNumber) && /^[a-f0-9]{64}$/i.test(result.data.trackingToken)) {
        sessionStorage.setItem(pendingKey, JSON.stringify(result.data)); showPending();
    }
    if (!response.ok || !result.success) {
        if (response.status === 400 && !result.data) sessionStorage.removeItem(attemptKey);
        throw new Error(result.message || 'Não foi possível abrir a InfinitePay. Consulte seu pedido antes de tentar novamente.');
    }
    return result.data;
}
export async function startInfinitePay(order) {
    const pending = read(pendingKey);
    if (pending) {
        const result = await post('/resume', { orderNumber: pending.orderNumber, token: pending.trackingToken });
        if (result.paymentStatus === 'pending') {
            if (result.checkoutUrl) { location.assign(checkoutUrl(result.checkoutUrl)); return; }
            throw new Error('O pagamento anterior precisa de conferência. Consulte o acompanhamento e fale com a loja.');
        }
        sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(attemptKey);
    }
    const payload = { items: order.items.map(item => ({ sku: item.sku, quantity: item.quantity })), customer: order.customer,
        address: order.delivery?.address || null, deliveryMethod: order.delivery?.method || 'delivery',
        shippingSelection: order.shippingSelection, coupon: order.coupon || null, notes: order.notes || '' };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    let attempt = read(attemptKey);
    // Preserve the attempt after a timeout, including when the customer changes the form.
    if (attempt && attempt.fingerprint !== fingerprint) throw new Error('Há uma tentativa anterior sem confirmação. Restaure os dados anteriores ou fale com a loja antes de iniciar outro pagamento.');
    if (!attempt) { attempt = { id: crypto.randomUUID(), fingerprint }; sessionStorage.setItem(attemptKey, JSON.stringify(attempt)); }
    const data = await post('/checkout', { ...payload, checkoutAttemptId: attempt.id });
    if (!/^AUR-[A-F0-9]{16}$/.test(data?.orderNumber || '') || !/^[a-f0-9]{64}$/i.test(data?.trackingToken || '')) throw new Error('Resposta de pagamento inválida.');
    location.assign(checkoutUrl(data.checkoutUrl));
}
