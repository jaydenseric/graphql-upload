/**
 * Checks if a value is an object with properties.
 * @kind function
 * @name isObject
 * @param {*} value Value to check.
 * @returns {boolean} Is the value an object.
 * @ignore
 */
export const isObject = value => value && value.constructor === Object
