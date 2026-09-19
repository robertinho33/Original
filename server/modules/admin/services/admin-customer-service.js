const repository = require("../repositories/admin-customer-repository");

async function getCustomerDetails(id) {
    return repository.getCustomerDetails(id);
}

module.exports = {
    getCustomerDetails
};
