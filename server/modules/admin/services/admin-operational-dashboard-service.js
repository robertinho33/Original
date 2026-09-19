const repository = require("../repositories/admin-operational-dashboard-repository");

async function getOperationalDashboard() {
    return repository.getOperationalDashboard();
}

module.exports = {
    getOperationalDashboard
};
