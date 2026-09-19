const repository = require("../repositories/admin-finance-repository");

async function getFinancialDetails() {
    return repository.getFinancialDetails();
}

module.exports = {
    getFinancialDetails
};
