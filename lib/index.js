'use strict'

exports.GraphQLUpload = require('./GraphQLUpload')
exports.processRequest = require('./processRequest')
exports.graphqlUploadKoa = require('./graphqlUploadKoa')
exports.graphqlUploadExpress = require('./graphqlUploadExpress')

/**
 * File upload details, resolved from an [`Upload` scalar]{@link GraphQLUpload}
 * promise.
 * @kind typedef
 * @name FileUpload
 * @type {object}
 * @prop {string} filename File name.
 * @prop {string} mimetype File MIME type. Provided by the client and can’t be trusted.
 * @prop {string} encoding File stream transfer encoding.
 * @prop {FileUploadCreateReadStream} createReadStream Creates a [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) of the file’s contents, for processing and storage.
 */

/**
 * Creates a [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) of an [uploading file’s]{@link FileUpload} contents, for processing and storage. Multiple calls create independent streams. Throws if called after all resolvers have resolved, or after an error has interrupted the request.
 * @kind typedef
 * @name FileUploadCreateReadStream
 * @type {Function}
 * @param {object} [options] Options.
 * @param {string} [options.encoding]
 * @param {number} [options.highWaterMark]
 * @returns {Readable} [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) of the file’s contents.
 */

/**
 * A GraphQL operation object in a shape that can be consumed and executed by
 * most GraphQL servers.
 * @kind typedef
 * @name GraphQLOperation
 * @type {object}
 * @prop {string} query GraphQL document containing queries and fragments.
 * @prop {string|null} [operationName] GraphQL document operation name to execute.
 * @prop {object|null} [variables] GraphQL document operation variables and values map.
 * @see [GraphQL over HTTP spec](https://github.com/APIs-guru/graphql-over-http#request-parameters).
 * @see [Apollo Server POST requests](https://www.apollographql.com/docs/apollo-server/requests#postRequests).
 */

/**
 * Processes a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * @kind typedef
 * @name ProcessRequestFunction
 * @type {Function}
 * @param {IncomingMessage} request [Node.js HTTP server request instance](https://nodejs.org/api/http.html#http_class_http_incomingmessage).
 * @param {ServerResponse} response [Node.js HTTP server response instance](https://nodejs.org/api/http.html#http_class_http_serverresponse).
 * @param {ProcessRequestOptions} [options] Options for processing the request.
 * @returns {Promise<GraphQLOperation | Array<GraphQLOperation>>} GraphQL operation or batch of operations for a GraphQL server to consume (usually as the request body).
 */

/**
 * Options for processing a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec);
 * mostly relating to security, performance and limits.
 * @kind typedef
 * @name ProcessRequestOptions
 * @type {object}
 * @prop {number} [maxFieldSize=1000000] Maximum allowed non-file multipart form field size in bytes; enough for your queries.
 * @prop {number} [maxFileSize=Infinity] Maximum allowed file size in bytes.
 * @prop {number} [maxFiles=Infinity] Maximum allowed number of files.
 */
