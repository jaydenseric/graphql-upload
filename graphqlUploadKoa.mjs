// @ts-check

/**
 * @import { Next, ParameterizedContext } from "koa"
 * @import {
 *   ProcessRequestFunction,
 *   ProcessRequestOptions,
 * } from "./processRequest.mjs"
 */

import defaultProcessRequest from "./processRequest.mjs";
import requestFinished from "./requestFinished.mjs";

/**
 * Creates [Koa](https://koajs.com) middleware that processes incoming
 * [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * using {@linkcode processRequest}, ignoring non multipart requests. It sets
 * the Koa context `request` property `body` to be similar to a conventional
 * GraphQL POST request for following GraphQL middleware to consume. Also, after
 * awaiting the next middleware it waits for the request to finish (either
 * because it disconnects early, or it finishes uploading and the response can
 * be sent), because sending a response before the request has finished
 * uploading typically causes the HTTP client to error without processing the
 * response.
 * @param {ProcessRequestOptions & {
 *   processRequest?: ProcessRequestFunction,
 * }} options Options.
 * @returns Koa middleware.
 * @example
 * Basic [`graphql-api-koa`](https://npm.im/graphql-api-koa) setup:
 *
 * ```js
 * import errorHandler from "graphql-api-koa/errorHandler.mjs";
 * import execute from "graphql-api-koa/execute.mjs";
 * import graphqlUploadKoa from "graphql-upload/graphqlUploadKoa.mjs";
 * import Koa from "koa";
 * import bodyParser from "koa-bodyparser";
 *
 * import schema from "./schema.mjs";
 *
 * new Koa()
 *   .use(errorHandler())
 *   .use(bodyParser())
 *   .use(graphqlUploadKoa({ maxFileSize: 10000000, maxFiles: 10 }))
 *   .use(execute({ schema }))
 *   .listen(3000);
 * ```
 */
export default function graphqlUploadKoa({
  processRequest = defaultProcessRequest,
  ...processRequestOptions
} = {}) {
  /**
   * @param {ParameterizedContext} ctx Koa context.
   * @param {Next} next Invokes the next middleware.
   */
  async function graphqlUploadKoaMiddleware(ctx, next) {
    if (ctx.request.is("multipart/form-data")) {
      try {
        // @ts-ignore This is conventional.
        ctx.request.body = await processRequest(
          ctx.req,
          ctx.res,
          processRequestOptions,
        );
        await next();
      } finally {
        await requestFinished(ctx.req);
      }
    } else await next();
  }

  return graphqlUploadKoaMiddleware;
}
