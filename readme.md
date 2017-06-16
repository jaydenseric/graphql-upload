# ![Apollo upload server](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/v2.0.1/apollo-upload-logo.svg)

![NPM version](https://img.shields.io/npm/v/apollo-upload-server.svg?style=flat-square) ![Github issues](https://img.shields.io/github/issues/jaydenseric/apollo-upload-server.svg?style=flat-square) ![Github stars](https://img.shields.io/github/stars/jaydenseric/apollo-upload-server.svg?style=flat-square)

Enhances [Apollo](http://apollodata.com) for intuitive file uploads via GraphQL mutations or queries. Use with [Apollo upload client](https://github.com/jaydenseric/apollo-upload-client).

- [Express](http://expressjs.com) and [Koa](http://koajs.com) supported.
- Node >= 6.4 supported.
- [MIT license](https://en.wikipedia.org/wiki/MIT_License).

## Setup

### Install

With [NPM](https://www.npmjs.com):

```
npm install apollo-upload-server --save
```

With [Yarn](https://yarnpkg.com):

```
yarn add apollo-upload-server
```

### Server middleware

Add the server middleware just before [graphql-server](https://github.com/apollographql/graphql-server).

For [Express](http://expressjs.com):

```js
import {apolloUploadExpress} from 'apollo-upload-server'

// ✂

app.use(
  '/graphql',
  bodyParser.json(),
  apolloUploadExpress({
    // Optional, defaults to OS temp directory
    uploadDir: '/tmp/uploads'
  }),
  graphqlExpress(/* ✂ */)
)

// ✂
```

For [Koa](http://koajs.com):

```js
import {apolloUploadKoa} from 'apollo-upload-server'

// ✂

router.post(
  '/graphql',
  apolloUploadKoa({
    // Optional, defaults to OS temp directory
    uploadDir: '/tmp/uploads'
  }),
  graphqlKoa(/* ✂ */)
)

// ✂
```

### Types

Add an input type to your schema. You can name it anything but it must have this shape:

```graphql
input File {
  name: String!
  type: String!
  size: Int!
  path: String!
}
```

### Client

Also setup [Apollo upload client](https://github.com/jaydenseric/apollo-upload-client).

## Usage

Once setup, you will be able to use [`File`](https://developer.mozilla.org/en/docs/Web/API/File) objects, [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList) objects, or `File` arrays within query or mutation input variables. See the [client usage](https://github.com/jaydenseric/apollo-upload-client#usage).

The files upload to a temp directory. The file path and metadata will be available under the variable name in the resolver in the shape of the input `File` type in the GraphQL schema.

The resolver variable will hold an array if it is populated as a list (`FileList` or `File` array) on the client – even if the list has only 1 file.

### Single file

In types:

```graphql
type Mutation {
  updateUserAvatar (userId: String!, avatar: File!): User!
}
```

In resolvers:

```js
updateUserAvatar (root, {userId, avatar}) {
  // Auth…
  // Update avatar…
  console.log(`New avatar for user ${userId} is ${avatar.size} bytes`)
  // Return fresh user data…
}
```

See [client usage for this example](https://github.com/jaydenseric/apollo-upload-client#single-file).

### Multiple files

In types:

```graphql
type Mutation {
  updateGallery (galleryId: String!, images: [File!]!): Gallery!
}
```

In resolvers:

```js
updateGallery (root, {galleryId, images}) {
  // Auth…
  // Update gallery…
  console.log(`New images for gallery ${userId}:`)
  images.forEach((image, index) => console.log(`Image ${index} is ${image.size} bytes`))
  // Return fresh gallery data…
}
```

See [client usage for this example](https://github.com/jaydenseric/apollo-upload-client#multiple-files).

## Caveats

- No max upload file size option yet.

## Inspiration

- [@HriBB](https://github.com/HriBB)’s [graphql-server-express-upload](https://github.com/HriBB/graphql-server-express-upload) and [apollo-upload-network-interface](https://github.com/HriBB/apollo-upload-network-interface) projects.
- [@danielbuechele](https://github.com/danielbuechele)’s [Medium article](https://medium.com/@danielbuechele/file-uploads-with-graphql-and-apollo-5502bbf3941e).
- [@jessedvrs](https://github.com/jessedvrs)’s [example code](https://github.com/HriBB/apollo-upload-network-interface/issues/5#issuecomment-280018715).
