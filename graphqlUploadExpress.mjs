// @ts-check

/**
 * @import { NextFunction, Request, Response } from "express"
 * @import {
 *   ProcessRequestFunction,
 *   ProcessRequestOptions,
 * } from "./processRequest.mjs"
 */

import defaultProcessRequest from "./processRequest.mjs";

/**
 * Creates [Express](https://expressjs.com) middleware that processes incoming
 * [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * using {@linkcode processRequest}, ignoring non multipart requests. It sets
 * the request `body` to be similar to a conventional GraphQL POST request for
 * following GraphQL middleware to consume.
 * @param {ProcessRequestOptions & {
 *   processRequest?: ProcessRequestFunction,
 * }} options Options.
 * @returns Express middleware.
 * @example
 * Basic [`express-graphql`](https://npm.im/express-graphql) setup:
 *
 * ```js
 * import express from "express";
 * import expressGraphQL from "express-graphql";
 * import graphqlUploadExpress from "graphql-upload/graphqlUploadExpress.mjs";
 *
 * import schema from "./schema.mjs";
 *
 * express()
 *   .use(
 *     "/graphql",
 *     graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
 *     expressGraphQL.graphqlHTTP({ schema })
 *   )
 *   .listen(3000);
 * ```
 */
export default function graphqlUploadExpress({
  processRequest = defaultProcessRequest,
  ...processRequestOptions
} = {}) {
  /**
   * [Express](https://expressjs.com) middleware that processes incoming
   * [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec)
   * using {@linkcode processRequest}, ignoring non multipart requests. It sets
   * the request `body` to be similar to a conventional GraphQL POST request for
   * following GraphQL middleware to consume.
   * @param {Request} request Express request.
   * @param {Response} response Express response.
   * @param {NextFunction} next Invokes the next middleware.
   */
  function graphqlUploadExpressMiddleware(request, response, next) {
    if (request.is("multipart/form-data")) {
      const requestEnd = new Promise((resolve) => request.on("end", resolve));
      const { send } = response;

      // @ts-ignore Todo: Find a less hacky way to prevent sending a response
      // before the request has ended.
      response.send = (...args) => {
        requestEnd.then(() => {
          response.send = send;
          response.send(...args);
        });
      };

      processRequest(request, response, processRequestOptions)
        .then((body) => {
          request.body = body;
          next();
        })
        .catch((error) => {
          if (error.status && error.expose) response.status(error.status);
          next(error);
        });
    } else next();
  }

  return graphqlUploadExpressMiddleware;
}
