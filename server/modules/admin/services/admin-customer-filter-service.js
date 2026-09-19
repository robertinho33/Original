const repository = require("../repositories/admin-customer-filter-repository");

async function searchCustomers(term) {
    return repository.searchCustomers(term);
}

module.exports = {
    searchCustomers
};
