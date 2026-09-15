'use strict';

export function createEmailUrl({
    email,
    subject,
    body
}) {

    const address =
        String(email || '').trim();

    if (!address) {
        throw new Error(
            'O cliente não possui e-mail cadastrado.'
        );
    }

    const encodedSubject =
        encodeURIComponent(String(subject || ''));

    const encodedBody =
        encodeURIComponent(String(body || ''));

    return [
        `mailto:${address}`,
        `?subject=${encodedSubject}`,
        `&body=${encodedBody}`
    ].join('');
}


export function openEmail({
    email,
    subject,
    body
}) {

    const url =
        createEmailUrl({
            email,
            subject,
            body
        });

    window.location.href = url;

    return url;
}
