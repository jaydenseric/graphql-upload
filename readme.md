![Apollo upload logo](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/6831fef/apollo-upload-logo.svg)

# apollo-upload-server

[![npm version](https://img.shields.io/npm/v/apollo-upload-server.svg)](https://npm.im/apollo-upload-server) ![Licence](https://img.shields.io/npm/l/apollo-upload-server.svg) [![Github issues](https://img.shields.io/github/issues/jaydenseric/apollo-upload-server.svg)](https://github.com/jaydenseric/apollo-upload-server/issues) [![Github stars](https://img.shields.io/github/stars/jaydenseric/apollo-upload-server.svg)](https://github.com/jaydenseric/apollo-upload-server/stargazers) [![Travis status](https://img.shields.io/travis/jaydenseric/apollo-upload-server.svg)](https://travis-ci.org/jaydenseric/apollo-upload-server)

Enhances [Apollo](https://apollographql.com) for intuitive file uploads via GraphQL queries or mutations. Use with a [GraphQL multipart request spec client implementation](https://github.com/jaydenseric/graphql-multipart-request-spec#client) such as [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

## Setup

Install with peer dependencies using [npm](https://www.npmjs.com):

```shell
npm install apollo-upload-server graphql
```

Add the middleware just before [graphql-server](https://github.com/apollographql/graphql-server).

### Options

* `maxFieldSize` (integer): Max allowed non-file multipart form field size in bytes; enough for your queries (default: 1 MB).
* `maxFileSize` (integer): Max allowed file size in bytes (default: Infinity).
* `maxFiles` (integer): Max allowed number of files (default: Infinity).

### [Koa](http://koajs.com)

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

### [Express](http://expressjs.com)

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

Middleware wraps the async function `processRequest` which accepts a Node.js request and an optional [options object](#options) as arguments. It returns a promise that resolves an operations object for a GraphQL server to consume (usually as the request body). Import it to create custom middleware:

```js
import { processRequest } from 'apollo-upload-server'
```

### `Upload` scalar

A file upload promise that resolves an object containing:

* `stream`
* `filename`
* `mimetype`
* `encoding`

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

## Support

* Node.js v6.10+, see `package.json` `engines`.
