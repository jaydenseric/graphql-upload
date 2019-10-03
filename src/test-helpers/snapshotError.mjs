/**
 * Snapshots an error.
 * @param {object} error An error.
 * @returns {string} Error snapshot.
 */
export const snapshotError = ({ name, message, status, statusCode, expose }) =>
  JSON.stringify({ name, message, status, statusCode, expose }, null, 2)
