const repository =
    require("../repositories/finance-details-repository");

async function getFinanceDetails() {
    return repository.getFinanceDetails();
}

module.exports = {
    getFinanceDetails
};
