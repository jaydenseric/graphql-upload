// @ts-check

/**
 * @import { NextFunction, Request, Response } from "express"
 * @import {
 *   ProcessRequestFunction,
 *   ProcessRequestOptions,
 * } from "./processRequest.mjs"
 */

import defaultProcessRequest from "./processRequest.mjs";
import requestFinished from "./requestFinished.mjs";

/**
 * Creates [Express](https://expressjs.com) middleware that processes incoming
 * [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * using {@linkcode processRequest}, ignoring non multipart requests. It sets
 * the Express request property `body` to be similar to a conventional GraphQL
 * POST request for following GraphQL middleware to consume. Also, it
 * temporarily monkey patches the Express response method
 * {@linkcode Response.send send} to first wait for the request to finish
 * (either because it disconnects early, or it finishes uploading and the
 * response can be sent), because sending a response before the request has
 * finished uploading typically causes the HTTP client to error without
 * processing the response.
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
   * @param {Request} request Express request.
   * @param {Response} response Express response.
   * @param {NextFunction} next Invokes the next middleware.
   */
  function graphqlUploadExpressMiddleware(request, response, next) {
    if (request.is("multipart/form-data")) {
      // Todo: Find a less hacky way that avoids monkey patching.
      const { send } = response;
      response.send = (...args) => {
        requestFinished(request).then(() => {
          response.send = send;
          response.send(...args);
        });

        return response;
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
