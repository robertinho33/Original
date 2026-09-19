const service = require("../services/admin-order-filter-service");

async function search(req, res) {
    try {
        const data = await service.searchOrders({
            status: req.query.status,
            customer: req.query.customer,
            from: req.query.from,
            to: req.query.to
        });

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
