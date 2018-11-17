import { GraphQLScalarType } from 'graphql'

/**
 * A GraphQL `Upload` scalar that can be used in a [`GraphQLSchema`](https://graphql.org/graphql-js/type/#graphqlschema).
 * It’s value in resolvers is a promise that resolves [file upload details]{@link FileUpload}
 * for processing and storage.
 * @kind class
 * @name GraphQLUpload
 * @example <caption>Setup for a schema built with [`makeExecutableSchema`](https://apollographql.com/docs/graphql-tools/generate-schema#makeExecutableSchema).</caption>
 * ```js
 * import { makeExecutableSchema } from 'graphql-tools'
 * import { GraphQLUpload } from 'graphql-upload'
 *
 * const typeDefs = `
 *   scalar Upload
 * `
 *
 * const resolvers = {
 *   Upload: GraphQLUpload
 * }
 *
 * export const schema = makeExecutableSchema({ typeDefs, resolvers })
 * ```
 * @example <caption>A manually constructed schema with an image upload mutation.</caption>
 * ```js
 * import { GraphQLSchema, GraphQLObjectType, GraphQLBoolean } from 'graphql'
 * import { GraphQLUpload } from 'graphql-upload'
 *
 * export const schema = new GraphQLSchema({
 *   mutation: new GraphQLObjectType({
 *     name: 'Mutation',
 *     fields: {
 *       uploadImage: {
 *         description: 'Uploads an image.',
 *         type: GraphQLBoolean,
 *         args: {
 *           image: {
 *             description: 'Image file.',
 *             type: GraphQLUpload
 *           }
 *         },
 *         async resolve(parent, { image }) {
 *           const { filename, mimetype, createReadStream } = await image
 *           const stream = createReadStream()
 *           // Promisify the stream and store the file, then…
 *           return true
 *         }
 *       }
 *     }
 *   })
 * })
 * ```
 */
export const GraphQLUpload = new GraphQLScalarType({
  name: 'Upload',
  description: 'The `Upload` scalar type represents a file upload.',
  parseValue: value => value,
  parseLiteral() {
    throw new Error('‘Upload’ scalar literal unsupported.')
  },
  serialize() {
    throw new Error('‘Upload’ scalar serialization unsupported.')
  }
})

/**
 * File upload details, resolved from an [`Upload` scalar]{@link GraphQLUpload} promise.
 * @kind typedef
 * @name FileUpload
 * @type {Object}
 * @prop {string} filename File name.
 * @prop {string} mimetype File MIME type. Provided by the client and can’t be trusted.
 * @prop {string} encoding File stream transfer encoding.
 * @prop {function} createReadStream Returns a Node.js readable stream of the file contents, for processing and storing the file. Multiple calls create independent streams. Throws if called after all resolvers have resolved, or after an error has interrupted the request.
 */
