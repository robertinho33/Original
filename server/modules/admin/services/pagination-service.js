function normalizePagination(query = {}) {
    const page = Math.max(
        Number.parseInt(query.page, 10) || 1,
        1
    );

    const limit = Math.min(
        Math.max(
            Number.parseInt(query.limit, 10) || 25,
            1
        ),
        100
    );

    return {
        page,
        limit,
        offset: (page - 1) * limit
    };
}

module.exports = {
    normalizePagination
};
