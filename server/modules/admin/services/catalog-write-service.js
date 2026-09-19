const categoryRepository =
    require("../repositories/category-write-repository");

const couponRepository =
    require("../repositories/coupon-write-repository");

module.exports = {

    createCategory(data) {
        return categoryRepository.createCategory(data);
    },

    updateCategory(id, data) {
        return categoryRepository.updateCategory(
            id,
            data
        );
    },

    createCoupon(data) {
        return couponRepository.createCoupon(data);
    },

    updateCoupon(id, data) {
        return couponRepository.updateCoupon(
            id,
            data
        );
    }
};
