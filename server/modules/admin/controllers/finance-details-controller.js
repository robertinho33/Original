const service =
    require("../services/finance-details-service");

async function getFinanceDetails(req, res) {
    try {
        const data = await service.getFinanceDetails();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getFinanceDetails
};
