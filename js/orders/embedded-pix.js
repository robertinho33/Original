import {readPaymentReturn} from './payment-return.js';
const {token, query} = readPaymentReturn(location);
const API_ROOT = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : 'https://aurea-pix-api.onrender.com';
const elements = Object.fromEntries(['pixStatus', 'pixDetails', 'pixOrderNumber', 'pixAmount', 'pixCodePanel', 'pixImage', 'pixExpiry', 'pixCode', 'copyPixCode', 'pixCopyFeedback', 'checkPixStatus', 'pixTrackingLink'].map(id => [id, document.getElementById(id)]));
let timer, checking = false, finished = false;
const testMode = query.get('mp_test') === '1';
const trackingUrl = './rastrear-pedido.html' + (testMode ? '?mp_test=1' : '') + '#token=' + encodeURIComponent(token);
function stop() { finished = true; clearTimeout(timer); }
async function checkPayment() {
  if (checking || finished) return;
  clearTimeout(timer); checking = true; elements.checkPixStatus.disabled = true;
  try {
    const response = await fetch(API_ROOT + '/api/payments/mercado-pago/pix/status', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token}),
      signal: AbortSignal.timeout(20000), cache: 'no-store'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw Error(result.message || 'Não foi possível conferir o pagamento agora. A consulta será repetida.');
    const data = result.data;
    if (data.paymentStatus === 'paid') {
      stop(); elements.pixCodePanel.hidden = true;
      elements.pixStatus.textContent = 'Pagamento confirmado! Abrindo o acompanhamento da entrega…';
      location.replace(trackingUrl); return;
    }
    elements.pixDetails.hidden = false;
    elements.pixOrderNumber.textContent = 'Pedido ' + data.orderNumber;
    elements.pixAmount.textContent = Number(data.total).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    elements.pixTrackingLink.href = trackingUrl; elements.pixTrackingLink.hidden = false;
    if (['failed', 'cancelled', 'expired', 'refunded', 'chargeback'].includes(data.paymentStatus)) {
      stop(); elements.pixCodePanel.hidden = true;
      elements.pixStatus.textContent = 'Este pagamento foi encerrado ou atualizado. Consulte o acompanhamento antes de tentar pagar novamente.'; return;
    }
    const pix = data.pix;
    if (!pix || !pix.qrCode || !/^[A-Za-z0-9+/=]+$/.test(pix.qrCodeBase64 || '')) throw Error('O QR Code não está disponível. Consulte o acompanhamento do pedido.');
    if (Date.parse(pix.expiresAt) <= Date.now()) {
      elements.pixCodePanel.hidden = true;
      elements.pixStatus.textContent = 'O prazo deste QR Code terminou. Estamos conferindo a confirmação. Consulte o acompanhamento antes de iniciar outro pagamento.'; return;
    }
    elements.pixImage.src = 'data:image/png;base64,' + pix.qrCodeBase64;
    elements.pixCode.value = pix.qrCode;
    elements.pixExpiry.textContent = 'Válido até ' + new Date(pix.expiresAt).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
    elements.pixCodePanel.hidden = false;
    elements.pixStatus.textContent = 'Aguardando confirmação do PIX. Esta tela será atualizada automaticamente.';
  } catch (error) { elements.pixStatus.textContent = error.message || 'Não foi possível consultar a confirmação agora.'; }
  finally { checking = false; elements.checkPixStatus.disabled = finished; if (!finished) timer = setTimeout(checkPayment, 8000); }
}
elements.copyPixCode.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(elements.pixCode.value); elements.pixCopyFeedback.textContent = 'Código PIX copiado.'; }
  catch { elements.pixCode.focus(); elements.pixCode.select(); elements.pixCopyFeedback.textContent = 'Selecione e copie o código acima.'; }
});
elements.checkPixStatus.addEventListener('click', checkPayment);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !finished) void checkPayment(); });
window.addEventListener('pagehide', () => { clearTimeout(timer); });
if (/^[a-f0-9]{64}$/i.test(token || '')) void checkPayment();
else { stop(); elements.pixStatus.textContent = 'Use o link privado do pedido para acessar o pagamento PIX.'; }
