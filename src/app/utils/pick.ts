/**
 * Extracts only the whitelisted keys from an object. Used everywhere we
 * build a Prisma `where`/`data` clause from `req.query` or `req.body`, so
 * that a stray extra field (e.g. "role": "ADMIN") can never sneak into a
 * database write or filter.
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}
