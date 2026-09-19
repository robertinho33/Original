const repository =
    require("../repositories/product-write-repository");

async function createProduct(data) {
    return repository.createProduct(data);
}

async function updateProduct(id, data) {
    return repository.updateProduct(id, data);
}

async function getProductDetails(id) {
    return repository.getProductDetails(id);
}

module.exports = {
    createProduct,
    updateProduct,
    getProductDetails
};
