'use strict';

function normalizeWhatsAppPhone(phone) {

    let digits =
        String(phone || '')
            .replace(/\D/g, '');

    if (
        digits.length === 13 &&
        digits.startsWith('55')
    ) {
        digits = digits.slice(2);
    }

    if (digits.length !== 10 && digits.length !== 11) {
        throw new Error(
            'O telefone do cliente não é válido para WhatsApp.'
        );
    }

    return `55${digits}`;
}


export function createWhatsAppUrl({
    phone,
    message
}) {

    const normalizedPhone =
        normalizeWhatsAppPhone(phone);

    const encodedMessage =
        encodeURIComponent(String(message || ''));

    return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}


export function openWhatsApp({
    phone,
    message
}) {

    const url =
        createWhatsAppUrl({
            phone,
            message
        });

    window.open(
        url,
        '_blank',
        'noopener,noreferrer'
    );

    return url;
}
