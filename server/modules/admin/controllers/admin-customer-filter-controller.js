const service = require("../services/admin-customer-filter-service");

async function search(req, res) {
    try {
        const data = await service.searchCustomers(req.query.q);

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
