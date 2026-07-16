// @ts-check

import { ok, strictEqual } from "node:assert";
import { createServer } from "node:http";
import { getDefaultHighWaterMark } from "node:stream";
import { describe, it } from "node:test";

import { listen } from "async-listen";

import requestFinished from "./requestFinished.mjs";
import abortingMultipartRequest from "./test-helpers/abortingMultipartRequest.mjs";

const defaultHighWaterMark = getDefaultHighWaterMark(false);
const textEncoder = new TextEncoder();

describe(
  "Function `requestFinished`.",
  {
    concurrency: true,
  },
  () => {
    it("Request finishes uploading.", async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          request.resume();

          // Test awaiting an unfinished request.

          await requestFinished(request);

          ok(request.complete);

          // Test awaiting an already finished request doesn’t hang.

          await requestFinished(request);
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const url = await listen(server);

      try {
        const body = new FormData();

        body.append(
          "a",
          // Try to create a multi-chunk request.
          "a".repeat(defaultHighWaterMark * 2),
        );

        await fetch(url, { method: "POST", body });

        if (serverError) throw serverError;
      } finally {
        server.close();
      }
    });

    it("Request disconnects early.", async () => {
      let serverError;

      /** @type {PromiseWithResolvers<void>} */
      const done = Promise.withResolvers();

      /** @type {PromiseWithResolvers<void>} */
      const requestReceived = Promise.withResolvers();

      const server = createServer(async (request, response) => {
        try {
          requestReceived.resolve();

          request.resume();

          await requestFinished(request);

          ok(request.closed);
          strictEqual(request.complete, false);
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
          done.resolve();
        }
      });

      const url = await listen(server);

      try {
        const abortMarkerString = "⛔";
        const body = new FormData();

        body.append(
          "a",
          // Try to abort within a chunk after the first.
          `${"a".repeat(defaultHighWaterMark * 2)}${abortMarkerString}${"a".repeat(10)}`,
        );

        await abortingMultipartRequest(
          url,
          body,
          textEncoder.encode(abortMarkerString),
          requestReceived.promise,
        );

        await done.promise;

        if (serverError) throw serverError;
      } finally {
        server.close();
      }
    });
  },
);
