import { Server } from "http";

/**
 * Starts a Node.js HTTP server.
 * @param {import("node:http").Server} server Node.js HTTP server.
 * @returns Resolves the port the server is listening on, and a server close
 *   function.
 */
export async function listen(server: Server) {
  await new Promise((resolve) => {
    server.listen(resolve);
  });

  const addressInfo = server.address();


  return {
    port: typeof addressInfo === 'string' ? undefined : addressInfo?.port,
    close: () => server.close(),
  };
}
