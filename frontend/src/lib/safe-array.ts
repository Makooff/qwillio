// Defensive helper for API responses where shape is uncertain.
// Avoids "X.forEach is not a function" runtime errors on malformed payloads.
export const toArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
