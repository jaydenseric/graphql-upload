# ![Apollo upload server](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/v1.0.0/apollo-upload-logo.svg)

![NPM version](https://img.shields.io/npm/v/apollo-upload-server.svg?style=flat-square) ![Github issues](https://img.shields.io/github/issues/jaydenseric/apollo-upload-server.svg?style=flat-square) ![Github stars](https://img.shields.io/github/stars/jaydenseric/apollo-upload-server.svg?style=flat-square)

In combination with [Apollo upload client](https://github.com/jaydenseric/apollo-upload-client), enhances [Apollo](http://apollodata.com) for intuitive file uploads via GraphQL mutations or queries.

- Node >= 6.4 supported.
- [MIT license](https://en.wikipedia.org/wiki/MIT_License).

## Setup

Install with [Yarn](https://yarnpkg.com):

```
yarn add apollo-upload-server
```

Add the server middleware just before `graphqlExpress`:

```js
import {apolloUploadExpress} from 'apollo-upload-server'
```

```js
app.use(
  '/graphql',
  bodyParser.json(),
  apolloUploadExpress({
    // Optional, defaults to OS temp directory
    uploadDir: '/tmp/uploads'
  }),
  graphqlExpress()
)
```

Add this type to your schema:

```graphql
input File {
  name: String!,
  type: String!,
  size: Int!,
  path: String!
}
```

Also setup [Apollo upload client](https://github.com/jaydenseric/apollo-upload-client).

## Usage

Once setup, you will be able to use [`File`](https://developer.mozilla.org/en/docs/Web/API/File) objects, [`FileList`](https://developer.mozilla.org/en/docs/Web/API/FileList) objects, or `File` arrays within query or mutation input variables. See the [client usage](https://github.com/jaydenseric/apollo-upload-client#Usage).

The files upload to a temp directory. The file path and metadata will be avalable under the variable name in the resolver in the shape of the input `File` type in the GraphQL schema.

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

See [client usage for this example](https://github.com/jaydenseric/apollo-upload-client#Single-file).

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

See [client usage for this example](https://github.com/jaydenseric/apollo-upload-client#Multiple-files).

## Caveats

- No max upload file size option yet.

## Inspiration

- [@HriBB](https://github.com/HriBB)’s [apollo-upload-network-interface](https://github.com/HriBB/apollo-upload-network-interface) and [graphql-server-express-upload](https://github.com/HriBB/graphql-server-express-upload) projects.
- [@danielbuechele](https://github.com/danielbuechele)’s [Medium article](https://medium.com/@danielbuechele/file-uploads-with-graphql-and-apollo-5502bbf3941e).
- [@jessedvrs](https://github.com/jessedvrs)’s [example code](https://github.com/HriBB/apollo-upload-network-interface/issues/5#issuecomment-280018715).
