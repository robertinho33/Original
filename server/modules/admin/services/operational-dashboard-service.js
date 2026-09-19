const repository = require("../repositories/admin-dashboard-repository");

async function getOperationalDashboard() {
    const [summary, recentOrders] = await Promise.all([
        repository.getOperationalSummary(),
        repository.getRecentOrders(10)
    ]);

    return {
        summary,
        recentOrders
    };
}

module.exports = { getOperationalDashboard };
