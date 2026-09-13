'use strict';

/**
 * Formata valores numéricos para moeda brasileira.
 */
export function formatCurrency(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 'R$ 0,00';
    }

    return number.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}
