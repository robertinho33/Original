function csvEscape(value) {
    const text = value === null || value === undefined
        ? ""
        : String(value);

    return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows = []) {
    if (!rows.length) {
        return "";
    }

    const columns = Object.keys(rows[0]);

    const header = columns
        .map(csvEscape)
        .join(",");

    const body = rows.map(row =>
        columns
            .map(column => csvEscape(row[column]))
            .join(",")
    );

    return [header, ...body].join("\n");
}

module.exports = {
    toCsv
};
