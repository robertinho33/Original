'use strict';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

function absoluteUrl(value, baseUrl) {
    try {
        return new URL(value, baseUrl).href;
    } catch {
        return '';
    }
}

function normalizeUrl(value) {
    try {
        const url = new URL(value);

        url.hash = '';

        return url.href
            .replace(/\/+$/, '');
    } catch {
        return '';
    }
}

function isPlaceholderUrl(url) {
    const value =
        String(url || '')
            .trim()
            .toLowerCase();

    if (!value) {
        return true;
    }

    return (
        value.includes('--produto_url--') ||
        value.includes('produto_url') ||
        value.includes('example.com') ||
        value === 'javascript:void(0)' ||
        value === '#'
    );
}

function isHttpUrl(url) {
    return /^https?:\/\//i.test(url);
}

async function fetchText(url) {
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

function extractLinks(html, baseUrl) {
    const links = new Set();

    const regex =
        /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    let match;

    while ((match = regex.exec(html))) {
        const raw = match[1];

        if (!raw) continue;

        const url = normalizeUrl(
            absoluteUrl(raw, baseUrl)
        );

        if (
            !url ||
            isPlaceholderUrl(url) ||
            !isHttpUrl(url)
        ) {
            continue;
        }

        links.add(url);
    }

    return [...links];
}

function looksLikeProductUrl(url) {
    const value =
        String(url || '')
            .toLowerCase();

    return (
        /produto/.test(value) ||
        /product/.test(value) ||
        /p\/[^/]+/.test(value) ||
        /\/[a-z0-9-]+-\d{3,}$/.test(value)
    );
}

function sameHost(url, baseUrl) {
    try {
        return (
            new URL(url).hostname ===
            new URL(baseUrl).hostname
        );
    } catch {
        return false;
    }
}

async function discoverProductUrls(
    startUrls = [],
    options = {}
) {
    const maxPages =
        Number(options.maxPages || 20);

    const maxUrls =
        Number(options.maxUrls || 500);

    const visitedPages = new Set();
    const discovered = new Set();

    const queue = [
        ...new Set(
            startUrls
                .map(normalizeUrl)
                .filter(Boolean)
        )
    ];

    while (
        queue.length &&
        visitedPages.size < maxPages &&
        discovered.size < maxUrls
    ) {
        const current =
            queue.shift();

        if (
            !current ||
            visitedPages.has(current)
        ) {
            continue;
        }

        visitedPages.add(current);

        let result;

        try {
            result =
                await fetchText(current);
        } catch {
            continue;
        }

        if (!result.ok) {
            continue;
        }

        const links =
            extractLinks(
                result.text,
                result.url
            );

        for (const link of links) {
            if (!sameHost(link, result.url)) {
                continue;
            }

            if (looksLikeProductUrl(link)) {
                discovered.add(link);
            }

            if (
                queue.length < maxPages * 3 &&
                !visitedPages.has(link)
            ) {
                const lower =
                    link.toLowerCase();

                const isNavigation =
                    lower.includes('/produtos') ||
                    lower.includes('/produto') ||
                    lower.includes('/categoria') ||
                    lower.includes('/linha') ||
                    lower.includes('/kits') ||
                    lower.includes('/tratamento') ||
                    lower.includes('/profissionais') ||
                    lower.includes('?page=');

                if (isNavigation) {
                    queue.push(link);
                }
            }
        }
    }

    return {
        visitedPages: [...visitedPages],
        productUrls: [...discovered]
            .filter(url =>
                !isPlaceholderUrl(url)
            )
    };
}

export {
    absoluteUrl,
    normalizeUrl,
    isPlaceholderUrl,
    fetchText,
    extractLinks,
    looksLikeProductUrl,
    discoverProductUrls
};
