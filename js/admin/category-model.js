const CATEGORY_DEFAULTS = Object.freeze({
    name: '',
    slug: '',
    description: '',
    active: true,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null
});

export function normalizeCategory(input = {}) {
    const name = String(input.name ?? '').trim();

    if (!name) {
        throw new Error('Nome da categoria é obrigatório.');
    }

    const slug = String(
        input.slug ??
        name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    ).trim();

    if (!slug) {
        throw new Error('Não foi possível gerar o slug da categoria.');
    }

    return {
        ...CATEGORY_DEFAULTS,
        name,
        slug,
        description: String(input.description ?? '').trim(),
        active: input.active !== false,
        sortOrder: Number.isFinite(Number(input.sortOrder))
            ? Number(input.sortOrder)
            : 0,
        createdAt: input.createdAt ?? null,
        updatedAt: input.updatedAt ?? null
    };
}

export function validateCategory(category) {
    const errors = [];

    if (!category?.name) {
        errors.push('nome obrigatório');
    }

    if (!category?.slug) {
        errors.push('slug obrigatório');
    }

    if (!Number.isFinite(Number(category?.sortOrder))) {
        errors.push('ordem inválida');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}