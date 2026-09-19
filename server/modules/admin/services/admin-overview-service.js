const repository = require("../repositories/admin-overview-repository");

async function getOverview() {
    return repository.getAdminOverview();
}

async function getTimeline(days = 30) {
    return repository.getSalesTimeline(days);
}

async function getAlerts() {
    return repository.getOperationalAlerts();
}

module.exports = {
    getOverview,
    getTimeline,
    getAlerts
};
