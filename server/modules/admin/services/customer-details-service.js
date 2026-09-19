const repository =
    require("../repositories/customer-details-repository");

async function getCustomerDetails(id) {
    return repository.getCustomerDetails(id);
}

module.exports = {
    getCustomerDetails
};
