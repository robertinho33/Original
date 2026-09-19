const repository = require("../repositories/admin-order-filter-repository");

async function searchOrders(filters) {
    return repository.searchOrders(filters);
}

module.exports = {
    searchOrders
};
