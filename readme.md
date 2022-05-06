![graphql-upload logo](https://cdn.jsdelivr.net/gh/jaydenseric/graphql-upload@8.0.0/graphql-upload-logo.svg)

# graphql-upload

[![npm version](https://badgen.net/npm/v/graphql-upload)](https://npm.im/graphql-upload) [![CI status](https://github.com/jaydenseric/graphql-upload/workflows/CI/badge.svg)](https://github.com/jaydenseric/graphql-upload/actions)

Middleware and an [`Upload`](./GraphQLUpload.js) scalar to add support for [GraphQL multipart requests](https://github.com/jaydenseric/graphql-multipart-request-spec) (file uploads via queries and mutations) to various Node.js GraphQL servers.

## Installation

First, check if there are [GraphQL multipart request spec server implementations](https://github.com/jaydenseric/graphql-multipart-request-spec#server) (most for Node.js integrate [`graphql-upload`](https://npm.im/graphql-upload)) that are more suitable for your environment than a manual setup.

To install [`graphql-upload`](https://npm.im/graphql-upload) and the [`graphql`](https://npm.im/graphql) peer dependency with [npm](https://npmjs.com/get-npm), run:

```sh
npm install graphql-upload graphql
```

Use the [`graphqlUploadKoa`](./graphqlUploadKoa.js) or [`graphqlUploadExpress`](./graphqlUploadExpress.js) middleware just before GraphQL middleware. Alternatively, use [`processRequest`](./processRequest.js) to create custom middleware.

A schema built with separate SDL and resolvers (e.g. using [`makeExecutableSchema`](https://www.graphql-tools.com/docs/api/modules/schema#makeexecutableschema) from [`@graphql-tools/schema`](https://npm.im/@graphql-tools/schema)) requires the [`Upload`](./GraphQLUpload.js) scalar to be setup.

## Usage

[Clients implementing the GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec#client) upload files as [`Upload`](./GraphQLUpload.js) scalar query or mutation variables. Their resolver values are promises that resolve file upload details for processing and storage. Files are typically streamed into cloud storage but may also be stored in the filesystem.

See the [example API and client](https://github.com/jaydenseric/apollo-upload-examples).

### Tips

- The process must have both read and write access to the directory identified by [`os.tmpdir()`](https://nodejs.org/api/os.html#ostmpdir).
- The device requires sufficient disk space to buffer the expected number of concurrent upload requests.
- Promisify and await file upload streams in resolvers or the server will send a response to the client before uploads are complete, causing a disconnect.
- Handle file upload promise rejection and stream errors; uploads sometimes fail due to network connectivity issues or impatient users disconnecting.
- Process multiple uploads asynchronously with [`Promise.all`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all) or a more flexible solution such as [`Promise.allSettled`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) where an error in one does not reject them all.
- Only use the function `createReadStream` _before_ the resolver returns; late calls (e.g. in an unawaited async function or callback) throw an error. Existing streams can still be used after a response is sent, although there are few valid reasons for not awaiting their completion.
- Use [`stream.destroy()`](https://nodejs.org/api/stream.html#readabledestroyerror) when an incomplete stream is no longer needed, or temporary files may not get cleaned up.

## Architecture

The [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec) allows a file to be used for multiple query or mutation variables (file deduplication), and for variables to be used in multiple places. GraphQL resolvers need to be able to manage independent file streams. As resolvers are executed asynchronously, it’s possible they will try to process files in a different order than received in the multipart request.

[`busboy`](https://npm.im/busboy) parses multipart request streams. Once the `operations` and `map` fields have been parsed, [`Upload`](./GraphQLUpload.js) scalar values in the GraphQL operations are populated with promises, and the operations are passed down the middleware chain to GraphQL resolvers.

[`fs-capacitor`](https://npm.im/fs-capacitor) is used to buffer file uploads to the filesystem and coordinate simultaneous reading and writing. As soon as a file upload’s contents begins streaming, its data begins buffering to the filesystem and its associated promise resolves. GraphQL resolvers can then create new streams from the buffer by calling the function `createReadStream`. The buffer is destroyed once all streams have ended or closed and the server has responded to the request. Any remaining buffer files will be cleaned when the process exits.

## Requirements

- [Node.js](https://nodejs.org): `^14.17.0 || ^16.0.0 || >= 18.0.0`

## Exports

These ECMAScript modules are published to [npm](https://npmjs.com) and exported via the [`package.json`](./package.json) `exports` field:

- [`GraphQLUpload.js`](./GraphQLUpload.js)
- [`graphqlUploadExpress.js`](./graphqlUploadExpress.js)
- [`graphqlUploadKoa.js`](./graphqlUploadKoa.js)
- [`processRequest.js`](./processRequest.js)
- [`Upload.js`](./Upload.js)
