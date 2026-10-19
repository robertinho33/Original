import { readPaymentReturn } from './payment-return.js';
let { token } = readPaymentReturn(location);
{
    const section = document.createElement('section');
    section.className = 'tracking-card';
    section.id = 'trackingPaymentActions';
    const title = document.createElement('h2');
    title.textContent = 'Pagamento do pedido';
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.textContent = 'Você pode retomar este mesmo pedido e escolher cartão, PIX ou boleto no Mercado Pago, após conferir a tentativa anterior.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-link';
    button.textContent = 'Voltar às formas de pagamento';
    button.addEventListener('click', async () => {
        button.disabled = true;
        message.textContent = 'Conferindo seu pagamento no Mercado Pago…';
        try {
            const root = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://aurea-pix-api.onrender.com';
            const response = await fetch(`${root}/api/payments/mercado-pago/resume`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }), signal: AbortSignal.timeout(60000)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.message || 'Não foi possível conferir o pagamento. Tente novamente em um minuto.');
            if (result.data.kind === 'embedded_pix') {
                location.assign('./pagar-pix.html' + (params.get('mp_test') === '1' ? '?mp_test=1' : '') + '#token=' + encodeURIComponent(token));
                return;
            }
            if (!result.data.checkoutUrl) {
                message.textContent = 'O pagamento já possui uma confirmação. Atualize o acompanhamento para consultar o estado atual.';
                button.hidden = true;
                return;
            }
            const url = new URL(result.data.checkoutUrl);
            if (url.protocol !== 'https:' || !['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com.br', 'sandbox.mercadopago.com'].includes(url.hostname)) throw new Error('Destino de pagamento inválido.');
            location.assign(url.href);
        } catch (error) { message.textContent = error.message; button.disabled = false; }
    });
    const expire = document.createElement('button');
    expire.type = 'button';
    expire.textContent = 'Encerrar pedido expirado';
    expire.addEventListener('click', async () => {
        expire.disabled = true;
        button.disabled = true;
        message.textContent = 'Conferindo o prazo e os pagamentos antes de encerrar o pedido…';
        try {
            const root = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://aurea-pix-api.onrender.com';
            const response = await fetch(`${root}/api/payments/mercado-pago/expire`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }), signal: AbortSignal.timeout(90000)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.message || 'Não foi possível conferir o pedido agora.');
            message.textContent = result.paymentStatus === 'expired'
                ? 'Pedido expirado encerrado. O estoque reservado foi devolvido. Atualize o acompanhamento.'
                : 'O pedido possui uma atualização de pagamento. Consulte o acompanhamento.';
            button.hidden = true;
            expire.hidden = true;
        } catch (error) {
            message.textContent = error.message;
            expire.disabled = false;
            button.disabled = false;
        }
    });
    section.hidden = true;
    document.addEventListener('nefer:tracking-loading', () => { section.hidden = true; });
    document.addEventListener('nefer:tracking-loaded', event => {
        token = event.detail.trackingToken || '';
        const eligible = /^[a-f0-9]{64}$/i.test(token) && event.detail.paymentProvider === 'mercado-pago' &&
            ['pending', 'failed', 'cancelled', 'awaiting_payment'].includes(event.detail.paymentStatus);
        section.hidden = !eligible;
        button.hidden = !eligible;
        expire.hidden = !eligible;
        button.disabled = false;
        expire.disabled = false;
        if (eligible) message.textContent = 'Retome este mesmo pedido para escolher PIX, cartão ou boleto no Mercado Pago. A tentativa anterior será conferida antes de continuar.';
    });
    section.append(title, message, button, expire);
    const payment = document.getElementById('trackingPayment');
    if (payment) payment.after(section);
    else document.querySelector('main')?.append(section);
}
