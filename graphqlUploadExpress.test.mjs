import { deepStrictEqual, ok, strictEqual } from "assert";
import express from "express";
import { File, FormData } from "formdata-node";
import createError from "http-errors";
import fetch from "node-fetch";

import graphqlUploadExpress from "./graphqlUploadExpress.js";
import processRequest from "./processRequest.js";
import listen from "./test/listen.mjs";

export default (tests) => {
  tests.add(
    "`graphqlUploadExpress` with a non-multipart request.",
    async () => {
      let processRequestRan = false;

      const app = express().use(
        graphqlUploadExpress({
          async processRequest() {
            processRequestRan = true;
          },
        })
      );

      const { port, close } = await listen(app);

      try {
        await fetch(`http://localhost:${port}`, { method: "POST" });
        strictEqual(processRequestRan, false);
      } finally {
        close();
      }
    }
  );

  tests.add("`graphqlUploadExpress` with a multipart request.", async () => {
    let requestBody;

    const app = express()
      .use(graphqlUploadExpress())
      .use((request, response, next) => {
        requestBody = request.body;
        next();
      });

    const { port, close } = await listen(app);

    try {
      const body = new FormData();

      body.append("operations", JSON.stringify({ variables: { file: null } }));
      body.append("map", JSON.stringify({ 1: ["variables.file"] }));
      body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

      await fetch(`http://localhost:${port}`, { method: "POST", body });

      ok(requestBody);
      ok(requestBody.variables);
      ok(requestBody.variables.file);
    } finally {
      close();
    }
  });

  tests.add(
    "`graphqlUploadExpress` with a multipart request and option `processRequest`.",
    async () => {
      let processRequestRan = false;
      let requestBody;

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

      const { port, close } = await listen(app);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } })
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(`http://localhost:${port}`, { method: "POST", body });

        strictEqual(processRequestRan, true);
        ok(requestBody);
        ok(requestBody.variables);
        ok(requestBody.variables.file);
      } finally {
        close();
      }
    }
  );

  tests.add(
    "`graphqlUploadExpress` with a multipart request and option `processRequest` throwing an exposed HTTP error.",
    async () => {
      let expressError;
      let requestCompleted;
      let responseStatusCode;

      const error = createError(400, "Message.");
      const app = express()
        .use((request, response, next) => {
          const { send } = response;

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
        .use((error, request, response, next) => {
          expressError = error;
          responseStatusCode = response.statusCode;

          // Sending a response here prevents the default Express error handler
          // from running, which would undesirably (in this case) display the
          // error in the console.
          if (response.headersSent) next(error);
          else response.send();
        });

      const { port, close } = await listen(app);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } })
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(`http://localhost:${port}`, { method: "POST", body });

        deepStrictEqual(expressError, error);
        ok(
          requestCompleted,
          "Response wasn’t delayed until the request completed."
        );
        strictEqual(responseStatusCode, error.status);
      } finally {
        close();
      }
    }
  );

  tests.add(
    "`graphqlUploadExpress` with a multipart request following middleware throwing an error.",
    async () => {
      let expressError;
      let requestCompleted;

      const error = new Error("Message.");
      const app = express()
        .use((request, response, next) => {
          const { send } = response;

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
        .use((error, request, response, next) => {
          expressError = error;

          // Sending a response here prevents the default Express error handler
          // from running, which would undesirably (in this case) display the
          // error in the console.
          if (response.headersSent) next(error);
          else response.send();
        });

      const { port, close } = await listen(app);

      try {
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({ variables: { file: null } })
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append("1", new File(["a"], "a.txt", { type: "text/plain" }));

        await fetch(`http://localhost:${port}`, { method: "POST", body });

        deepStrictEqual(expressError, error);
        ok(
          requestCompleted,
          "Response wasn’t delayed until the request completed."
        );
      } finally {
        close();
      }
    }
  );
};
