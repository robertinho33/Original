const service = require("../services/admin-finance-service");

async function details(req, res) {
    try {
        const data = await service.getFinancialDetails();

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
    details
};
