const repository = require("../repositories/admin-inventory-repository");

async function getStockDetails(id) {
    return repository.getStockDetails(id);
}

async function createMovement(data) {
    return repository.createMovement(data);
}

async function getReservations() {
    return repository.getReservations();
}

module.exports = {
    getStockDetails,
    createMovement,
    getReservations
};
