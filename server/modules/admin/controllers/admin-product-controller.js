const service = require("../services/admin-product-service");

async function details(req, res) {
    try {
        const data = await service.getProductDetails(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: "Produto não encontrado."
            });
        }

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function create(req, res) {
    try {
        const data = await service.createProduct(req.body);

        return res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

async function update(req, res) {
    try {
        const data = await service.updateProduct(
            req.params.id,
            req.body
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    details,
    create,
    update
};
