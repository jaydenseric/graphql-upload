// @ts-check

import { rejects, strictEqual } from "node:assert";
import { createServer } from "node:http";
import { suite, test } from "node:test";
import { promisify } from "node:util";

import { listen } from "async-listen";

import serverClose from "./serverClose.mjs";

suite(
  "Function `serverClose`.",
  {
    concurrency: true,
  },
  () => {
    test("Server not listening.", async () => {
      await rejects(serverClose(createServer()), {
        code: "ERR_SERVER_NOT_RUNNING",
      });
    });

    test("Server listening.", async () => {
      /** @type {PromiseWithResolvers<void>} */
      const requestReceived = Promise.withResolvers();

      const server = createServer(() => {
        requestReceived.resolve();

        // Deliberately don’t end the response, leaving an active connection
        // that `serverClose` must terminate.
      });
      const url = await listen(server);
      const fetchRejects = rejects(fetch(url));

      // Ensure the request reached the server before attempting to close it.
      await requestReceived.promise;
      await serverClose(server);

      strictEqual(server.listening, false);
      strictEqual(await promisify(server.getConnections).call(server), 0);

      // Terminating the active connection should cause the fetch to reject.
      await fetchRejects;
    });
  },
);
