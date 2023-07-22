import express, { NextFunction, Request, Response } from "express";
import createError from "http-errors";
import { createServer } from "node:http";
import fetch, { File, FormData } from "node-fetch";
import { graphqlUploadExpress } from "./graphqlUploadExpress";
import { processRequest } from "./processRequest";
import { listen } from "./test/listen";
import { describe, expect, it } from "vitest";
import { Upload } from "./Upload";

describe("graphqlUploadExpress", () => {
  it(
    "`graphqlUploadExpress` with a non multipart request.",
    async () => {
      let processRequestRan = false;

      const app = express().use(
        graphqlUploadExpress({
          // @ts-expect-error origonal author is this package is wild
          async processRequest() {
            processRequestRan = true;
          },
        })
      );

      const { port, close } = await listen(createServer(app));

      try {
        await fetch(`http://localhost:${port}`, { method: "POST" });
        expect(processRequestRan).toBe(false);
      } finally {
        close();
      }
    }
  );

  it("`graphqlUploadExpress` with a multipart request.", async () => {
    let requestBody: {
      variables: {
        file: Upload,
      },
    } | undefined;

    const app = express()
      .use(graphqlUploadExpress())
      .use((request, response, next) => {
        requestBody = request.body;
        next();
      });

    const { port, close } = await listen(createServer(app));

    try {
      const body = new FormData();

      body.append("operations", JSON.stringify({ variables: { file: null } }));
      body.append("map", JSON.stringify({ 1: ["variables.file"] }));
      body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

      await fetch(`http://localhost:${port}`, { method: "POST", body });

      expect(requestBody).toBeTruthy();
      expect(requestBody?.variables).toBeTruthy();
      expect(requestBody?.variables.file).toBeTruthy();
    } finally {
      close();
    }
  });

  it(
    "`graphqlUploadExpress` with a multipart request and option `processRequest`.",
    async () => {
      let processRequestRan = false;

      let requestBody: {
        variables: {
          file: Upload,
        },
      } | undefined;

      const app = express()
        .use(
          graphqlUploadExpress({
            processRequest(...args) {
              processRequestRan = true;
              return processRequest(...args);
            },
          })
        )
        .use((request, response, next) => {
          requestBody = request.body;
          next();
        });

      const { port, close } = await listen(createServer(app));

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } })
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(`http://localhost:${port}`, { method: "POST", body });

        expect(processRequestRan).toBe(true);
        expect(requestBody).toBeTruthy();
        expect(requestBody?.variables).toBeTruthy();
        expect(requestBody?.variables.file).toBeTruthy();
      } finally {
        close();
      }
    }
  );

  it(
    "`graphqlUploadExpress` with a multipart request and option `processRequest` throwing an exposed HTTP error.",
    async () => {
      let expressError;
      let requestCompleted;
      let responseStatusCode;

      const error = createError(400, "Message.");
      const app = express()
        .use((request, response, next) => {
          const { send } = response;

          // @ts-ignore Todo: Find a less hacky way.
          response.send = (...args) => {
            requestCompleted = request.complete;
            response.send = send;
            response.send(...args);
          };

          next();
        })
        .use(
          graphqlUploadExpress({
            async processRequest(request) {
              request.resume();
              throw error;
            },
          })
        )
        .use(
          (error: Error, request: Request, response: Response, next: NextFunction) => {
            expressError = error;
            responseStatusCode = response.statusCode;

            // Sending a response here prevents the default Express error handler
            // from running, which would undesirably (in this case) display the
            // error in the console.
            if (response.headersSent) next(error);
            else response.send();
          }
        );

      const { port, close } = await listen(createServer(app));

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } })
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(`http://localhost:${port}`, { method: "POST", body });

        expect(expressError).toStrictEqual(error);
        expect(requestCompleted).toBeTruthy();
        expect(responseStatusCode).toStrictEqual(error.status);
      } finally {
        close();
      }
    }
  );

  it(
    "`graphqlUploadExpress` with a multipart request following middleware throwing an error.",
    async () => {
      let expressError;
      let requestCompleted;

      const error = new Error("Message.");
      const app = express()
        .use((request, response, next) => {
          const { send } = response;

          // @ts-ignore Todo: Find a less hacky way.
          response.send = (...args) => {
            requestCompleted = request.complete;
            response.send = send;
            response.send(...args);
          };

          next();
        })
        .use(graphqlUploadExpress())
        .use(() => {
          throw error;
        })
        .use(
          /**
           * @param {Error} error
           * @param {import("express").Request} request
           * @param {import("express").Response} response
           * @param {import("express").NextFunction} next
           */
          (error: Error, request: Request, response: Response, next: NextFunction) => {
            expressError = error;

            // Sending a response here prevents the default Express error handler
            // from running, which would undesirably (in this case) display the
            // error in the console.
            if (response.headersSent) next(error);
            else response.send();
          }
        );

      const { port, close } = await listen(createServer(app));

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } })
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(`http://localhost:${port}`, { method: "POST", body });

        expect(expressError).toStrictEqual(error);
        expect(requestCompleted).toBeTruthy();
      } finally {
        close();
      }
    }
  );
});
