const params = new URLSearchParams(location.search);
const token = new URLSearchParams(location.hash.slice(1)).get('token');
if (params.get('mp_resume') === '1' && /^[a-f0-9]{64}$/i.test(token || '')) {
    const section = document.createElement('section');
    section.className = 'tracking-card';
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.textContent = 'Confira o pagamento anterior e retome este mesmo pedido, se ainda não estiver pago.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-link';
    button.textContent = 'Retomar pagamento com cartão';
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
    section.append(message, button, expire);
    document.querySelector('main')?.append(section);
}
