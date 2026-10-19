import { checkoutUrl } from '../checkout/infinitepay-checkout.js';
const root = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://aurea-pix-api.onrender.com';
const params = new URLSearchParams(location.search);
const token = new URLSearchParams(location.hash.slice(1)).get('token');
let confirmation = null;
function message(text) {
    let notice = document.getElementById('infinitepayStatus');
    if (!notice) { notice = document.createElement('p'); notice.id = 'infinitepayStatus'; notice.setAttribute('role', 'status'); document.querySelector('main')?.prepend(notice); }
    notice.textContent = text;
    return notice;
}
async function post(path, body) {
    const response = await fetch(`${root}/api/payments/infinitepay${path}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Não foi possível consultar o pagamento agora.');
    return result.data;
}
async function confirm() {
    try {
        message('Conferindo seu pagamento na InfinitePay…');
        const result = await post('/confirm', confirmation);
        if (result.paymentStatus === 'paid') {
            message('Pagamento confirmado. Atualize a consulta do pedido para ver o status.');
            sessionStorage.removeItem('fios-infinitepay-pending'); sessionStorage.removeItem('fios-infinitepay-attempt');
            location.reload();
        } else message('O pagamento ainda não foi confirmado. Consulte novamente em instantes.');
    } catch (err) {
        const notice = message(err.message + ' ');
        const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Conferir novamente';
        retry.addEventListener('click', confirm); notice.append(retry);
    }
}
if (params.get('infinitepay_return') === '1' && /^[a-f0-9]{64}$/i.test(token || '')) {
    confirmation = { token, order_nsu: params.get('order_nsu'), transaction_nsu: params.get('transaction_nsu'), slug: params.get('slug') };
    // Discard untrusted receipt URLs and payment details from browser history.
    history.replaceState(null, '', location.pathname + location.hash);
    void confirm();
}
document.addEventListener('nefer:tracking-loaded', event => {
    document.getElementById('infinitepayResume')?.remove();
    const order = event.detail;
    if (order.paymentProvider !== 'infinitepay' || order.paymentStatus !== 'pending') return;
    const button = document.createElement('button'); button.id = 'infinitepayResume'; button.type = 'button'; button.textContent = 'Continuar pagamento na InfinitePay';
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            const result = await post('/resume', { orderNumber: order.orderNumber || order.id, token: order.trackingToken });
            if (result.checkoutUrl) location.assign(checkoutUrl(result.checkoutUrl));
            else message(result.paymentStatus === 'paid' ? 'Pagamento confirmado. Atualize a consulta do pedido.' : 'O link não está mais disponível. Fale com a loja para conferir este pedido.');
        } catch (err) { message(err.message); } finally { button.disabled = false; }
    });
    document.getElementById('trackingResult')?.append(button);
});
