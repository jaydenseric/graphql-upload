// @ts-check

/** @import { IncomingMessage } from "node:http" */

/**
 * Waits for a request to finish (either because it disconnects early, or it
 * finishes uploading).
 * @see [Node.js stream utility function `finished`](https://nodejs.org/api/stream.html#streamfinishedstream-options).
 * @param {IncomingMessage} request Request.
 * @returns {Promise<void>} Resolves once the request has finished.
 */
export default async function requestFinished(request) {
  if (!request.closed)
    await new Promise((resolve) => {
      request.once("close", resolve);
    });
}
