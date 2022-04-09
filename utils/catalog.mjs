export const parseCatalog = (catalog) => {
    const result = [];
    if (!catalog.includes("~")) {
        result.push(catalog);
        return result;
    }
    const [labelPart, numberPart] = catalog.split('-');
    const [start, end] = numberPart.split('~');
    for (let i = parseInt(start); i <= parseInt(`${start.slice(0, start.length - end.length)}${end}`); i++) {
        result.push(`${labelPart}-${i}`);
    }
    return result;
};
