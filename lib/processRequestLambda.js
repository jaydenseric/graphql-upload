'use strict'

const { Readable, Writable } = require('stream')
const { processRequest } = require('./processRequest')

/**
 * Used when handling file uploads on a lambda without the full Apollo-Server
 * Processes a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * It parses the `operations` and `map` fields to create an
 * [`Upload`]{@link Upload} instance for each expected file upload, placing
 * references wherever the file is expected in the
 * [GraphQL operation]{@link GraphQLOperation} for the
 * [`Upload` scalar]{@link GraphQLUpload} to derive it’s value. Errors are
 * created with [`http-errors`](https://npm.im/http-errors) to assist in
 * sending responses with appropriate HTTP status codes.
 * @kind function
 * @name processRequestLambda
 * @type {ProcessRequestLambdaFunction}
 * @example <caption>How to import.</caption>
 * ```js
 * const { processRequestLambda } = require('graphql-upload')
 * ```
 */
module.exports = function processRequestLambda(
  event,
  {
    maxFieldSize = 1000000, // 1 MB
    maxFileSize = Infinity,
    maxFiles = Infinity
  } = {}
) {
  const request = new Readable()
  const response = new Writable()

  request.headers = event.headers
  request.push(event.body)
  request.push(null)

  return processRequest(request, response, {
    maxFieldSize,
    maxFileSize,
    maxFiles
  })
}
