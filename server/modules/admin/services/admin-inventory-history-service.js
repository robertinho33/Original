const repository = require("../repositories/admin-inventory-history-repository");

async function getInventoryHistory(productId) {
    return repository.getInventoryHistory(productId);
}

module.exports = {
    getInventoryHistory
};
