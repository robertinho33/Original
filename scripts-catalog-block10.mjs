import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEcoBelleProducts } from "./js/catalog/sources/ecobelle-source.js";
import { loadBraeProducts } from "./js/catalog/sources/brae-source.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STAGING_DIR = path.join(
    __dirname,
    "data",
    "_staging"
);

const INOVAX_HOME =
    "https://loja.inovaxcosmeticos.com.br/";

const BRAE_HOME =
    "https://www.brae.com.br/produtos";

const CONCURRENCY = 6;


// ============================================================
// UTILITÁRIOS
// ============================================================

function cleanText(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function unique(values) {
    return [
        ...new Set(
            values
                .map(cleanText)
                .filter(Boolean)
        )
    ];
}

function absoluteUrl(value, base) {
    try {
        return new URL(value, base).href;
    } catch {
        return "";
    }
}

function sameHost(url, hostname) {
    try {
        return new URL(url).hostname === hostname;
    } catch {
        return false;
    }
}

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 Chrome/139 Safari/537.36",
            "Accept-Language":
                "pt-BR,pt;q=0.9,en;q=0.8"
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
}

function stripHtml(html) {
    return cleanText(
        String(html || "")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
    );
}

function extractLinks(html, baseUrl) {
    const links = [];

    const regex =
        /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {
        const href = match[1];

        if (!href) {
            continue;
        }

        if (
            href.startsWith("#") ||
            href.startsWith("javascript:") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
        ) {
            continue;
        }

        const url = absoluteUrl(
            href,
            baseUrl
        );

        if (url) {
            links.push(
                url.split("#")[0]
            );
        }
    }

    return unique(links);
}

