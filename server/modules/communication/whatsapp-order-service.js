'use strict';

function getConfiguration() {
  const accessToken = String(process.env.NEFER_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.NEFER_WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const templateName = String(process.env.NEFER_WHATSAPP_ORDER_TEMPLATE || '').trim();
  const language = String(process.env.NEFER_WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR').trim();
  const apiVersion = String(process.env.NEFER_WHATSAPP_GRAPH_API_VERSION || '').trim();
  if (!accessToken || !/^\d+$/.test(phoneNumberId) || !/^[a-z0-9_]+$/.test(templateName) || !/^v\d+\.\d+$/.test(apiVersion)) return null;
  let storeUrl;
  try {
    storeUrl = new URL(process.env.PUBLIC_STORE_URL || 'https://www.fiosperfeitos.com.br');
    if (storeUrl.protocol !== 'https:' || storeUrl.username || storeUrl.password || storeUrl.search || storeUrl.hash) return null;
  } catch { return null; }
  return { accessToken, phoneNumberId, templateName, language, apiVersion, storeUrl };
}

function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if ([12, 13].includes(digits.length) && digits.startsWith('55')) digits = digits.slice(2);
  if (!/^[1-9]\d{9,10}$/.test(digits)) return '';
  return '55' + digits;
}

function singleLine(value, max = 256) {
  return String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function sendOrderWhatsApp(order) {
  if (order?.customer?.whatsappOptIn !== true) return { sent: false, reason: 'customer_opt_out' };
  const configuration = getConfiguration();
  if (!configuration) return { sent: false, reason: 'not_configured' };
  const recipient = normalizePhone(order.customer.phone || order.customer.whatsapp);
  if (!recipient) return { sent: false, reason: 'invalid_customer_phone' };
  // Nunca utilizar número temporário do navegador nem enviar um link sem segredo válido.
  const orderNumber = String(order.orderNumber || '');
  if (!/^AUR-[A-Z0-9]{4,24}$/.test(orderNumber) || !/^[a-f0-9]{64}$/i.test(order.publicTrackingToken || '') || !order.id) {
    return { sent: false, reason: 'invalid_persisted_order' };
  }
  const trackingUrl = new URL('/pages/rastrear-pedido.html', configuration.storeUrl);
  trackingUrl.hash = 'token=' + order.publicTrackingToken;
  const details = `Recebemos seu pedido *${orderNumber}*. Aguardando confirmação de pagamento. Acompanhe pelo seu link privado: ${trackingUrl.href}`;
  // Não truncar a confirmação: isso poderia inutilizar o link privado.
  if (details.length > 1024) return { sent: false, reason: 'invalid_message_length' };
  try {
    const response = await fetch(`https://graph.facebook.com/${configuration.apiVersion}/${configuration.phoneNumberId}/messages`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${configuration.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient, type: 'template',
        template: {
          name: configuration.templateName, language: { code: configuration.language },
          components: [{ type: 'body', parameters: [
            { type: 'text', text: singleLine(order.customer.name) || 'cliente' },
            { type: 'text', text: details }
          ] }]
        }
      })
    });
    const result = await response.json().catch(() => ({}));
    const messageId = result.messages?.[0]?.id;
    if (!response.ok || typeof messageId !== 'string' || !messageId) {
      // Não registrar corpo do provedor, telefone ou token privado nos logs.
      console.warn('[WHATSAPP] Confirmação recusada pelo provedor:', orderNumber, response.status);
      return { sent: false, reason: 'provider_error' };
    }
    // Aceite da API não comprova entrega ao aparelho do cliente.
    return { sent: true, status: 'accepted', messageId };
  } catch {
    // Falha/timeout não invalida a compra e não provoca reenvio automático duplicado.
    console.warn('[WHATSAPP] Não foi possível encaminhar a confirmação:', orderNumber);
    return { sent: false, reason: 'provider_unavailable' };
  }
}

module.exports = { sendOrderWhatsApp };
