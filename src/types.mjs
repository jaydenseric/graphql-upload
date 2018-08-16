import { GraphQLScalarType } from 'graphql'

/**
 * GraphQL `Upload` scalar that can be used in a [`GraphQLSchema`](https://graphql.org/graphql-js/type/#graphqlschema).
 * @kind class
 * @name GraphQLUpload
 * @example <caption>Setup for a schema built with [`makeExecutableSchema`](https://apollographql.com/docs/graphql-tools/generate-schema#makeExecutableSchema).</caption>
 * ```js
 * import { makeExecutableSchema } from 'graphql-tools'
 * import { GraphQLUpload } from 'apollo-upload-server'
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