function extractMeta(html, name) {
    const regex = new RegExp(
        `<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
        "i"
    );

    const match = html.match(regex);

    return match
        ? cleanText(match[1])
        : "";
}

function extractTitle(html) {
    const h1 =
        html.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
        );

    if (h1) {
        return stripHtml(h1[1]);
    }

    const title =
        html.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i
        );

    return title
        ? stripHtml(title[1])
        : "";
}

function extractImage(html, baseUrl) {
    const og =
        extractMeta(
            html,
            "og:image"
        );

    if (og) {
        return absoluteUrl(
            og,
            baseUrl
        );
    }

    const images = [
        ...html.matchAll(
            /<img\b[^>]*(?:src|data-src)=["']([^"']+)["']/gi
        )
    ];

    for (const match of images) {
        const url =
            absoluteUrl(
                match[1],
                baseUrl
            );

        if (
            url &&
            !url.startsWith("data:")
        ) {
            return url;
        }
    }

    return "";
}

function parsePrice(value) {
    const raw =
        cleanText(value);

    if (!raw) {
        return 0;
    }

    const normalized =
        raw
            .replace(/[R$\s]/gi, "")
            .replace(/\./g, "")
            .replace(",", ".");

    const number =
        Number(normalized);

    return Number.isFinite(number)
        ? number
        : 0;
}

function extractPrice(text) {
    const matches = [
        ...String(text || "")
            .matchAll(
                /R\$\s*([\d.]+,\d{2})/gi
            )
    ];

    const values =
        matches
            .map(
                match =>
                    parsePrice(
                        match[1]
                    )
            )
            .filter(
                value =>
                    value > 0
            );

    if (!values.length) {
        return 0;
    }

    return Math.min(
        ...values
    );
}

function extractCode(text) {
    const patterns = [
        /Código\s*:\s*([A-Za-z0-9._-]+)/i,
        /SKU\s*:\s*([A-Za-z0-9._-]+)/i,
        /Código do produto\s*:\s*([A-Za-z0-9._-]+)/i
    ];

    for (
        const pattern
        of patterns
    ) {
        const match =
            String(text || "")
                .match(pattern);

        if (match) {
            return cleanText(
                match[1]
            );
        }
    }

    return "";
}

function fallbackSku(
    source,
    url,
    name
) {
    const seed =
        `${source}|${url}|${name}`
            .toLowerCase();

    let hash =
        2166136261;

    for (
        let i = 0;
        i < seed.length;
        i++
    ) {
        hash ^= seed.charCodeAt(i);

        hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);
    }

    return (
        `${source.toUpperCase()}-` +
        Math.abs(
            hash >>> 0
        )
            .toString(36)
            .toUpperCase()
    );
}


// ============================================================
// NORMALIZAÇÃO LOCAL
// ============================================================

function normalizeProduct(
    product = {}
) {
    return {
        sku:
            cleanText(
                product.sku
            ),

        name:
            cleanText(
                product.name
            ),

        weight:
            cleanText(
                product.weight
            ),

        price:
            Number(
                product.price
            ) || 0,

        category:
            cleanText(
                product.category
            ),

        stock:
            cleanText(
                product.stock
            ),

        description:
            cleanText(
                product.description
            ),

        image:
            cleanText(
                product.image
            ),

        sourceId:
            cleanText(
                product.sourceId
            ),

        sourceName:
            cleanText(
                product.sourceName
            ),

        sourceUrl:
            cleanText(
                product.sourceUrl
            ),

        active:
            product.active !== false,

        featured:
            product.featured === true,

        priority:
            Number(
                product.priority
            ) || 0
    };
}

function isValidProduct(
    product
) {
    return Boolean(
        product &&
        product.sku &&
        product.name &&
        product.price > 0 &&
        product.image &&
        product.sourceId
    );
}


// ============================================================
// CONCORRÊNCIA
// ============================================================

async function mapConcurrent(
    items,
    worker,
    concurrency = 6
) {
    const results =
        new Array(
            items.length
        );

    let cursor = 0;

    async function runner() {
        while (true) {
            const index =
                cursor++;

            if (
                index >=
                items.length
            ) {
                return;
            }

            try {
                results[index] =
                    await worker(
                        items[index],
                        index
                    );
            } catch {
                results[index] =
                    null;
            }
        }
    }

    const runners =
        Array.from(
            {
                length:
                    Math.min(
                        concurrency,
                        Math.max(
                            items.length,
                            1
                        )
                    )
            },
            () =>
                runner()
        );

    await Promise.all(
        runners
    );

    return results;
}


// ============================================================
// ECOBELLE
// ============================================================

async function processEcoBelle() {
    console.log("");
    console.log(
        "========== ECOBELLE =========="
    );

    const products =
        await loadEcoBelleProducts();

    const normalized =
        products
            .map(product =>
                normalizeProduct({
                    ...product,

                    sourceId:
                        "ecobelle",

                    sourceName:
                        "EcoBelle",

                    sourceUrl:
                        product.sourceUrl ||
                        product.url ||
                        "https://www.grupoecobelle.com.br/produtos",

                    active:
                        true,

                    featured:
                        false,

                    priority:
                        0
                })
            )
            .filter(
                isValidProduct
            );

    console.log(
        `[ECOBELLE] Recebidos: ${products.length}`
    );

    console.log(
        `[ECOBELLE] Válidos: ${normalized.length}`
    );

    return normalized;
}


// ============================================================
// INOVAX
// ============================================================

function isInovaxCandidate(
    url
) {
    try {
        const parsed =
            new URL(url);

        if (
            parsed.hostname !==
            "loja.inovaxcosmeticos.com.br"
        ) {
            return false;
        }

        const pathname =
            parsed.pathname
                .toLowerCase();

        if (
            pathname === "/" ||
            pathname.includes(
                "/carrinho"
            ) ||
            pathname.includes(
                "/checkout"
            ) ||
            pathname.includes(
                "/login"
            ) ||
            pathname.includes(
                "/conta"
            ) ||
            pathname.includes(
                "/adicionar"
            ) ||
            pathname.includes(
                "/busca"
            ) ||
            pathname.startsWith(
                "/none-"
            )
        ) {
            return false;
        }

        return true;

    } catch {
        return false;
    }
}

function isInovaxProduct(
    text
) {
    const hasPrice =
        /R\$\s*[\d.]+,\d{2}/i
            .test(text);

    const hasCode =
        /(?:Código|SKU)\s*:/i
            .test(text);

    const hasBuy =
        /\bComprar\b/i
            .test(text);

    const hasStock =
        /(?:Estoque|Disponibilidade)/i
            .test(text);

    const signals =
        [
            hasPrice,
            hasCode,
            hasBuy,
            hasStock
        ]
            .filter(Boolean)
            .length;

    return (
        hasPrice &&
        signals >= 3
    );
}

function parseInovax(
    html,
    url
) {
    const text =
        stripHtml(html);

    if (
        !isInovaxProduct(
            text
        )
    ) {
        return null;
    }

    const name =
        extractTitle(
            html
        );

    const price =
        extractPrice(
            text
        );

    const image =
        extractImage(
            html,
            url
        );

    if (
        !name ||
        !price ||
        !image
    ) {
        return null;
    }

    const sku =
        extractCode(
            text
        ) ||
        fallbackSku(
            "inovax",
            url,
            name
        );

    const weightMatch =
        name.match(
            /(\d+(?:[.,]\d+)?)\s*(ml|mL|g|kg|L)\b/i
        );

    return normalizeProduct({
        sku,

        name,

        weight:
            weightMatch
                ? `${weightMatch[1]} ${weightMatch[2]}`
                : "",

        price,

        category:
            "",

        stock:
            /Esgotado/i.test(
                text
            )
                ? "Esgotado"
                : "Disponível",

        description:
            extractMeta(
                html,
                "description"
            ),

        image,

        sourceId:
            "inovax",

        sourceName:
            "Inovax",

        sourceUrl:
            url,

        active:
            true,

        featured:
            false,

        priority:
            0
    });
}

async function processInovax() {
    console.log("");
    console.log(
        "========== INOVAX =========="
    );

    const html =
        await fetchHtml(
            INOVAX_HOME
        );

    const candidates =
        unique(
            extractLinks(
                html,
                INOVAX_HOME
            )
                .filter(
                    isInovaxCandidate
                )
        );

    console.log(
        `[INOVAX] Candidatas: ${candidates.length}`
    );

    let processed = 0;
    let valid = 0;

    const results =
        await mapConcurrent(
            candidates,
            async url => {
                try {
                    const page =
                        await fetchHtml(
                            url
                        );

                    const product =
                        parseInovax(
                            page,
                            url
                        );

                    processed++;

                    if (
                        product
                    ) {
                        valid++;
                    }

                    console.log(
                        `[INOVAX] ${processed}/${candidates.length} | válidos ${valid}`
                    );

                    return product;

                } catch {
                    processed++;

                    console.log(
                        `[INOVAX] ${processed}/${candidates.length} | erro`
                    );

                    return null;
                }
            },
            CONCURRENCY
        );

    const products =
        new Map();

    for (
        const product
        of results.filter(Boolean)
    ) {
        const key =
            product.sourceUrl ||
            `${product.sku}|${product.name}`;

        if (
            !products.has(key)
        ) {
            products.set(
                key,
                product
            );
        }
    }

    return [
        ...products.values()
    ];
}


// ============================================================
// BRAÉ
// ============================================================

async function processBrae() {
    console.log("");
    console.log(
        "========== BRAÉ =========="
    );

    const html =
        await fetchHtml(
            BRAE_HOME
        );

    const links =
        unique(
            extractLinks(
                html,
                BRAE_HOME
            )
                .filter(url =>
                    sameHost(
                        url,
                        "www.brae.com.br"
                    )
                )
        );

    console.log(
        `[BRAÉ] URLs encontradas: ${links.length}`
    );

    let processed = 0;
    let valid = 0;

    const results =
        await mapConcurrent(
            links,
            async url => {
                try {
                    const page =
                        await fetchHtml(
                            url
                        );

                    const text =
                        stripHtml(
                            page
                        );

                    const name =
                        extractTitle(
                            page
                        );

                    const price =
                        extractPrice(
                            text
                        );

                    const image =
                        extractImage(
                            page,
                            url
                        );

                    if (
                        !name ||
                        !price ||
                        !image
                    ) {
                        processed++;

                        console.log(
                            `[BRAÉ] ${processed}/${links.length} | rejeitado`
                        );

                        return null;
                    }

                    const product =
                        normalizeProduct({
                            sku:
                                extractCode(
                                    text
                                ) ||
                                fallbackSku(
                                    "brae",
                                    url,
                                    name
                                ),

                            name:
                                name
                                    .replace(
                                        /\s*\|\s*Braé.*$/i,
                                        ""
                                    )
                                    .trim(),

                            weight:
                                "",

                            price,

                            category:
                                "",

                            stock:
                                /Esgotado/i.test(
                                    text
                                )
                                    ? "Esgotado"
                                    : "Disponível",

                            description:
                                extractMeta(
                                    page,
                                    "description"
                                ),

                            image,

                            sourceId:
                                "brae",

                            sourceName:
                                "Braé",

                            sourceUrl:
                                url,

                            active:
                                true,

                            featured:
                                false,

                            priority:
                                0
                        });

                    processed++;
                    valid++;

                    console.log(
                        `[BRAÉ] ${processed}/${links.length} | válidos ${valid}`
                    );

                    return product;

                } catch {
                    processed++;

                    console.log(
                        `[BRAÉ] ${processed}/${links.length} | erro`
                    );

                    return null;
                }
            },
            CONCURRENCY
        );

    const products =
        new Map();

    for (
        const product
        of results.filter(Boolean)
    ) {
        const key =
            product.sourceUrl ||
            `${product.sku}|${product.name}`;

        if (
            !products.has(key)
        ) {
            products.set(
                key,
                product
            );
        }
    }

    return [
        ...products.values()
    ];
}


// ============================================================
// CONSOLIDAÇÃO
// ============================================================

async function main() {

    await fs.mkdir(
        STAGING_DIR,
        {
            recursive:
                true
        }
    );

    const ecoBelle =
        await processEcoBelle();

    const inovax =
        await processInovax();

    const brae =
        await processBrae();

    const all = [
        ...ecoBelle,
        ...inovax,
        ...brae
    ];

    const products =
        new Map();

    for (
        const product
        of all
    ) {
        if (
            !isValidProduct(
                product
            )
        ) {
            continue;
        }

        const key =
            `${product.sourceId}|${product.sku}|${product.name}`
                .toLowerCase();

        if (
            !products.has(key)
        ) {
            products.set(
                key,
                product
            );
        }
    }

    const finalProducts =
        [...products.values()];

    const output = {
        block:
            10,

        generatedAt:
            new Date().toISOString(),

        officialCatalogUpdated:
            false,

        products:
            finalProducts
    };

    const outputPath =
        path.join(
            STAGING_DIR,
            "catalog-preview-block10.json"
        );

    await fs.writeFile(
        outputPath,
        JSON.stringify(
            output,
            null,
            2
        ),
        "utf8"
    );

    const counts = {};

    for (
        const product
        of finalProducts
    ) {
        counts[
            product.sourceId
        ] =
            (
                counts[
                    product.sourceId
                ] || 0
            ) + 1;
    }

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        " RESUMO DO BLOCO 10"
    );
    console.log(
        "============================================================"
    );

    console.log(
        `EcoBelle: ${counts.ecobelle || 0}`
    );

    console.log(
        `Inovax:   ${counts.inovax || 0}`
    );

    console.log(
        `Braé:     ${counts.brae || 0}`
    );

    console.log(
        `TOTAL:    ${finalProducts.length}`
    );

    console.log("");
    console.log(
        `Preview: ${outputPath}`
    );

    console.log("");
    console.log(
        "data/catalog.json NÃO FOI ALTERADO."
    );

    console.log(
        "============================================================"
    );
}

main().catch(error => {
    console.error("");
    console.error(
        "ERRO NO BLOCO 10:"
    );
    console.error(error);
    process.exit(1);
});
