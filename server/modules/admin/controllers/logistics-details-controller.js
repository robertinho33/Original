const service =
    require("../services/logistics-details-service");

async function getLogisticsDetails(req, res) {
    try {
        const data =
            await service.getLogisticsDetails();

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
    getLogisticsDetails
};
