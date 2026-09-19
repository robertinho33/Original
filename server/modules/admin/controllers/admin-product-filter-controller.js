const service = require("../services/admin-product-filter-service");

async function search(req, res) {
    try {
        const data = await service.searchProducts(req.query);

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
    search
};
