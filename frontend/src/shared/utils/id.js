/**
 * @returns {string} A new RFC4122 UUID from `crypto.randomUUID()` (browser / modern Node).
 */
export const createId = () => crypto.randomUUID();
