const repository =
    require("../repositories/reservation-repository");

async function getReservations() {
    return repository.getReservations();
}

module.exports = {
    getReservations
};
