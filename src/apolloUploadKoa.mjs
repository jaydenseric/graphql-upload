import { processRequest } from './processRequest'

/**
 * Creates [Koa](https://koajs.com) middleware that processes GraphQL multipart
 * requests using [`processRequest`]{@link processRequest}, ignoring
 * non-multipart requests.
 * @kind function
 * @name apolloUploadKoa
 * @param {UploadOptions} options GraphQL upload options.
 * @returns {function} Koa middleware.
 * @example <caption>Basic [`graphql-api-koa`](https://npm.im/graphql-api-koa) setup.</caption>
 * ```js
 * import Koa from 'koa'
 * import bodyParser from 'koa-bodyparser'
 * import { errorHandler, execute } from 'graphql-api-koa'
 * import { apolloUploadKoa } from 'apollo-upload-server'
 * import schema from './schema'
 *
 * new Koa()
 *   .use(errorHandler())
 *   .use(bodyParser())
 *   .use(apolloUploadKoa({ maxFileSize: 10000000, maxFiles: 10 }))
 *   .use(execute({ schema }))
 *   .listen(3000)
 * ```
 */
export const apolloUploadKoa = options => async (ctx, next) => {
  if (!ctx.request.is('multipart/form-data')) return next()

  const finished = new Promise(resolve => ctx.req.on('end', resolve))

  try {
    ctx.request.body = await processRequest(ctx.req, ctx.res, options)
    await next()
  } finally {
    await finished
  }
}
