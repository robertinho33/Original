'use strict';

export function createPurchaseThankYouMessage({
    customerName,
    orderId,
    total
}) {
    const name =
        String(customerName || 'cliente').trim();

    const id =
        String(orderId || '').trim();

    const numericTotal =
        Number(total || 0);

    const totalText =
        Number.isFinite(numericTotal)
            ? numericTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            })
            : '';

    return [
        `Olá, ${name}!`,
        '',
        'Agradecemos pela sua compra na AURÉA COSMETICS.',
        '',
        id
            ? `Seu pedido ${id} foi recebido com sucesso.`
            : 'Seu pedido foi recebido com sucesso.',
        '',
        totalText
            ? `Valor do pedido: ${totalText}.`
            : '',
        '',
        'Muito obrigado pela confiança e por escolher a AURÉA.',
        '',
        'Esperamos que sua experiência seja especial. ✨'
    ]
        .filter(Boolean)
        .join('\n');
}


export function createPurchaseThankYouEmail({
    customerName,
    orderId,
    total
}) {
    return {
        subject: orderId
            ? `Obrigado pela sua compra — pedido ${orderId}`
            : 'Obrigado pela sua compra — AURÉA COSMETICS',

        body: createPurchaseThankYouMessage({
            customerName,
            orderId,
            total
        })
    };
}
