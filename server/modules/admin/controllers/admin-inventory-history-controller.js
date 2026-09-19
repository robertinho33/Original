const service = require("../services/admin-inventory-history-service");

async function history(req, res) {
    try {
        const data = await service.getInventoryHistory(
            req.query.product_id || null
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
    history
};
