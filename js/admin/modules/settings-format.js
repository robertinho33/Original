const metadata = new Set(['id', 'key', 'name', 'setting_key', 'nome', 'description', 'label', 'details', 'updated_at', 'updatedAt', 'created_at', 'createdAt']);
const sensitive = /secret|token|password|credential|private.?key|api.?key/i;
function safeValue(value) {
    if (value !== null && typeof value === 'object') {
        return JSON.stringify(value, (key, item) => sensitive.test(key) ? '[protegido]' : item);
    }
    return value == null ? 'Não informado' : String(value);
}
export function normalizeSettings(settings) {
    return (Array.isArray(settings) ? settings : []).map(row => {
        const key = row.key ?? row.name ?? row.setting_key ?? row.nome ?? row.id ?? 'Sem identificador';
        const explicit = ['value', 'setting_value', 'content', 'valor'].find(field => row[field] !== undefined && row[field] !== null);
        const fields = Object.fromEntries(Object.entries(row).filter(([field]) => !metadata.has(field)));
        const value = sensitive.test(key) ? '[protegido]' : explicit ? safeValue(row[explicit]) : Object.keys(fields).length ? safeValue(fields) : 'Não informado';
        return {...row, key, value};
    });
}
