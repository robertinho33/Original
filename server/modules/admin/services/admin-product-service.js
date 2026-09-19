const repository = require("../repositories/admin-product-repository");

async function getProductDetails(id) {
    return repository.getProductDetails(id);
}

async function createProduct(data) {
    if (!data.sku || !data.name) {
        throw new Error("SKU e nome do produto são obrigatórios.");
    }

    if (Number(data.price || 0) < 0) {
        throw new Error("Preço inválido.");
    }

    if (Number(data.stock || 0) < 0) {
        throw new Error("Estoque inválido.");
    }

    return repository.createProduct(data);
}

async function updateProduct(id, data) {
    if (data.price !== undefined && Number(data.price) < 0) {
        throw new Error("Preço inválido.");
    }

    if (data.stock !== undefined && Number(data.stock) < 0) {
        throw new Error("Estoque inválido.");
    }

    return repository.updateProduct(id, data);
}

module.exports = {
    getProductDetails,
    createProduct,
    updateProduct
};
