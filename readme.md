![Apollo upload logo](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/v4.0.0-alpha.1/apollo-upload-logo.svg)

# apollo-upload-server

[![npm version](https://img.shields.io/npm/v/apollo-upload-server.svg)](https://npm.im/apollo-upload-server) ![Licence](https://img.shields.io/npm/l/apollo-upload-server.svg) [![Github issues](https://img.shields.io/github/issues/jaydenseric/apollo-upload-server.svg)](https://github.com/jaydenseric/apollo-upload-server/issues) [![Github stars](https://img.shields.io/github/stars/jaydenseric/apollo-upload-server.svg)](https://github.com/jaydenseric/apollo-upload-server/stargazers)

Enhances [Apollo](https://apollographql.com) for intuitive file uploads via GraphQL queries or mutations. Use with [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

## Setup

Install with peer dependencies using [npm](https://www.npmjs.com):

```
npm install apollo-upload-server graphql
```

### Middleware

Add the middleware just before [graphql-server](https://github.com/apollographql/graphql-server).

#### Options

* `maxFieldSize` (integer): Max allowed non-file multipart form field size in bytes; enough for your queries (default: 1 MB).
* `maxFileSize` (integer): Max allowed file size in bytes (default: Infinity).
* `maxFiles` (integer): Max allowed number of files (default: Infinity).

#### [Koa](http://koajs.com)

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

#### [Express](http://expressjs.com)

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

#### Custom middleware

To make your own middleware import the `processRequest` async function:

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
  typeDefs: [`scalar Upload`],
  resolvers: {
    Upload: GraphQLUpload
  }
})
```

### Client

Also setup [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

## Usage

Once setup, on the client use [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList), [`File`](https://developer.mozilla.org/en/docs/Web/API/File) and [`ReactNativeFile`](https://github.com/jaydenseric/apollo-upload-client#react-native) instances anywhere within query or mutation input variables. See the [client usage](https://github.com/jaydenseric/apollo-upload-client#usage).

Files upload via a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec) and appear as [`Upload` scalars](#upload-scalar) in resolver arguments.

## Examples

Find server and client side examples in the the [apollo-upload-examples](https://github.com/jaydenseric/apollo-upload-examples) repository.

## Support

See `package.json` `engines`.
