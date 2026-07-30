// @ts-check

/**
 * @import { ErrorRequestHandler } from "express"
 * @import Upload from "./Upload.mjs"
 */

import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert";
import { createServer } from "node:http";
import { getDefaultHighWaterMark } from "node:stream";
import { suite, test } from "node:test";

import { listen } from "async-listen";
import express from "express";
import createError from "http-errors";

import graphqlUploadExpress from "./graphqlUploadExpress.mjs";
import processRequest from "./processRequest.mjs";
import abortingMultipartRequest from "./test-helpers/abortingMultipartRequest.mjs";
import serverClose from "./test-helpers/serverClose.mjs";

const defaultHighWaterMark = getDefaultHighWaterMark(false);
const textEncoder = new TextEncoder();

suite(
  "Function `graphqlUploadExpress`.",
  {
    concurrency: true,
  },
  () => {
    test("Non multipart request.", async () => {
      let processRequestRan = false;

      const server = createServer(
        express().use(
          graphqlUploadExpress({
            async processRequest() {
              processRequestRan = true;
              return {};
            },
          }),
        ),
      );

      const url = await listen(server);

      try {
        await fetch(url, { method: "POST" });
        strictEqual(processRequestRan, false);
      } finally {
        await serverClose(server);
      }
    });

    test("Multipart request.", async () => {
      /**
       * @type {{
       *   variables: {
       *     file: Upload,
       *   },
       * } | undefined}
       */
      let requestBody;

      const server = createServer(
        express()
          .use(graphqlUploadExpress())
          .use((request, _response, next) => {
            requestBody = request.body;
            next();
          }),
      );

      const url = await listen(server);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } }),
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(url, { method: "POST", body });

        ok(requestBody);
        ok(requestBody.variables);
        ok(requestBody.variables.file);
      } finally {
        await serverClose(server);
      }
    });

    test("Multipart request and option `processRequest`.", async () => {
      let processRequestRan = false;

      /**
       * @type {{
       *   variables: {
       *     file: Upload,
       *   },
       * } | undefined}
       */
      let requestBody;

      const server = createServer(
        express()
          .use(
            graphqlUploadExpress({
              processRequest(...args) {
                processRequestRan = true;
                return processRequest(...args);
              },
            }),
          )
          .use((request, _response, next) => {
            requestBody = request.body;
            next();
          }),
      );

      const url = await listen(server);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } }),
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(url, { method: "POST", body });

        ok(processRequestRan);
        ok(requestBody);
        ok(requestBody.variables);
        ok(requestBody.variables.file);
      } finally {
        await serverClose(server);
      }
    });

    test("Multipart request and option `processRequest` throwing an exposed HTTP error.", async () => {
      let expressError;
      let requestCompleted;
      let responseStatusCode;

      const error = createError(400, "Message.");
      const server = createServer(
        express()
          .use((request, response, next) => {
            const { send } = response;

            // Todo: Find a less hacky way.
            response.send = (...args) => {
              requestCompleted = request.complete;

              response.send = send;
              response.send(...args);

              return response;
            };

            next();
          })
          .use(
            graphqlUploadExpress({
              async processRequest(request) {
                request.resume();
                throw error;
              },
            }),
          )
          .use(
            /** @type {ErrorRequestHandler} */ (
              (error, _request, response, next) => {
                expressError = error;
                responseStatusCode = response.statusCode;

                // Sending a response here prevents the default Express error
                // handler from running, which would undesirably (in this case)
                // display the error in the console.
                if (response.headersSent) next(error);
                else response.send();
              }
            ),
          ),
      );

      const url = await listen(server);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } }),
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(url, { method: "POST", body });

        deepStrictEqual(expressError, error);
        ok(
          requestCompleted,
          "Response wasn’t delayed until the request completed.",
        );
        strictEqual(responseStatusCode, error.status);
      } finally {
        await serverClose(server);
      }
    });

    test("Multipart request following middleware throwing an error.", async () => {
      let expressError;
      let requestCompleted;

      const error = new Error("Message.");
      const server = createServer(
        express()
          .use((request, response, next) => {
            const { send } = response;

            // Todo: Find a less hacky way.
            response.send = (...args) => {
              requestCompleted = request.complete;

              response.send = send;
              response.send(...args);

              return response;
            };

            next();
          })
          .use(graphqlUploadExpress())
          .use(() => {
            throw error;
          })
          .use(
            /** @type {ErrorRequestHandler} */ (
              (error, _request, response, next) => {
                expressError = error;

                // Sending a response here prevents the default Express error
                // handler from running, which would undesirably (in this case)
                // display the error in the console.
                if (response.headersSent) next(error);
                else response.send();
              }
            ),
          ),
      );

      const url = await listen(server);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } }),
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(url, { method: "POST", body });

        deepStrictEqual(expressError, error);
        ok(
          requestCompleted,
          "Response wasn’t delayed until the request completed.",
        );
      } finally {
        await serverClose(server);
      }
    });

    test("An aborted multipart request.", async () => {
      let serverError;

      /** @type {PromiseWithResolvers<void>} */
      const done = Promise.withResolvers();

      /** @type {PromiseWithResolvers<void>} */
      const requestReceived = Promise.withResolvers();

      const server = createServer(
        express()
          .use((_request, _response, next) => {
            requestReceived.resolve();
            next();
          })
          .use(graphqlUploadExpress())
          .use(async (request, response) => {
            try {
              const operation = /** @type {{ variables: { file: Upload } }} */ (
                request.body
              );

              const upload = await operation.variables.file.promise;

              await rejects(
                new Promise((resolve, reject) => {
                  upload
                    .createReadStream()
                    .once("error", reject)
                    .once("end", resolve)
                    .resume();
                }),
                {
                  name: "BadRequestError",
                  message:
                    "Request disconnected during file upload stream parsing.",
                  status: 499,
                  expose: true,
                },
              );
            } catch (error) {
              serverError = error;
            } finally {
              response.send();
              done.resolve();
            }
          }),
      );

      const url = await listen(server);

      try {
        const abortMarkerString = "⛔";
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } }),
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append(
          "1",
          new File(
            [
              // Try to abort within a chunk after the first.
              `${"a".repeat(defaultHighWaterMark * 2)}${abortMarkerString}${"a".repeat(10)}`,
            ],
            "a.txt",
            { type: "text/plain" },
          ),
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
        await serverClose(server);
      }
    });
  },
);
