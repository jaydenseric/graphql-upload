// @ts-check

/** @import Upload from "./Upload.mjs" */

import "./test/polyfillFile.mjs";

import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { createServer } from "node:http";
import { describe, it } from "node:test";

import { listen } from "async-listen";
import Koa from "koa";

import graphqlUploadKoa from "./graphqlUploadKoa.mjs";
import processRequest from "./processRequest.mjs";

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
          .use(async () => {
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
  },
);
