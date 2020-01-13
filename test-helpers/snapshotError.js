'use strict'

/**
 * Snapshots an error.
 * @param {object} error An error.
 * @returns {string} Error snapshot.
 */
module.exports = function snapshotError({
  name,
  message,
  status,
  statusCode,
  expose
}) {
  return JSON.stringify({ name, message, status, statusCode, expose }, null, 2)
}
