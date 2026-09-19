const reportRepository = require("../repositories/admin-report-repository");

async function getSalesReport() {
    return reportRepository.getSalesReport();
}

async function getProductReport() {
    return reportRepository.getProductReport();
}

async function getCustomerReport() {
    return reportRepository.getCustomerReport();
}

module.exports = {
    getSalesReport,
    getProductReport,
    getCustomerReport
};
