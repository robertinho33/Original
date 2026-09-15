'use strict';

const INOVAX_URL = 'https://loja.inovaxcosmeticos.com.br/';
const MAX_CONCURRENT_REQUESTS = 6;

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCodePoint(Number(code))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            String.fromCodePoint(parseInt(code, 16))
        );
}

function stripHtml(value) {
    return decodeHtmlEntities(
        String(value || '')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/p>/gi, ' ')
            .replace(/<\/div>/gi, ' ')
            .replace(/<\/li>/gi, ' ')
            .replace(/<\/section>/gi, ' ')
            .replace(/<\/article>/gi, ' ')
            .replace(/<\/h[1-6]>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
    )
        .replace(/\s+/g, ' ')
        .trim();
}

function absoluteUrl(value) {
    const raw = decodeHtmlEntities(
        String(value || '').trim()
    );

    if (!raw) return '';

    try {
        return new URL(raw, INOVAX_URL).href;
    } catch {
        return raw;
    }
}

function extractAttribute(tag, attributeNames = []) {
    const source = String(tag || '');

    for (const attributeName of attributeNames) {
        const regex = new RegExp(
            `${attributeName}\\s*=\\s*["']([^"']+)["']`,
            'i'
        );

        const match = source.match(regex);

        if (match?.[1]) {
            return decodeHtmlEntities(match[1]).trim();
        }
    }

    return '';
}

function extractAnchors(html) {
    const links = [];
    const source = String(html || '');

    const regex =
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of source.matchAll(regex)) {
        const url = absoluteUrl(match[1]);
        const text = stripHtml(match[2]);

        if (!url || !text) continue;

        links.push({
            url,
            text
        });
    }

    return links;
}

function isLikelyProductUrl(url, text) {
    const normalizedUrl = String(url || '').toLowerCase();
    const normalizedText = String(text || '').trim();

    if (!normalizedUrl.startsWith(INOVAX_URL)) {
        return false;
    }

    if (normalizedUrl === INOVAX_URL) {
        return false;
    }

    if (!normalizedText || normalizedText.length < 8) {
        return false;
    }

    if (/^r\$\s*[\d.,]+$/i.test(normalizedText)) {
        return false;
    }

    if (
        /^(comprar|ver produto|saiba mais|detalhes|home|início|inicio|menu)$/i
            .test(normalizedText)
    ) {
        return false;
    }

    const path = new URL(normalizedUrl).pathname.toLowerCase();

    const ignoredPaths = [
        '/login',
        '/cadastro',
        '/carrinho',
        '/checkout',
        '/contato',
        '/blog',
        '/sobre',
        '/politica',
        '/privacidade',
        '/termos'
    ];

    if (ignoredPaths.includes(path)) {
        return false;
    }

    return true;
}

export function discoverProductLinks(html) {
    const anchors = extractAnchors(html);
    const seen = new Set();
    const products = [];

    for (const anchor of anchors) {
        if (!isLikelyProductUrl(anchor.url, anchor.text)) {
            continue;
        }

        const url = anchor.url.split('#')[0];

        if (seen.has(url)) {
            continue;
        }

        seen.add(url);

        products.push({
            url,
            nameHint: anchor.text
        });
    }

    return products;
}

function extractTitle(html) {
    const source = String(html || '');

    const patterns = [
        /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
        /<title\b[^>]*>([\s\S]*?)<\/title>/i
    ];

    for (const pattern of patterns) {
        const match = source.match(pattern);

        if (!match?.[1]) continue;

        const title = stripHtml(match[1])
            .replace(/\s*[-|]\s*Inovax.*$/i, '')
            .trim();

        if (
            title &&
            !/^inovax$/i.test(title)
        ) {
            return title;
        }
    }

    return '';
}

