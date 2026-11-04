const KEY = 'fios-infinitepay-pending';
const MAX_AGE = 30 * 86400000;
const apiRoot = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://aurea-pix-api.onrender.com';

export function savedPurchase() {
    for (const storage of [() => sessionStorage, () => localStorage]) {
        try {
            const value = JSON.parse(storage().getItem(KEY) || 'null');
            if (!/^AUR-[A-F0-9]{16}$/.test(value?.orderNumber || '') || !/^[a-f0-9]{64}$/i.test(value?.trackingToken || '')) continue;
            if (value.savedAt && (Date.now() - value.savedAt > MAX_AGE || value.savedAt > Date.now())) continue;
            return {orderNumber: value.orderNumber, trackingToken: value.trackingToken};
        } catch { /* Storage may be disabled on a shared or private device. */ }
    }
    return null;
}

export function mountPendingPurchase() {
    const purchase = savedPurchase();
    if (!purchase || document.getElementById('savedPurchase')) return;
    const panel = document.createElement('section'); panel.id = 'savedPurchase'; panel.className = 'saved-purchase';
    panel.setAttribute('aria-label', 'Retomar sua compra');
    const heading = document.createElement('h2'); heading.textContent = 'Sua compra está salva neste aparelho';
    const text = document.createElement('p'); text.textContent = 'Iniciou uma compra e ainda não pagou? Consulte o pedido ou continue o pagamento. Só o acompanhamento confirma se já foi pago.';
    const actions = document.createElement('div'); actions.className = 'saved-purchase-actions';
    const tracking = document.createElement('a'); tracking.className = 'saved-purchase-link'; tracking.textContent = 'Acessar meu pedido';
    tracking.href = '/pages/rastrear-pedido.html#token=' + purchase.trackingToken;
    const resume = document.createElement('button'); resume.type = 'button'; resume.textContent = 'Continuar pagamento';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copiar link do pedido';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    resume.addEventListener('click', async () => {
        resume.disabled = true; status.textContent = 'Conferindo o pagamento deste pedido…';
        try {
            const response = await fetch(apiRoot + '/api/payments/infinitepay/resume', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:purchase.orderNumber,token:purchase.trackingToken}),signal:AbortSignal.timeout(30000)});
            const result = await response.json();
            if (!response.ok || !result.success) throw Error(result.message || 'Não foi possível consultar agora. Abra seu pedido ou fale com a loja.');
            if (result.data.paymentStatus === 'paid') { location.assign(tracking.href); return; }
            if (!result.data.checkoutUrl) { status.textContent = 'O link de pagamento expirou ou precisa de conferência. Abra seu pedido e fale com a loja antes de iniciar outra compra.'; return; }
            const url = new URL(result.data.checkoutUrl);
            if (url.protocol !== 'https:' || url.hostname !== 'checkout.infinitepay.io' || url.username || url.password || url.port) throw Error('Link de pagamento inválido. Abra seu pedido para pedir ajuda.');
            location.assign(url.href);
        } catch (error) { status.textContent = error.message; }
        finally { resume.disabled = false; }
    });
    copy.addEventListener('click', async () => {
        const url = new URL(tracking.href, location.origin).href;
        try { await navigator.clipboard.writeText(url); status.textContent = 'Link privado copiado. Guarde para acessar sua compra novamente; compartilhe somente com quem pode acompanhar o pedido.'; }
        catch { status.textContent = 'Seu link privado: ' + url; }
    });
    const forget = document.createElement('button'); forget.type = 'button'; forget.className = 'saved-purchase-forget'; forget.textContent = 'Remover deste aparelho';
    forget.addEventListener('click', () => { for (const storage of [() => sessionStorage, () => localStorage]) try {storage().removeItem(KEY); storage().removeItem('nefer-tracking-' + purchase.orderNumber);} catch {} panel.remove(); });
    actions.append(tracking, resume, copy, forget); panel.append(heading, text, actions, status);
    document.querySelector('main')?.prepend(panel);
}
mountPendingPurchase();
