const repository =
    require("../repositories/inventory-history-repository");

async function getHistory(limit) {
    return repository.getInventoryHistory(limit);
}

module.exports = {
    getHistory
};
