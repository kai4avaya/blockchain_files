const generatedIds = new Set();

export function generateUniqueId(length = 3) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let uniqueId = '';
    do {
        uniqueId = '';
        for (let i = 0; i < length; i++) {
            uniqueId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
    } while (generatedIds.has(uniqueId));
    generatedIds.add(uniqueId);
    return uniqueId;
}