/**
 * Determines if a value is an enumerable object.
 * @kind function
 * @name isEnumerableObject
 * @param {*} value The value to check.
 * @returns {boolean} Is the value an enumerable object.
 * @ignore
 */
module.exports = function isEnumerableObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
