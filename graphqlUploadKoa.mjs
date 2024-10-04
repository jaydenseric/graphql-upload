// @ts-check

/**
 * @import { ParameterizedContext } from "koa"
 * @import {
 *   ProcessRequestFunction,
 *   ProcessRequestOptions,
 * } from "./processRequest.mjs"
 */

import defaultProcessRequest from "./processRequest.mjs";

/**
 * Creates [Koa](https://koajs.com) middleware that processes incoming
 * [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * using {@linkcode processRequest}, ignoring non multipart requests. It sets
 * the request `body` to be similar to a conventional GraphQL POST request for
 * following GraphQL middleware to consume.
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
   * [Koa](https://koajs.com) middleware that processes incoming
   * [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec)
   * using {@linkcode processRequest}, ignoring non multipart requests. It sets
   * the request `body` to be similar to a conventional GraphQL POST request for
   * following GraphQL middleware to consume.
   * @param {ParameterizedContext} ctx
   * @param {() => Promise<unknown>} next
   */
  async function graphqlUploadKoaMiddleware(ctx, next) {
    if (!ctx.request.is("multipart/form-data")) return next();

    const requestEnd = new Promise((resolve) => ctx.req.on("end", resolve));

    try {
      // @ts-ignore This is conventional.
      ctx.request.body = await processRequest(
        ctx.req,
        ctx.res,
        processRequestOptions,
      );
      await next();
    } finally {
      await requestEnd;
    }
  }

  return graphqlUploadKoaMiddleware;
}
