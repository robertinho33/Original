const subjects = Object.freeze({
  duvida: 'Dúvida antes de comprar',
  entrega: 'Entrega ou acompanhamento',
  cancelamento: 'Cancelamento do pedido',
  arrependimento: 'Devolução por arrependimento',
  problema: 'Produto com defeito, avaria ou diferente',
  privacidade: 'Privacidade e meus dados'
});

export function safeOrderNumber(value) {
  const number = String(value || '').trim();
  return /^[a-z0-9-]{1,50}$/i.test(number) ? number : '';
}

export function prepareSupportMessage({ subject, order, details }) {
  if (!Object.hasOwn(subjects, subject)) throw new Error('Escolha um assunto para preparar a mensagem.');
  const title = subjects[subject];
  const number = safeOrderNumber(order);
  const message = String(details || '').trim().slice(0, 600);
  return ['Olá, equipe Fios Perfeitos!', 'Assunto: ' + title,
    ...(number ? ['Pedido: ' + number] : []),
    ...(message ? ['', message] : [])].join('\n');
}

export function initializeSupport(doc = document, location = window.location) {
  const form = doc.getElementById('supportForm');
  if (!form) return;
  const order = doc.getElementById('supportOrder');
  const params = new URLSearchParams(location.hash.slice(1));
  order.value = safeOrderNumber(params.get('pedido'));
  // This page only prepares a message. Sending requires a deliberate action in WhatsApp.
  form.addEventListener('submit', event => {
    event.preventDefault();
    const status = doc.getElementById('supportStatus');
    try {
      const base = new URL(doc.getElementById('supportDirect').href);
      if (base.origin !== 'https://wa.me' || !/^\/\d{12,13}$/.test(base.pathname)) {
        throw new Error('Use o contato da loja informado nesta página.');
      }
      const message = prepareSupportMessage({
        subject: doc.getElementById('supportSubject').value,
        order: order.value,
        details: doc.getElementById('supportDetails').value
      });
      base.search = '';
      base.hash = '';
      base.searchParams.set('text', message);
      doc.getElementById('supportMessage').value = message;
      doc.getElementById('supportContinue').href = base.href;
      doc.getElementById('supportPreview').hidden = false;
      status.textContent = 'Mensagem preparada. Confira e continue no WhatsApp para enviá-la.';
      doc.getElementById('supportContinue').focus();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  form.addEventListener('input', () => {
    doc.getElementById('supportPreview').hidden = true;
    doc.getElementById('supportContinue').removeAttribute('href');
    doc.getElementById('supportStatus').textContent = '';
  });
}

if (typeof document !== 'undefined') initializeSupport();
