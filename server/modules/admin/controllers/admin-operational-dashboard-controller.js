const service = require("../services/admin-operational-dashboard-service");

async function dashboard(req, res) {
    try {
        const data = await service.getOperationalDashboard();

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
    dashboard
};
