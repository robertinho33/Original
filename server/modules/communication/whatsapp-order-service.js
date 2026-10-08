'use strict';

function getConfiguration() {
  const accessToken = String(process.env.NEFER_WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(process.env.NEFER_WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const templateName = String(process.env.NEFER_WHATSAPP_ORDER_TEMPLATE || '').trim();
  const language = String(process.env.NEFER_WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR').trim();
  const apiVersion = String(process.env.NEFER_WHATSAPP_GRAPH_API_VERSION || '').trim();

  if (!accessToken || !phoneNumberId || !templateName || !apiVersion) {
    return null;
  }

  return { accessToken, phoneNumberId, templateName, language, apiVersion };
}

function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && [12, 13].includes(digits.length)) {
    return digits;
  }
  if ([10, 11].includes(digits.length)) {
    return `55${digits}`;
  }
  return '';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);
}

function buildOrderDetails(order) {
  const items = (Array.isArray(order.items) ? order.items : [])
    .map(item => `- ${Number(item.quantity) || 1}x ${item.name || item.sku || 'Produto'}`)
    .join('\n');
  const total = order.totals?.total ?? order.total;
  const shippingMethod = order.shipping?.method || order.deliveryMethod || '';
  const paymentMethod = order.payment?.method || 'a combinar';
  const trackingUrl = order.publicTrackingToken
    ? `${String(process.env.PUBLIC_STORE_URL || 'https://www.fiosperfeitos.com.br').replace(/\/$/, '')}/pages/rastrear-pedido.html?pedido=${encodeURIComponent(order.orderNumber || order.id || '')}&token=${encodeURIComponent(order.publicTrackingToken)}`
    : '';

  return [
    `Pedido: ${order.orderNumber || order.id || 'N/A'}`,
    items ? `Itens:\n${items}` : '',
    `Subtotal: ${formatCurrency(order.totals?.subtotal ?? order.subtotal)}`,
    `Frete: ${formatCurrency(order.totals?.shipping ?? order.shipping?.cost ?? order.shipping)}`,
    `Total: ${formatCurrency(total)}`,
    `Pagamento: ${paymentMethod}`,
    shippingMethod ? `Entrega: ${shippingMethod === 'pickup' ? 'Retirada' : 'Entrega'}` : '',
    order.coupon?.code ? `Cupom: ${order.coupon.code}` : '',
    trackingUrl ? `Acompanhe: ${trackingUrl}` : ''
  ].filter(Boolean).join('\n');
}

async function sendOrderWhatsApp(order) {
  if (order.customer?.whatsappOptIn !== true) {
    return { sent: false, reason: 'customer_opt_out' };
  }

  const configuration = getConfiguration();
  if (!configuration) {
    return { sent: false, reason: 'not_configured' };
  }

  const recipient = normalizePhone(order.customer?.phone || order.customer?.whatsapp);
  if (!recipient) {
    return { sent: false, reason: 'invalid_customer_phone' };
  }

  const url = `https://graph.facebook.com/${configuration.apiVersion}/${configuration.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${configuration.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: configuration.templateName,
        language: { code: configuration.language },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: String(order.customer?.name || 'cliente').slice(0, 256) },
            { type: 'text', text: buildOrderDetails(order).slice(0, 1024) }
          ]
        }]
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = result.error?.message || `HTTP ${response.status}`;
    console.error('[WHATSAPP] Failed to send order confirmation:', order.orderNumber, providerMessage);
    return { sent: false, reason: 'provider_error' };
  }

  return {
    sent: true,
    messageId: result.messages?.[0]?.id || null
  };
}

module.exports = { sendOrderWhatsApp };
