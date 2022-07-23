// @ts-check

import { GraphQLError, GraphQLScalarType } from "graphql";

import Upload from "./Upload.mjs";

/** @typedef {import("./processRequest.mjs").FileUpload} FileUpload */

/**
 * A GraphQL `Upload` scalar that can be used in a
 * [`GraphQLSchema`](https://graphql.org/graphql-js/type/#graphqlschema). It’s
 * value in resolvers is a promise that resolves
 * {@link FileUpload file upload details} for processing and storage.
 * @example
 * A schema built using
 * [`makeExecutableSchema`](https://www.graphql-tools.com/docs/api/modules/schema_src#makeexecutableschema)
 * from [`@graphql-tools/schema`](https://npm.im/@graphql-tools/schema):
 *
 * ```js
 * import { makeExecutableSchema } from "@graphql-tools/schema/makeExecutableSchema";
 * import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";
 *
 * const schema = makeExecutableSchema({
 *   typeDefs: `
 *     scalar Upload
 *   `,
 *   resolvers: {
 *     Upload: GraphQLUpload,
 *   },
 * });
 * ```
 * @example
 * A manually constructed schema with an image upload mutation:
 *
 * ```js
 * import { GraphQLBoolean, GraphQLObjectType, GraphQLSchema } from "graphql";
 * import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";
 *
 * const schema = new GraphQLSchema({
 *   mutation: new GraphQLObjectType({
 *     name: "Mutation",
 *     fields: {
 *       uploadImage: {
 *         description: "Uploads an image.",
 *         type: GraphQLBoolean,
 *         args: {
 *           image: {
 *             description: "Image file.",
 *             type: GraphQLUpload,
 *           },
 *         },
 *         async resolve(parent, { image }) {
 *           const { filename, mimetype, createReadStream } = await image;
 *           const stream = createReadStream();
 *           // Promisify the stream and store the file, then…
 *           return true;
 *         },
 *       },
 *     },
 *   }),
 * });
 * ```
 */
const GraphQLUpload = new GraphQLScalarType({
  name: "Upload",
  description: "The `Upload` scalar type represents a file upload.",
  parseValue(value) {
    if (value instanceof Upload) return value.promise;
    throw new GraphQLError("Upload value invalid.");
  },
  parseLiteral(node) {
    throw new GraphQLError("Upload literal unsupported.", { nodes: node });
  },
  serialize() {
    throw new GraphQLError("Upload serialization unsupported.");
  },
});

export default GraphQLUpload;
