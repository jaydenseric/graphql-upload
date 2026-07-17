// @ts-check

/**
 * Checks if a value is an abort error.
 * @param {unknown} error Value to check.
 * @returns {boolean} Is the value an abort error.
 */
export default function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}
