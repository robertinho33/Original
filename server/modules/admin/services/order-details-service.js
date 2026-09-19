const repository =
    require("../repositories/order-details-repository");

async function getOrderDetails(id) {
    return repository.getOrderDetails(id);
}

module.exports = {
    getOrderDetails
};
