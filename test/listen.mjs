// @ts-check

/**
 * Starts a Node.js HTTP server.
 * @param {import("node:http").Server} server Node.js HTTP server.
 * @returns Resolves the port the server is listening on, and a server close
 *   function.
 */
export default async function listen(server) {
  await new Promise((resolve) => {
    server.listen(resolve);
  });

  return {
    port: /** @type {import("node:net").AddressInfo} */ (server.address()).port,
    close: () => server.close(),
  };
}
