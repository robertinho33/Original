const repository = require("../repositories/admin-product-filter-repository");

async function searchProducts(filters) {
    return repository.searchProducts(filters);
}

module.exports = {
    searchProducts
};