function extractCode(html) {
    const text = stripHtml(html);

    const patterns = [
        /C[oó]digo\s*:\s*([A-Za-z0-9_-]+)/i,
        /C[oó]digo\s+([A-Za-z0-9_-]+)/i,
        /SKU\s*:\s*([A-Za-z0-9_-]+)/i,
        /SKU\s+([A-Za-z0-9_-]+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (match?.[1]) {
            return String(match[1]).trim();
        }
    }

    return '';
}

function extractPrice(html) {
    const text = stripHtml(html);

    const matches = [
        ...text.matchAll(
            /R\$\s*([\d.]+,\d{2})/gi
        )
    ];

    const prices = [];

    for (const match of matches) {
        const price = Number(
            match[1]
                .replace(/\./g, '')
                .replace(',', '.')
        );

        if (
            Number.isFinite(price) &&
            price > 0
        ) {
            prices.push(price);
        }
    }

    return prices.at(-1) || 0;
}

function extractStock(html) {
    const text = stripHtml(html);

    if (
        /estoque\s*:\s*(?:esgotado|indispon[ií]vel)/i.test(text)
    ) {
        return 'esgotado';
    }

    if (
        /estoque\s*:\s*dispon[ií]vel/i.test(text)
    ) {
        return 'disponível';
    }

    return 'não informado';
}

function extractImages(html) {
    const images = [];
    const source = String(html || '');

    const regex = /<img\b[^>]*>/gi;

    for (const match of source.matchAll(regex)) {
        const tag = match[0];

        const src = extractAttribute(
            tag,
            [
                'data-src',
                'data-original',
                'data-lazy',
                'src'
            ]
        );

        if (!src) continue;

        const url = absoluteUrl(src);

        if (!url) continue;

        if (
            /logo|sprite|icon|loading|placeholder|site-seguro/i
                .test(url)
        ) {
            continue;
        }

        images.push(url);
    }

    return [...new Set(images)];
}

function extractImage(html) {
    return extractImages(html)[0] || '';
}

function extractDescription(html) {
    const source = String(html || '');

    const patterns = [
        /<meta\b[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        /<meta\b[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
    ];

    for (const pattern of patterns) {
        const match = source.match(pattern);

        if (match?.[1]) {
            const description = stripHtml(match[1]);

            if (description.length > 40) {
                return description;
            }
        }
    }

    return '';
}

function inferWeight(name, description) {
    const text = `${name} ${description}`;

    const match = text.match(
        /\b(\d+(?:[.,]\d+)?)\s*(ml|mL|g|kg|L)\b/i
    );

    if (!match) return '';

    return `${match[1]}${match[2]}`;
}

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 34);
}

function createInternalSku(sourceUrl, name) {
    const url = String(sourceUrl || '');

    let slug = '';

    try {
        slug = new URL(url).pathname
            .split('/')
            .filter(Boolean)
            .at(-1) || '';
    } catch {
        slug = '';
    }

    const base =
        slugify(slug) ||
        slugify(name) ||
        'PRODUTO';

    let hash = 0;

    for (const char of url) {
        hash =
            ((hash << 5) - hash) +
            char.charCodeAt(0);

        hash |= 0;
    }

    const unsignedHash =
        Math.abs(hash)
            .toString(36)
            .toUpperCase()
            .substring(0, 5);

    return `INOVAX-${base}-${unsignedHash}`
        .substring(0, 50);
}

export function parseInovaxProductPage(
    html,
    sourceUrl = '',
    nameHint = ''
) {
    const name =
        extractTitle(html) ||
        String(nameHint || '').trim();

    const description =
        extractDescription(html);

    const originalSku =
        extractCode(html);

    return {
        sku:
            originalSku ||
            createInternalSku(
                sourceUrl,
                name
            ),

        name,

        weight:
            inferWeight(
                name,
                description
            ),

        price:
            extractPrice(html),

        category:
            'Inovax',

        stock:
            extractStock(html),

        description,

        image:
            extractImage(html),

        sourceUrl:
            absoluteUrl(sourceUrl)
    };
}

async function fetchProduct(product) {
    const response = await fetch(
        product.url,
        {
            method: 'GET',
            cache: 'no-store',
            headers: {
                Accept: 'text/html',
                'User-Agent': 'Mozilla/5.0'
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    return parseInovaxProductPage(
        html,
        product.url,
        product.nameHint
    );
}

async function enrichProducts(products) {
    const result = [];

    for (
        let index = 0;
        index < products.length;
        index += MAX_CONCURRENT_REQUESTS
    ) {
        const batch =
            products.slice(
                index,
                index + MAX_CONCURRENT_REQUESTS
            );

        const batchResults =
            await Promise.all(
                batch.map(
                    async product => {
                        try {
                            return await fetchProduct(product);
                        } catch (error) {
                            console.warn(
                                '[INOVAX] Falha:',
                                product.url,
                                '-',
                                error?.message || error
                            );

                            return null;
                        }
                    }
                )
            );

        result.push(
            ...batchResults.filter(Boolean)
        );

        console.log(
            `[INOVAX] Processados: ${
                Math.min(
                    index +
                        MAX_CONCURRENT_REQUESTS,
                    products.length
                )
            }/${products.length}`
        );
    }

    return result;
}

function isValidProduct(product) {
    return Boolean(
        product &&
        product.sku &&
        product.name &&
        product.name.length >= 8 &&
        product.price > 0 &&
        product.image &&
        product.sourceUrl
    );
}

function deduplicateProducts(products) {
    const seen = new Set();

    return products.filter(product => {
        const key =
            product.sourceUrl ||
            product.sku ||
            product.name;

        const normalized =
            String(key || '')
                .trim()
                .toLowerCase();

        if (!normalized || seen.has(normalized)) {
            return false;
        }

        seen.add(normalized);

        return true;
    });
}

export async function loadInovaxProducts() {
    const response = await fetch(
        INOVAX_URL,
        {
            method: 'GET',
            cache: 'no-store',
            headers: {
                Accept: 'text/html',
                'User-Agent': 'Mozilla/5.0'
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `Inovax: HTTP ${response.status}`
        );
    }

    const html =
        await response.text();

    const discovered =
        discoverProductLinks(html);

    console.log(
        `[INOVAX] URLs descobertas: ${discovered.length}`
    );

    const enriched =
        await enrichProducts(discovered);

    const valid =
        enriched.filter(isValidProduct);

    const unique =
        deduplicateProducts(valid);

    console.log(
        `[INOVAX] Páginas processadas: ${enriched.length}`
    );

    console.log(
        `[INOVAX] Produtos válidos: ${unique.length}`
    );

    return unique;
}

export {
    INOVAX_URL,
    decodeHtmlEntities,
    stripHtml,
    absoluteUrl,
    extractAttribute,
    extractAnchors,
    isLikelyProductUrl,
    extractTitle,
    extractCode,
    extractPrice,
    extractStock,
    extractImages,
    extractImage,
    extractDescription,
    inferWeight,
    slugify,
    createInternalSku,
    fetchProduct,
    enrichProducts,
    isValidProduct,
    deduplicateProducts
};
