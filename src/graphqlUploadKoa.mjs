import { processRequest } from './processRequest'

/**
 * Creates [Koa](https://koajs.com) middleware that processes GraphQL multipart
 * requests using [`processRequest`]{@link processRequest}, ignoring
 * non-multipart requests. It sets the request body to be [similar to a
 * conventional GraphQL POST request]{@link GraphQLOperation} for following
 * GraphQL middleware to consume.
 * @kind function
 * @name graphqlUploadKoa
 * @param {UploadOptions} options GraphQL upload options.
 * @returns {Function} Koa middleware.
 * @example <caption>Basic [`graphql-api-koa`](https://npm.im/graphql-api-koa) setup.</caption>
 * ```js
 * import Koa from 'koa'
 * import bodyParser from 'koa-bodyparser'
 * import { errorHandler, execute } from 'graphql-api-koa'
 * import { graphqlUploadKoa } from 'graphql-upload'
 * import schema from './schema'
 *
 * new Koa()
 *   .use(errorHandler())
 *   .use(bodyParser())
 *   .use(graphqlUploadKoa({ maxFileSize: 10000000, maxFiles: 10 }))
 *   .use(execute({ schema }))
 *   .listen(3000)
 * ```
 */
export const graphqlUploadKoa = options => async (ctx, next) => {
  if (!ctx.request.is('multipart/form-data')) return next()

  const finished = new Promise(resolve => ctx.req.on('end', resolve))

  try {
    ctx.request.body = await processRequest(ctx.req, ctx.res, options)
    await next()
  } finally {
    await finished
  }
}
