import { GraphQLScalarType } from 'graphql'

/**
 * GraphQL `Upload` scalar that can be used in a [`GraphQLSchema`](https://graphql.org/graphql-js/type/#graphqlschema).
 * @kind class
 * @name GraphQLUpload
 * @example <caption>How to import.</caption>
 * ```js
 * import { GraphQLUpload } from 'apollo-upload-server'
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
