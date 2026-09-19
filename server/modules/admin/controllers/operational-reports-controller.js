const service =
    require("../services/operational-reports-service");

async function getOperationalReports(req, res) {
    try {
        const data =
            await service.getOperationalReports();

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
    getOperationalReports
};
