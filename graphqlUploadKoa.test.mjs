// @ts-check

/** @import Upload from "./Upload.mjs" */

import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert";
import { createServer } from "node:http";
import { getDefaultHighWaterMark } from "node:stream";
import { describe, it } from "node:test";

import { listen } from "async-listen";
import Koa from "koa";

import graphqlUploadKoa from "./graphqlUploadKoa.mjs";
import processRequest from "./processRequest.mjs";
import abortingMultipartRequest from "./test-helpers/abortingMultipartRequest.mjs";

const defaultHighWaterMark = getDefaultHighWaterMark(false);
const textEncoder = new TextEncoder();

describe(
  "Function `graphqlUploadKoa`.",
  {
    concurrency: true,
  },
  () => {
    it("Non multipart request.", async () => {
      let processRequestRan = false;

      const server = createServer(
        new Koa()
          .use(
            graphqlUploadKoa({
              // eslint-disable-next-line jsdoc/reject-any-type
              /** @type {any} */
              async processRequest() {
                processRequestRan = true;
              },
            }),
          )
          .callback(),
      );

      const url = await listen(server);

      try {
        await fetch(url, { method: "POST" });
        strictEqual(processRequestRan, false);
      } finally {
        server.close();
      }
    });

    it("Multipart request.", async () => {
      /**
       * @type {{
       *   variables: {
       *     file: Upload,
       *   },
       * } | undefined}
       */
      let ctxRequestBody;

      const server = createServer(
        new Koa()
          .use(graphqlUploadKoa())
          .use(async (ctx, next) => {
            ctxRequestBody =
              // @ts-ignore By convention this should be present.
              ctx.request.body;
            await next();
          })
          .callback(),
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

        ok(ctxRequestBody);
        ok(ctxRequestBody.variables);
        ok(ctxRequestBody.variables.file);
      } finally {
        server.close();
      }
    });

    it("Multipart request and option `processRequest`.", async () => {
      let processRequestRan = false;

      /**
       * @type {{
       *   variables: {
       *     file: Upload,
       *   },
       * } | undefined}
       */
      let ctxRequestBody;

      const server = createServer(
        new Koa()
          .use(
            graphqlUploadKoa({
              processRequest(...args) {
                processRequestRan = true;
                return processRequest(...args);
              },
            }),
          )
          .use(async (ctx, next) => {
            ctxRequestBody =
              // @ts-ignore By convention this should be present.
              ctx.request.body;
            await next();
          })
          .callback(),
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

        strictEqual(processRequestRan, true);
        ok(ctxRequestBody);
        ok(ctxRequestBody.variables);
        ok(ctxRequestBody.variables.file);
      } finally {
        server.close();
      }
    });

    it("Multipart request and option `processRequest` throwing an error.", async () => {
      let koaError;
      let requestCompleted;

      const error = new Error("Message.");
      const server = createServer(
        new Koa()
          .on("error", (error) => {
            koaError = error;
          })
          .use(async (ctx, next) => {
            try {
              await next();
            } finally {
              requestCompleted = ctx.req.complete;
            }
          })
          .use(
            graphqlUploadKoa({
              async processRequest(request) {
                request.resume();
                throw error;
              },
            }),
          )
          .callback(),
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

        deepStrictEqual(koaError, error);
        ok(
          requestCompleted,
          "Response wasn’t delayed until the request completed.",
        );
      } finally {
        server.close();
      }
    });

    it("Multipart request and following middleware throwing an error.", async () => {
      let koaError;
      let requestCompleted;

      const error = new Error("Message.");
      const server = createServer(
        new Koa()
          .on("error", (error) => {
            koaError = error;
          })
          .use(async (ctx, next) => {
            try {
              await next();
            } finally {
              requestCompleted = ctx.req.complete;
            }
          })
          .use(graphqlUploadKoa())
          .use(() => {
            throw error;
          })
          .callback(),
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

        deepStrictEqual(koaError, error);
        ok(
          requestCompleted,
          "Response wasn’t delayed until the request completed.",
        );
      } finally {
        server.close();
      }
    });

    it("An aborted multipart request.", async () => {
      let serverError;

      /** @type {unknown} */
      let koaError;

      /** @type {PromiseWithResolvers<void>} */
      const done = Promise.withResolvers();

      /** @type {PromiseWithResolvers<void>} */
      const requestReceived = Promise.withResolvers();

      const server = createServer(
        new Koa()
          .on("error", (error) => {
            koaError = error;
          })
          .use(async (_ctx, next) => {
            requestReceived.resolve();

            try {
              await next();
            } catch (error) {
              serverError = error;
            } finally {
              done.resolve();
            }
          })
          .use(graphqlUploadKoa())
          .use(async (ctx) => {
            const operation = /** @type {{ variables: { file: Upload } }} */ (
              // @ts-ignore By convention this should be present.
              ctx.request.body
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
          })
          .callback(),
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

        ok(koaError instanceof Error);
        strictEqual(koaError.name, "Error");
        strictEqual(koaError.message, "Parse Error");
      } finally {
        server.close();
      }
    });
  },
);
