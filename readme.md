![Apollo upload logo](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/6831fef/apollo-upload-logo.svg)

# apollo-upload-server

[![npm version](https://badgen.net/npm/v/apollo-upload-server)](https://npm.im/apollo-upload-server) [![Build status](https://travis-ci.org/jaydenseric/apollo-upload-server.svg?branch=master)](https://travis-ci.org/jaydenseric/apollo-upload-server)

Enhances Node.js GraphQL servers for intuitive file uploads via GraphQL queries or mutations. Use with a [GraphQL multipart request spec client implementation](https://github.com/jaydenseric/graphql-multipart-request-spec#client) such as [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

Exported middleware parses [multipart GraphQL requests](https://github.com/jaydenseric/graphql-multipart-request-spec), setting a [typical GraphQL operation object](https://graphql.org/learn/serving-over-http#post-request) (or array when batching) as the request body for common GraphQL middleware to consume.

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

## Usage

Files uploaded via a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec) appear as [`Upload` scalars](#upload-scalar) in resolver arguments. The upload streams can be used to store the files in the local filesystem or in the cloud. See also [apollo-upload-client usage](https://github.com/jaydenseric/apollo-upload-client#usage) and the [example API and client](https://github.com/jaydenseric/apollo-upload-examples).

## API

### Table of contents

- [class GraphQLUpload](#class-graphqlupload)
  - [Examples](#examples)
- [function apolloUploadExpress](#function-apollouploadexpress)
  - [Examples](#examples-1)
- [function apolloUploadKoa](#function-apollouploadkoa)
  - [Examples](#examples-2)
- [function processRequest](#function-processrequest)
  - [Examples](#examples-3)
- [constant SPEC_URL](#constant-spec_url)
  - [Examples](#examples-4)
- [type GraphQLOperation](#type-graphqloperation)
  - [See](#see)
- [type UploadFile](#type-uploadfile)
- [type UploadOptions](#type-uploadoptions)

### class GraphQLUpload

GraphQL `Upload` scalar that can be used in a [`GraphQLSchema`](https://graphql.org/graphql-js/type/#graphqlschema).

#### Examples

_How to import._

> ```js
> import { GraphQLUpload } from 'apollo-upload-server'
> ```

### function apolloUploadExpress

Creates Express middleware that processes GraphQL multipart requests using [`processRequest`](#function-processrequest), ignoring non-multipart requests.

| Parameter | Type                                 | Description             |
| :-------- | :----------------------------------- | :---------------------- |
| `options` | [UploadOptions](#type-uploadoptions) | GraphQL upload options. |

**Returns:** [function](https://developer.mozilla.org/javascript/reference/global_objects/function) — Express middleware.

#### Examples

_Basic [`express-graphql`](https://npm.im/express-graphql) setup._

> ```js
> import express from 'express'
> import graphqlHTTP from 'express-graphql'
> import { apolloUploadExpress } from 'apollo-upload-server'
> import schema from './schema'
>
> express()
>   .use(
>     '/graphql',
>     apolloUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
>     graphqlHTTP({ schema })
>   )
>   .listen(3000)
> ```

### function apolloUploadKoa

Creates Koa middleware that processes GraphQL multipart requests using [`processRequest`](#function-processrequest), ignoring non-multipart requests.

| Parameter | Type                                 | Description             |
| :-------- | :----------------------------------- | :---------------------- |
| `options` | [UploadOptions](#type-uploadoptions) | GraphQL upload options. |

**Returns:** [function](https://developer.mozilla.org/javascript/reference/global_objects/function) — Koa middleware.

#### Examples

_Basic [`graphql-api-koa`](https://npm.im/graphql-api-koa) setup._

> ```js
> import Koa from 'koa'
> import bodyParser from 'koa-bodyparser'
> import { errorHandler, execute } from 'graphql-api-koa'
> import { apolloUploadKoa } from 'apollo-upload-server'
> import schema from './schema'
>
> new Koa()
>   .use(errorHandler())
>   .use(bodyParser())
>   .use(apolloUploadKoa({ maxFileSize: 10000000, maxFiles: 10 }))
>   .use(execute({ schema }))
>   .listen(3000)
> ```

### function processRequest

Processes a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec). Used in [`apolloUploadKoa`](#function-apollouploadkoa) and [`apolloUploadExpress`](#function-apollouploadexpress) and can be used to create custom middleware.

| Parameter  | Type                                  | Description                                                                                               |
| :--------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------- |
| `request`  | IncomingMessage                       | [Node.js HTTP server request instance](https://nodejs.org/api/http.html#http_class_http_incomingmessage). |
| `response` | ServerResponse                        | [Node.js HTTP server response instance](https://nodejs.org/api/http.html#http_class_http_serverresponse). |
| `options`  | [UploadOptions](#type-uploadoptions)? | GraphQL upload options.                                                                                   |

**Returns:** Promise&lt;[GraphQLOperation](#type-graphqloperation) | [Array](https://developer.mozilla.org/javascript/reference/global_objects/array)&lt;[GraphQLOperation](#type-graphqloperation)>> — GraphQL operation or batch of operations for a GraphQL server to consume (usually as the request body).

#### Examples

_How to import._

> ```js
> import { processRequest } from 'apollo-upload-server'
> ```

### constant SPEC_URL

Official [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec) URL. Useful for error messages, etc.

#### Examples

_How to import._

> ```js
> import { SPEC_URL } from 'apollo-upload-server'
> ```

### type GraphQLOperation

A GraphQL operation that can be consumed and executed by most GraphQL servers.

**Type:** [object](https://developer.mozilla.org/javascript/reference/global_objects/object)

| Property        | Type                                                                                        | Description                                          |
| :-------------- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------- |
| `query`         | [string](https://developer.mozilla.org/javascript/reference/global_objects/string)          | GraphQL document containing queries and fragments.   |
| `operationName` | [string](https://developer.mozilla.org/javascript/reference/global_objects/string) \| null? | GraphQL document operation name to execute.          |
| `variables`     | [object](https://developer.mozilla.org/javascript/reference/global_objects/object) \| null? | GraphQL document operation variables and values map. |

#### See

- [GraphQL over HTTP spec](https://github.com/APIs-guru/graphql-over-http#request-parameters).
- [Apollo Server POST requests](https://www.apollographql.com/docs/apollo-server/requests#postRequests).

### type UploadFile

Resolved details about a file upload.

**Type:** [object](https://developer.mozilla.org/javascript/reference/global_objects/object)

| Property           | Type                                                                                   | Description                                                                                                                                                                                           |
| :----------------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filename`         | [string](https://developer.mozilla.org/javascript/reference/global_objects/string)     | File name.                                                                                                                                                                                            |
| `mimetype`         | [string](https://developer.mozilla.org/javascript/reference/global_objects/string)     | File MIME type.                                                                                                                                                                                       |
| `encoding`         | [string](https://developer.mozilla.org/javascript/reference/global_objects/string)     | File stream transfer encoding.                                                                                                                                                                        |
| `createReadStream` | [function](https://developer.mozilla.org/javascript/reference/global_objects/function) | Returns a Node.js readable stream of the file contents. Multiple calls create independent streams. Throws if called after all resolvers have resolved, or after an error has interrupted the request. |

### type UploadOptions

GraphQL upload server options, mostly relating to security, performance and limits.

**Type:** [object](https://developer.mozilla.org/javascript/reference/global_objects/object)

| Property       | Type                                                                                             | Description                                                                           |
| :------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `maxFieldSize` | [number](https://developer.mozilla.org/javascript/reference/global_objects/number)? = `1000000`  | Maximum allowed non-file multipart form field size in bytes; enough for your queries. |
| `maxFileSize`  | [number](https://developer.mozilla.org/javascript/reference/global_objects/number)? = `Infinity` | Maximum allowed file size in bytes.                                                   |
| `maxFiles`     | [number](https://developer.mozilla.org/javascript/reference/global_objects/number)? = `Infinity` | Maximum allowed number of files.                                                      |
