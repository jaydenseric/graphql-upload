// @ts-check

/** @import { Server } from "node:http" */

import { promisify } from "node:util";

/**
 * Closes a listening HTTP server and all its connections.
 * @param {Server} server Listening HTTP server.
 * @returns {Promise<void>} Resolves once the server is closed.
 */
export default async function serverClose(server) {
  const closed = promisify(server.close).call(server);

  server.closeAllConnections();

  await closed;
}
