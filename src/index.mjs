export { GraphQLUpload } from './GraphQLUpload'
export { processRequest } from './processRequest'
export { graphqlUploadKoa } from './graphqlUploadKoa'
export { graphqlUploadExpress } from './graphqlUploadExpress'

/**
 * File upload details, resolved from an [`Upload` scalar]{@link GraphQLUpload}
 * promise.
 * @kind typedef
 * @name FileUpload
 * @type {object}
 * @prop {string} filename File name.
 * @prop {string} mimetype File MIME type. Provided by the client and can’t be trusted.
 * @prop {string} encoding File stream transfer encoding.
 * @prop {Function} createReadStream Returns a Node.js readable stream of the file contents, for processing and storing the file. Multiple calls create independent streams. Throws if called after all resolvers have resolved, or after an error has interrupted the request.
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
 * GraphQL upload server options, mostly relating to security, performance and
 * limits.
 * @kind typedef
 * @name UploadOptions
 * @type {object}
 * @prop {number} [maxFieldSize=1000000] Maximum allowed non-file multipart form field size in bytes; enough for your queries.
 * @prop {number} [maxFileSize=Infinity] Maximum allowed file size in bytes.
 * @prop {number} [maxFiles=Infinity] Maximum allowed number of files.
 */
