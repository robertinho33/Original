const service = require("../services/operational-dashboard-service");

async function getOperationalDashboard(req, res) {
    try {
        const data = await service.getOperationalDashboard();

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error("[ADMIN OPERATIONAL]", error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    getOperationalDashboard
};
