![graphql-upload logo](https://cdn.jsdelivr.net/gh/jaydenseric/graphql-upload@8.0.0/graphql-upload-logo.svg)

# graphql-upload

Middleware and a scalar [`Upload`](./GraphQLUpload.mjs) to add support for [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec) (file uploads via queries and mutations) to various Node.js GraphQL servers.

[Clients implementing the GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec#client) upload files as [`Upload`](./GraphQLUpload.mjs) scalar query or mutation variables. Their resolver values are promises that resolve file upload details for processing and storage. Files are typically streamed into cloud storage but may also be stored in the filesystem.

## Installation

> [!TIP]
>
> First, check if there are [GraphQL multipart request spec server implementations](https://github.com/jaydenseric/graphql-multipart-request-spec#server) (most for Node.js integrate [`graphql-upload`](https://npm.im/graphql-upload)) that are more suitable for your environment than a manual setup.

To install [`graphql-upload`](https://npm.im/graphql-upload) and its peer dependency [`graphql`](https://npm.im/graphql) with [npm](https://npmjs.com/get-npm), run:

```sh
npm install graphql-upload graphql
```

Use the middleware [`graphqlUploadKoa`](./graphqlUploadKoa.mjs) or [`graphqlUploadExpress`](./graphqlUploadExpress.mjs) just before GraphQL middleware. Alternatively, use the function [`processRequest`](./processRequest.mjs) to create custom middleware.

A schema built with separate SDL and resolvers (e.g. using the function [`makeExecutableSchema`](https://www.graphql-tools.com/docs/api/modules/schema_src#makeexecutableschema) from [`@graphql-tools/schema`](https://npm.im/@graphql-tools/schema)) requires the scalar [`Upload`](./GraphQLUpload.mjs) to be setup.

Then, the scalar [`Upload`](./GraphQLUpload.mjs) can be used for query or mutation arguments. For how to use the scalar value in resolvers, see the documentation in the module [`GraphQLUpload.mjs`](./GraphQLUpload.mjs).

## Examples

- [Apollo upload examples repo](https://github.com/jaydenseric/apollo-upload-examples); a full stack demo of file uploads via GraphQL mutations using [`apollo-server-koa`](https://npm.im/apollo-server-koa) and [`@apollo/client`](https://npm.im/@apollo/client).

## Tips

- The process must have both read and write access to the directory identified by [`os.tmpdir()`](https://nodejs.org/api/os.html#ostmpdir).
- The device requires sufficient disk space to buffer the expected number of concurrent upload requests.
- Promisify and await file upload streams in resolvers or the server will send a response to the client before uploads are complete, causing a disconnect.
- Handle file upload promise rejection and stream errors; uploads sometimes fail due to network connectivity issues or impatient users disconnecting.
- Process multiple uploads asynchronously with [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) or a more flexible solution such as [`Promise.allSettled`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) where an error in one does not reject them all.
- Only use the function `createReadStream` _before_ the resolver returns; late calls (e.g. in an unawaited async function or callback) throw an error. Existing streams can still be used after a response is sent, although there are few valid reasons for not awaiting their completion.
- Use [`stream.destroy()`](https://nodejs.org/api/stream.html#readabledestroyerror) when an incomplete stream is no longer needed, or temporary files may not get cleaned up.

## Architecture

The [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec) allows a file to be used for multiple query or mutation variables (file deduplication), and for variables to be used in multiple places. GraphQL resolvers need to be able to manage independent file streams. As resolvers are executed asynchronously, it’s possible they will try to process files in a different order than received in the multipart request.

[`busboy`](https://npm.im/busboy) parses multipart request streams. Once the `operations` and `map` fields have been parsed, scalar [`Upload`](./GraphQLUpload.mjs) values in the GraphQL operations are populated with promises, and the operations are passed down the middleware chain to GraphQL resolvers.

[`fs-capacitor`](https://npm.im/fs-capacitor) is used to buffer file uploads to the filesystem and coordinate simultaneous reading and writing. As soon as a file upload’s contents begins streaming, its data begins buffering to the filesystem and its associated promise resolves. GraphQL resolvers can then create new streams from the buffer by calling the function `createReadStream`. The buffer is destroyed once all streams have ended or closed and the server has responded to the request. Any remaining buffer files will be cleaned when the process exits.

## Requirements

Supported runtime environments:

- [Node.js](https://nodejs.org) versions `^18.18.0 || ^20.9.0 || >=22.0.0`.

Projects must configure [TypeScript](https://typescriptlang.org) to use types from the ECMAScript modules that have a `// @ts-check` comment:

- [`compilerOptions.allowJs`](https://typescriptlang.org/tsconfig#allowJs) should be `true`.
- [`compilerOptions.maxNodeModuleJsDepth`](https://typescriptlang.org/tsconfig#maxNodeModuleJsDepth) should be reasonably large, e.g. `10`.
- [`compilerOptions.module`](https://typescriptlang.org/tsconfig#module) should be `"node16"` or `"nodenext"`.

## Exports

The [npm](https://npmjs.com) package [`graphql-upload`](https://npm.im/graphql-upload) features [optimal JavaScript module design](https://jaydenseric.com/blog/optimal-javascript-module-design). It doesn’t have a main index module, so use deep imports from the ECMAScript modules that are exported via the [`package.json`](./package.json) field [`exports`](https://nodejs.org/api/packages.html#exports):

- [`GraphQLUpload.mjs`](./GraphQLUpload.mjs)
- [`graphqlUploadExpress.mjs`](./graphqlUploadExpress.mjs)
- [`graphqlUploadKoa.mjs`](./graphqlUploadKoa.mjs)
- [`processRequest.mjs`](./processRequest.mjs)
- [`Upload.mjs`](./Upload.mjs)
