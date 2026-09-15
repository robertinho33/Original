'use strict';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

function normalizeUrl(value) {
    try {
        const url = new URL(value);

        url.hash = '';

        return url.href.replace(/\/+$/, '');
    } catch {
        return '';
    }
}

function absoluteUrl(value, baseUrl) {
    try {
        return normalizeUrl(
            new URL(value, baseUrl).href
        );
    } catch {
        return '';
    }
}

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept':
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow'
    });

    return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        text: await response.text()
    };
}

function decodeHtml(value) {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function unique(values) {
    return [...new Set(
        values
            .map(value => normalizeUrl(value))
            .filter(Boolean)
    )];
}

/* ============================================================
   ECOBELLE
   ============================================================ */

function isEcoBelleProductUrl(url) {
    const value = normalizeUrl(url);

    if (!value) {
        return false;
    }

    let parsed;

    try {
        parsed = new URL(value);
    } catch {
        return false;
    }

    if (parsed.hostname !== 'www.grupoecobelle.com.br') {
        return false;
    }

    const path = parsed.pathname.toLowerCase();

    if (
        path === '/produtos' ||
        path === '/linha-ecobelle/l' ||
        path === '/compre-por-linha/l' ||
        path === '/kits' ||
        path === '/condicionador' ||
        path === '/shampoo'
    ) {
        return false;
    }

    if (
        path.includes('/carrinho') ||
        path.includes('/checkout') ||
        path.includes('/login') ||
        path.includes('/conta') ||
        path.includes('/blog')
    ) {
        return false;
    }

    /*
     * A Yampi costuma expor produtos através de atributos
     * :product ou links diretos. Evitamos declarar como produto
     * qualquer URL genérica do site.
     */
    return (
        path.includes('/produto/') ||
        path.includes('/produtos/') ||
        /\/[a-z0-9-]+-\d{5,}$/i.test(path)
    );
}

function extractEcoBelleProductUrls(html, baseUrl) {
    const discovered = new Set();

    const text = String(html || '');

    /*
     * Links href.
     */
    const hrefRegex =
        /href\s*=\s*["']([^"']+)["']/gi;

    for (const match of text.matchAll(hrefRegex)) {
        const url = absoluteUrl(
            decodeHtml(match[1]),
            baseUrl
        );

        if (isEcoBelleProductUrl(url)) {
            discovered.add(url);
        }
    }

    /*
     * Yampi pode manter URLs em atributos :product.
     */
    const productAttributeRegex =
        /:product\s*=\s*["']([^"']+)["']/gi;

    for (const match of text.matchAll(productAttributeRegex)) {
        const url = absoluteUrl(
            decodeHtml(match[1]),
            baseUrl
        );

        if (isEcoBelleProductUrl(url)) {
            discovered.add(url);
        }
    }

    /*
     * JSON/HTML escapado.
     */
    const escapedUrlRegex =
        /https?:\\?\/\\?\/www\.grupoecobelle\.com\.br[^"'\\\s<]+/gi;

    for (const match of text.matchAll(escapedUrlRegex)) {
        const raw = match[0]
            .replace(/\\\//g, '/');

        const url = normalizeUrl(raw);

        if (isEcoBelleProductUrl(url)) {
            discovered.add(url);
        }
    }

    return [...discovered];
}

async function discoverEcoBelle() {
    const startPages = [
        'https://www.grupoecobelle.com.br/produtos',
        'https://www.grupoecobelle.com.br/linha-ecobelle/l',
        'https://www.grupoecobelle.com.br/compre-por-linha/l',
        'https://www.grupoecobelle.com.br/kits',
        'https://www.grupoecobelle.com.br/condicionador',
        'https://www.grupoecobelle.com.br/shampoo'
    ];

    const visited = new Set();
    const products = new Set();

    for (const page of startPages) {
        const normalized = normalizeUrl(page);

        if (!normalized || visited.has(normalized)) {
            continue;
        }

        visited.add(normalized);

        try {
            const result = await fetchHtml(normalized);

            if (!result.ok) {
                continue;
            }

            for (const url of extractEcoBelleProductUrls(
                result.text,
                result.url
            )) {
                products.add(url);
            }
        } catch {
            // mantém descoberta das demais páginas
        }
    }

    return {
        visitedPages: [...visited],
        productUrls: [...products]
    };
}


/* ============================================================
   INOVAX
   ============================================================ */

function isInovaxProductUrl(url) {
    const value = normalizeUrl(url);

    if (!value) {
        return false;
    }

    let parsed;

    try {
        parsed = new URL(value);
    } catch {
        return false;
    }

    if (
        parsed.hostname !==
        'loja.inovaxcosmeticos.com.br'
    ) {
        return false;
    }

    const path = parsed.pathname.toLowerCase();

    /*
     * Nunca aceitar endpoints de ação.
     */
    if (
        path.includes('/carrinho/') ||
        path.includes('/adicionar') ||
        path.includes('/checkout') ||
        path.includes('/login') ||
        path.includes('/minha-conta') ||
        path.includes('/conta/')
    ) {
        return false;
    }

    /*
     * Placeholder encontrado no Bloco 8.
     */
    if (
        path.includes('/none-') ||
        path.includes('produto_url') ||
        path.includes('--produto_url--')
    ) {
        return false;
    }

    /*
     * Padrão observado:
     * /mascara-23899526
     * /sabonete-23901477
     *
     * O identificador numérico no final é a característica
     * mais forte da URL de produto da plataforma.
     */
    return /^\/[a-z0-9][a-z0-9-]*-\d{6,}$/i.test(
        path
    );
}

function extractInovaxProductUrls(html, baseUrl) {
    const discovered = new Set();

    const text = String(html || '');

    const hrefRegex =
        /href\s*=\s*["']([^"']+)["']/gi;

    for (const match of text.matchAll(hrefRegex)) {
        const url = absoluteUrl(
            decodeHtml(match[1]),
            baseUrl
        );

        if (isInovaxProductUrl(url)) {
            discovered.add(url);
        }
    }

    /*
     * Algumas lojas AWSli repetem URLs dentro de scripts.
     */
    const absoluteRegex =
        /https?:\/\/loja\.inovaxcosmeticos\.com\.br\/[a-z0-9][a-z0-9-]*-\d{6,}/gi;

    for (const match of text.matchAll(absoluteRegex)) {
        const url = normalizeUrl(match[0]);

        if (isInovaxProductUrl(url)) {
            discovered.add(url);
        }
    }

    return [...discovered];
}

function extractInovaxNavigationUrls(html, baseUrl) {
    const discovered = new Set();

    const text = String(html || '');

    const hrefRegex =
        /href\s*=\s*["']([^"']+)["']/gi;

    for (const match of text.matchAll(hrefRegex)) {
        const url = absoluteUrl(
            decodeHtml(match[1]),
            baseUrl
        );

        if (!url) {
            continue;
        }

        let parsed;

        try {
            parsed = new URL(url);
        } catch {
            continue;
        }

        if (
            parsed.hostname !==
            'loja.inovaxcosmeticos.com.br'
        ) {
            continue;
        }

        const path = parsed.pathname.toLowerCase();

        if (
            path.includes('/carrinho/') ||
            path.includes('/adicionar') ||
            path.includes('/checkout') ||
            path.includes('/login')
        ) {
            continue;
        }

        /*
         * Paginação e páginas de categoria.
         */
        if (
            parsed.searchParams.has('page') ||
            path === '/' ||
            path.includes('/categoria') ||
            path.includes('/produtos') ||
            path.includes('/departamento') ||
            path.includes('/marca')
        ) {
            discovered.add(url);
        }
    }

    return [...discovered];
}

async function discoverInovax() {
    const queue = [
        'https://loja.inovaxcosmeticos.com.br/'
    ];

    const visited = new Set();
    const products = new Set();

    const MAX_PAGES = 80;

    while (
        queue.length &&
        visited.size < MAX_PAGES
    ) {
        const current = normalizeUrl(
            queue.shift()
        );

        if (
            !current ||
            visited.has(current)
        ) {
            continue;
        }

        visited.add(current);

        let result;

        try {
            result = await fetchHtml(current);
        } catch {
            continue;
        }

        if (!result.ok) {
            continue;
        }

        for (const url of extractInovaxProductUrls(
            result.text,
            result.url
        )) {
            products.add(url);
        }

        for (const url of extractInovaxNavigationUrls(
            result.text,
            result.url
        )) {
            if (
                !visited.has(url) &&
                !queue.includes(url)
            ) {
                queue.push(url);
            }
        }
    }

    return {
        visitedPages: [...visited],
        productUrls: [...products]
    };
}


/* ============================================================
   BRAÉ
   ============================================================ */

function isBraeProductUrl(url) {
    const value = normalizeUrl(url);

    if (!value) {
        return false;
    }

    let parsed;

    try {
        parsed = new URL(value);
    } catch {
        return false;
    }

    if (parsed.hostname !== 'www.brae.com.br') {
        return false;
    }

    const path = parsed.pathname.toLowerCase();

    /*
     * Páginas de catálogo/categoria não são produtos.
     */
    const blockedPaths = [
        '/produtos',
        '/produtos-profissionais',
        '/todos-os-produtos',
        '/brae-todos-os-produtos',
        '/tratamento',
        '/kits',
        '/perfume',
        '/todos-os-kits---menu-kits-promocionais'
    ];

    if (
        blockedPaths.some(
            blocked =>
                path === blocked ||
                path.startsWith(`${blocked}/`)
        )
    ) {
        return false;
    }

    if (
        path.includes('/tipos-de-cabelo/') ||
        path.includes('/categoria/') ||
        path.includes('/blog/') ||
        path.includes('/login') ||
        path.includes('/conta')
    ) {
        return false;
    }

    /*
     * Produto VTEX costuma aparecer como:
     * /produto/nome
     * /nome-do-produto/p
     */
    return (
        path.includes('/produto/') ||
        /\/p$/.test(path) ||
        /\/[a-z0-9][a-z0-9-]+\/p$/i.test(path)
    );
}

function extractBraeJsonLdProducts(html) {
    const products = [];

    const regex =
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(regex)) {
        const raw = match[1]
            .trim()
            .replace(/<!--/g, '')
            .replace(/-->/g, '');

        if (!raw) {
            continue;
        }

        try {
            const data = JSON.parse(raw);

            const walk = value => {
                if (!value) {
                    return;
                }

                if (Array.isArray(value)) {
                    for (const item of value) {
                        walk(item);
                    }

                    return;
                }

                if (
                    typeof value !== 'object'
                ) {
                    return;
                }

                const type = value['@type'];

                if (
                    type === 'Product' ||
                    (
                        Array.isArray(type) &&
                        type.includes('Product')
                    )
                ) {
                    products.push(value);
                }

                if (value['@graph']) {
                    walk(value['@graph']);
                }

                if (value.item) {
                    walk(value.item);
                }

                if (value.itemListElement) {
                    walk(value.itemListElement);
                }
            };

            walk(data);
        } catch {
            // JSON-LD inválido não interrompe a coleta
        }
    }

    return products;
}

function extractBraeProductUrlsFromJsonLd(
    products,
    baseUrl
) {
    const discovered = new Set();

    for (const product of products) {
        const candidates = [
            product.url,
            product['@id'],
            product.mainEntityOfPage
        ];

        for (const candidate of candidates) {
            const value =
                typeof candidate === 'object'
                    ? candidate['@id'] || candidate.url
                    : candidate;

            const url = absoluteUrl(
                value,
                baseUrl
            );

            if (isBraeProductUrl(url)) {
                discovered.add(url);
            }
        }
    }

    return [...discovered];
}

function extractBraeProductUrlsFromLinks(
    html,
    baseUrl
) {
    const discovered = new Set();

    const hrefRegex =
        /href\s*=\s*["']([^"']+)["']/gi;

    for (const match of html.matchAll(hrefRegex)) {
        const url = absoluteUrl(
            decodeHtml(match[1]),
            baseUrl
        );

        if (isBraeProductUrl(url)) {
            discovered.add(url);
        }
    }

    return [...discovered];
}

async function discoverBrae() {
    const products = new Set();
    const visited = new Set();

    /*
     * A página "Todos os produtos" é a principal fonte.
     * Também mantemos as listagens gerais como fontes
     * complementares.
     */
    const bases = [
        'https://www.brae.com.br/brae-todos-os-produtos',
        'https://www.brae.com.br/produtos',
        'https://www.brae.com.br/produtos-profissionais'
    ];

    /*
     * O catálogo público informado pela própria estrutura
     * da loja chega a centenas de produtos. Vamos percorrer
     * páginas suficientes sem assumir que o número final é
     * fixo.
     */
    const MAX_PAGES = 40;

    for (const base of bases) {
        for (
            let page = 1;
            page <= MAX_PAGES;
            page++
        ) {
            const url =
                page === 1
                    ? base
                    : `${base}?page=${page}`;

            const normalized =
                normalizeUrl(url);

            if (
                !normalized ||
                visited.has(normalized)
            ) {
                continue;
            }

            visited.add(normalized);

            let result;

            try {
                result =
                    await fetchHtml(normalized);
            } catch {
                continue;
            }

            if (!result.ok) {
                continue;
            }

            const jsonProducts =
                extractBraeJsonLdProducts(
                    result.text
                );

            for (
                const product
                of jsonProducts
            ) {
                for (
                    const url
                    of extractBraeProductUrlsFromJsonLd(
                        [product],
                        result.url
                    )
                ) {
                    products.add(url);
                }
            }

            for (
                const url
                of extractBraeProductUrlsFromLinks(
                    result.text,
                    result.url
                )
            ) {
                products.add(url);
            }
        }
    }

    return {
        visitedPages: [...visited],
        productUrls: [...products]
    };
}


/* ============================================================
   EXPORTS
   ============================================================ */

export {
    normalizeUrl,
    fetchHtml,

    isEcoBelleProductUrl,
    extractEcoBelleProductUrls,
    discoverEcoBelle,

    isInovaxProductUrl,
    extractInovaxProductUrls,
    discoverInovax,

    isBraeProductUrl,
    extractBraeJsonLdProducts,
    extractBraeProductUrlsFromJsonLd,
    discoverBrae
};
