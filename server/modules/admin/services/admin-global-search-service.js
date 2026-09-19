const repository =
    require("../repositories/admin-global-search-repository");

async function search(term) {

    if (!term || term.trim().length < 2) {
        return [];
    }

    return repository.search(term);
}

module.exports = {
    search
};
