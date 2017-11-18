![Apollo upload logo](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/v2.0.4/apollo-upload-logo.svg)

# apollo-upload-server

[![npm version](https://img.shields.io/npm/v/apollo-upload-server.svg)](https://npm.im/apollo-upload-server) ![Licence](https://img.shields.io/npm/l/apollo-upload-server.svg) [![Github issues](https://img.shields.io/github/issues/jaydenseric/apollo-upload-server.svg)](https://github.com/jaydenseric/apollo-upload-server/issues) [![Github stars](https://img.shields.io/github/stars/jaydenseric/apollo-upload-server.svg)](https://github.com/jaydenseric/apollo-upload-server/stargazers)

Enhances [Apollo](https://apollographql.com) for intuitive file uploads via GraphQL mutations or queries. Use with [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

## Setup

Install with [npm](https://www.npmjs.com):

```
npm install apollo-upload-server
```

### Middleware

Add the server middleware just before [graphql-server](https://github.com/apollographql/graphql-server).

#### [Koa](http://koajs.com)

```js
import { apolloUploadKoa } from 'apollo-upload-server'

// …

router.post(
  '/graphql',
  koaBody(),
  apolloUploadKoa({
    // Defaults to OS temp directory
    uploadDir: './uploads'
  }),
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
  apolloUploadExpress({
    // Defaults to OS temp directory
    uploadDir: './uploads'
  }),
  graphqlExpress(/* … */)
)
```

#### Custom middleware

If the middleware you need is not available, import the async `processRequest` function to make your own:

```js
import { processRequest } from 'apollo-upload-server'
```

### GraphQL schema

Add an input type for uploads to your schema. You can name it anything but it must have this shape:

```graphql
input Upload {
  name: String!
  type: String!
  size: Int!
  path: String!
}
```

### Client

Also setup [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

## Usage

Once setup, you will be able to use [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList), [`File`](https://developer.mozilla.org/en/docs/Web/API/File) and [`ReactNativeFile`](https://github.com/jaydenseric/apollo-upload-client#react-native) instances anywhere within mutation or query input variables. See the [client usage](https://github.com/jaydenseric/apollo-upload-client#usage).

The files upload to a configurable temp directory. `Upload` input type metadata replaces file instances in the arguments received by the resolver.

See the [example API and client](https://github.com/jaydenseric/apollo-upload-examples)

## Support

* Node.js: See `package.json` `engines`.
* [Koa](http://koajs.com).
* [Express](http://expressjs.com).
