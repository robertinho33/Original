const DEFAULT_PAGE_SIZE = 25;

function getPagination(query = {}) {
    const page =
        Math.max(
            parseInt(query.page, 10) || 1,
            1
        );

    const limit =
        Math.min(
            Math.max(
                parseInt(query.limit, 10) ||
                DEFAULT_PAGE_SIZE,
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
    DEFAULT_PAGE_SIZE,
    getPagination
};
