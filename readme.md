![Apollo upload logo](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/6831fef/apollo-upload-logo.svg)

# apollo-upload-server

[![Build status](https://travis-ci.org/jaydenseric/apollo-upload-server.svg)](https://travis-ci.org/jaydenseric/apollo-upload-server) [![npm version](https://badgen.now.sh/npm/v/apollo-upload-server)](https://npm.im/apollo-upload-server)

Enhances Node.js GraphQL servers for intuitive file uploads via GraphQL queries or mutations. Use with a [GraphQL multipart request spec client implementation](https://github.com/jaydenseric/graphql-multipart-request-spec#client) such as [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

Exported middleware parses [multipart GraphQL requests](https://github.com/jaydenseric/graphql-multipart-request-spec), setting a [typical GraphQL operation object](https://graphql.org/learn/serving-over-http/#post-request) (or array when batching) as the request body for common GraphQL middleware to consume.

## Support

The following environments are known to be compatible, or feature this package built in:

- Node.js v8.5+
  - CJS
  - Native ESM with [`--experimental-modules`](https://nodejs.org/api/esm.html#esm_enabling)
- [Koa](https://koajs.com)
  - [`apollo-server-koa`](https://npm.im/apollo-server-koa) (built in)
  - [`graphql-api-koa`](https://npm.im/graphql-api-koa)
- [Express](https://expressjs.com)
  - [`apollo-server`](https://npm.im/apollo-server) (built in)
  - [`apollo-server-express`](https://npm.im/apollo-server-express) (built in)
  - [`express-graphql`](https://npm.im/express-graphql)
- [hapi](https://hapijs.com)
  - [`apollo-server-hapi`](https://npm.im/apollo-server-hapi) (built in)
- [Micro](https://github.com/zeit/micro)
  - [`apollo-server-micro`](https://npm.im/apollo-server-micro) (built in)

See also alternative [GraphQL multipart request spec server implementations](https://github.com/jaydenseric/graphql-multipart-request-spec#server).

## Setup

Setup is necessary if your environment doesn’t feature this package built in (see **_[Support](#support)_**).

To install [`apollo-upload-server`](https://npm.im/apollo-upload-server) and the [`graphql`](https://npm.im/graphql) peer dependency from [npm](https://npmjs.com) run:

```shell
npm install apollo-upload-server graphql
```

Add the middleware just before GraphQL middleware.

### Options

- `maxFieldSize` (integer): Max allowed non-file multipart form field size in bytes; enough for your queries (default: 1 MB).
- `maxFileSize` (integer): Max allowed file size in bytes (default: Infinity).
- `maxFiles` (integer): Max allowed number of files (default: Infinity).

### Koa

```js
import { apolloUploadKoa } from 'apollo-upload-server'

// …

router.post(
  '/graphql',
  koaBody(),
  apolloUploadKoa(/* Options */),
  graphqlKoa(/* … */)
)
```

### Express

```js
import { apolloUploadExpress } from 'apollo-upload-server'

// …

app.use(
  '/graphql',
  bodyParser.json(),
  apolloUploadExpress(/* Options */),
  graphqlExpress(/* … */)
)
```

### Custom middleware

Middleware wraps the async function `processRequest` which accepts a required [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage), a required [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse), and an optional [options object](#options) as arguments. It returns a promise that resolves an operations object for a GraphQL server to consume (usually as the request body). Import it to create custom middleware:

```js
import { processRequest } from 'apollo-upload-server'
```

### `Upload` scalar

A file upload promise that resolves an object containing:

- `filename`: `string` - the filename of the upload
- `mimetype`: `string` - the mimetype of the upload
- `encoding`: `string` - the encoding of the upload
- `createReadStream`: `() => ReadStream` - calling this method returns a readable stream of the upload's contents. Calling `createReadStream` multiple times will create multiple streams which can be read indipendantly of each other. Note that `createReadStream` will throw if called after all resolvers have finished, or after an error has interrupted the request.

It must be added to your types and resolvers:

```js
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLUpload } from 'apollo-upload-server'

const schema = makeExecutableSchema({
  typeDefs: `scalar Upload`,
  resolvers: { Upload: GraphQLUpload }
})
```

## Usage

Files uploaded via a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec) appear as [`Upload` scalars](#upload-scalar) in resolver arguments. The upload streams can be used to store the files in the local filesystem or in the cloud. See also [apollo-upload-client usage](https://github.com/jaydenseric/apollo-upload-client#usage) and the [example API and client](https://github.com/jaydenseric/apollo-upload-examples).
