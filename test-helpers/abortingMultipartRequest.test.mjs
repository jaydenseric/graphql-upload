// @ts-check

import { ok, rejects, strictEqual } from "node:assert";
import { createServer } from "node:http";
import { getDefaultHighWaterMark } from "node:stream";
import { describe, it } from "node:test";

import { listen } from "async-listen";

import requestFinished from "../requestFinished.mjs";
import abortingMultipartRequest from "./abortingMultipartRequest.mjs";

const defaultHighWaterMark = getDefaultHighWaterMark(false);
const textEncoder = new TextEncoder();

describe(
  "Function `abortingMultipartRequest`.",
  {
    concurrency: true,
  },
  () => {
    it("Errors for an empty abort marker.", async () => {
      await rejects(
        abortingMultipartRequest(
          new URL("https://test.test"),
          new FormData(),
          new Uint8Array(),
          Promise.resolve(),
        ),
        {
          name: "TypeError",
          message: "Abort marker mustn’t be empty.",
        },
      );
    });

    it("Errors when the abort marker is missing.", async () => {
      const formData = new FormData();

      formData.append("a", "b");

      await rejects(
        abortingMultipartRequest(
          new URL("https://test.test"),
          formData,
          new Uint8Array([0, 1, 2, 3, 4]),
          Promise.resolve(),
        ),
        {
          name: "TypeError",
          message: "Multipart request abort marker missing.",
        },
      );
    });

    it("Fetch error.", async () => {
      const abortMarkerString = "⛔";
      const formData = new FormData();

      formData.append("1", abortMarkerString);

      await rejects(
        abortingMultipartRequest(
          new URL("https://test.test"),
          formData,
          textEncoder.encode(abortMarkerString),
          // An unsettled promise to ensure the fetch is sent before it’s
          // aborted.
          new Promise(() => {}),
        ),
        {
          name: "TypeError",
          message: "fetch failed",
        },
      );
    });

    it("Aborts the multipart request.", async () => {
      let serverError;

      /** @type {PromiseWithResolvers<void>} */
      const done = Promise.withResolvers();

      /** @type {PromiseWithResolvers<void>} */
      const requestReceived = Promise.withResolvers();

      /** @type {Array<Buffer>} */
      const receivedBodyChunks = [];

      const server = createServer(async (request, response) => {
        try {
          requestReceived.resolve();

          request
            .on("data", (chunk) => {
              receivedBodyChunks.push(chunk);
            })
            .resume();

          await requestFinished(request);

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
        const preAbortMarkerString = "⏹️";
        const preAbortMarker = textEncoder.encode(preAbortMarkerString);
        const abortMarkerString = "⛔";
        const abortMarker = textEncoder.encode(abortMarkerString);
        const formData = new FormData();

        formData.append(
          "1",
          new File(
            [
              // Try to abort within a chunk after the first.
              `${"a".repeat(defaultHighWaterMark * 2)}${preAbortMarkerString}${abortMarkerString}${"a".repeat(10)}`,
            ],
            "a.txt",
            {
              type: "text/plain",
            },
          ),
        );

        await abortingMultipartRequest(
          url,
          formData,
          abortMarker,
          requestReceived.promise,
        );

        await done.promise;

        // Todo: Remove this conditionality after dropping support for Node.js
        // v18.
        if (Number(process.versions.node.split(".", 1)[0]) >= 22)
          ok(receivedBodyChunks.length > 1);

        const receivedBody = Buffer.concat(receivedBodyChunks);

        ok(receivedBody.indexOf(preAbortMarker) >= 0);
        strictEqual(receivedBody.indexOf(abortMarker), -1);

        if (serverError) throw serverError;
      } finally {
        server.close();
      }
    });
  },
);
