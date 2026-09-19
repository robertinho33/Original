const repository =
    require("../repositories/operational-reports-repository");

async function getOperationalReports() {
    return repository.getOperationalReports();
}

module.exports = {
    getOperationalReports
};
