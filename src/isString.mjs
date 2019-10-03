/**
 * Checks if a value is a string.
 * @kind function
 * @name isString
 * @param {*} value Value to check.
 * @returns {boolean} Is the value a string.
 * @ignore
 */
export const isString = value =>
  typeof value === 'string' || value instanceof String
