const repository =
    require("../repositories/logistics-details-repository");

async function getLogisticsDetails() {
    return repository.getLogisticsDetails();
}

module.exports = {
    getLogisticsDetails
};
