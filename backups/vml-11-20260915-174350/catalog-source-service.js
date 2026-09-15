'use strict';

/**
 * Serviço central das fontes de catálogo da AURÉA.
 *
 * Responsabilidades:
 * - executar fontes de catálogo de forma isolada;
 * - validar resultados;
 * - impedir que uma fonte externa derrube o catálogo;
 * - preparar o núcleo para futuras fontes.
 *
 * Este módulo não altera:
 * - carrinho;
 * - checkout;
 * - PIX;
 * - pedidos;
 * - rastreamento.
 */

async function loadSource(sourceLoader, sourceName = 'Fonte') {
    if (typeof sourceLoader !== 'function') {
        throw new TypeError(
            `${sourceName}: carregador de fonte inválido.`
        );
    }

    try {
        const products = await sourceLoader();

        if (!Array.isArray(products)) {
            throw new Error(
                `${sourceName}: a fonte não retornou uma lista de produtos.`
            );
        }

        return {
            success: true,
            source: sourceName,
            products
        };

    } catch (error) {
        console.warn(
            `[CATALOG] Fonte ${sourceName} indisponível:`,
            error?.message || error
        );

        return {
            success: false,
            source: sourceName,
            products: [],
            error: error?.message || 'Erro desconhecido.'
        };
    }
}

export async function loadCatalogSource(
    sourceLoader,
    sourceName = 'Fonte'
) {
    return await loadSource(
        sourceLoader,
        sourceName
    );
}

export async function loadCatalogSources(
    sources = []
) {
    if (!Array.isArray(sources)) {
        return [];
    }

    const results = await Promise.all(
        sources.map(source =>
            loadSource(
                source.loader,
                source.name || 'Fonte'
            )
        )
    );

    return results;
}

export function mergeSourceProducts(results = []) {
    if (!Array.isArray(results)) {
        return [];
    }

    return results
        .filter(result => result?.success)
        .flatMap(result =>
            Array.isArray(result.products)
                ? result.products
                : []
        );
}
