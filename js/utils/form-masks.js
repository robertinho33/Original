// Remove receipts from the authorized test-data reset; keep purchases made after it.
(() => {
    const cutoff = Date.parse('2026-10-12T12:29:19.707Z');
    const marker = 'nefer-purchase-reset-2026-10-12T12:29:19.707Z';
    try {
        if (localStorage.getItem(marker) !== 'done') {
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith('nefer-tracking-') || ['aurea-cart', 'nefer-checkout-draft', 'nefer-last-confirmed-order', 'nefer-mp-pending-order', 'nefer-mp-checkout-attempt'].includes(key)) localStorage.removeItem(key);
            }
            localStorage.setItem(marker, 'done');
        }
    } catch {}
    try {
        for (const key of ['nefer-last-confirmed-order', 'nefer-mp-pending-order', 'nefer-mp-checkout-attempt']) {
            const raw = sessionStorage.getItem(key);
            if (!raw) continue;
            let value;
            try { value = JSON.parse(raw); } catch { sessionStorage.removeItem(key); continue; }
            if (!Number.isFinite(Number(value?.savedAt ?? value?.createdAt)) || Number(value?.savedAt ?? value?.createdAt) <= cutoff) sessionStorage.removeItem(key);
        }
    } catch {}
})();

(() => {
    'use strict';
    const digits = value => String(value || '').replace(/\D/g, '');
    const phone = value => {
        let d = digits(value);
        const international = d.length > 11 && d.startsWith('55');
        if (international) d = d.slice(2);
        d = d.slice(0, 11);
        const local = d.length > 10 ? 5 : 4;
        let text = d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2, 2 + local)}` : d;
        if (d.length > 2 + local) text += '-' + d.slice(2 + local);
        return (international ? '+55 ' : '') + text;
    };
    const cpf = value => digits(value).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
    const cnpj = value => digits(value).slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2').replace(/(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2').replace(/(\/\d{4})(\d)/, '$1-$2');
    const formats = { phone, cpf, cnpj,
        document: value => digits(value).length > 11 ? cnpj(value) : cpf(value),
        cep: value => digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'),
        uf: value => String(value).replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase() };
    function kind(input) {
        if (input.dataset.mask) return input.dataset.mask;
        const key = `${input.name || ''} ${input.id || ''}`.toLowerCase();
        if (/pixkey|pixchave|coupon|sku|password|token/.test(key)) return null;
        if (/phone|telefone|whatsapp/.test(key) && input.type !== 'checkbox') return 'phone';
        if (/cnpj/.test(key) && /cpf/.test(key)) return 'document';
        if (/cnpj/.test(key)) return 'cnpj';
        if (/cpf/.test(key)) return 'cpf';
        if (/\bcep\b|postalcode|zipcode/.test(key)) return 'cep';
        if (/^(state|uf)\s|\s(state|uf)$/.test(key)) return 'uf';
        return null;
    }
    function setup(input) {
        if (input.readOnly || input.type === 'hidden') return;
        const mask = kind(input);
        if (formats[mask]) {
            input.inputMode = mask === 'uf' ? 'text' : 'numeric';
            input.value = formats[mask](input.value);
            const patterns = { phone: '(\\+55 )?\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}', cpf: '[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}',
                cnpj: '[0-9]{2}\\.[0-9]{3}\\.[0-9]{3}/[0-9]{4}-[0-9]{2}', cep: '[0-9]{5}-[0-9]{3}', uf: '[A-Z]{2}' };
            if (patterns[mask]) input.pattern = patterns[mask];
            input.title = { phone: 'Informe DDD e telefone completo.', cpf: 'Informe os 11 dígitos do CPF.', cnpj: 'Informe os 14 dígitos do CNPJ.', cep: 'Informe os 8 dígitos do CEP.', uf: 'Informe a sigla do estado com duas letras.' }[mask] || '';
        }
        if (input.type === 'number') input.inputMode = Number(input.step) > 0 && Number(input.step) < 1 ? 'decimal' : 'numeric';
    }
    function scan(root) {
        if (root.matches?.('input')) setup(root);
        root.querySelectorAll?.('input').forEach(setup);
    }
    document.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || event.isComposing || input.readOnly) return;
        const mask = kind(input);
        if (!formats[mask]) return;
        const position = input.selectionStart;
        const before = input.value;
        const trailingDigits = position === null ? 0 : digits(before.slice(position)).length;
        input.value = formats[mask](before);
        if (position !== null && document.activeElement === input) {
            let cursor = input.value.length;
            let remaining = trailingDigits;
            while (cursor > 0 && remaining > 0) if (/\d/.test(input.value[--cursor])) remaining--;
            input.setSelectionRange(cursor, cursor);
        }
    }, true);
    scan(document);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(scan)))
        .observe(document.documentElement, { childList: true, subtree: true });
})();
