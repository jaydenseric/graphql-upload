![Apollo upload logo](https://cdn.rawgit.com/jaydenseric/apollo-upload-server/v2.0.4/apollo-upload-logo.svg)

# apollo-upload-server

![npm version](https://img.shields.io/npm/v/apollo-upload-server.svg?style=flat-square)
![Licence](https://img.shields.io/npm/l/apollo-upload-server.svg?style=flat-square)
![Github issues](https://img.shields.io/github/issues/jaydenseric/apollo-upload-server.svg?style=flat-square)
![Github stars](https://img.shields.io/github/stars/jaydenseric/apollo-upload-server.svg?style=flat-square)

Enhances [Apollo](http://apollodata.com) for intuitive file uploads via GraphQL mutations or queries. Use with [apollo-upload-client](https://github.com/jaydenseric/apollo-upload-client).

## Setup

### Install

With [npm](https://www.npmjs.com):

```
npm install apollo-upload-server
```

### Server middleware

Add the server middleware just before [graphql-server](https://github.com/apollographql/graphql-server).

#### [Express](http://expressjs.com)

```js
import { apolloUploadExpress } from 'apollo-upload-server'

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

#### [Koa](http://koajs.com)

```js
import { apolloUploadKoa } from 'apollo-upload-server'

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

#### Custom middleware

If the middleware you need is not available, import the asynchronous function `processRequest` to make your own:

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

### Single file

In types:

```graphql
type Mutation {
  updateUserAvatar(userId: String!, avatar: Upload!): User!
}
```

In resolvers:

```js
updateUserAvatar(root, { userId, avatar }) {
  // ✂ Auth
  // ✂ Update avatar
  console.log(`New avatar for user ${userId} is ${avatar.size} bytes`)
  // ✂ Return fresh user data
}
```

See [client usage for this example](https://github.com/jaydenseric/apollo-upload-client#single-file).

### Multiple files

In types:

```graphql
type Mutation {
  updateGallery(galleryId: String!, images: [Upload!]!): Gallery!
}
```

In resolvers:

```js
updateGallery(root, { galleryId, images }) {
  // ✂ Auth
  // ✂ Update gallery
  console.log(`New images for gallery ${galleryId}:`)
  images.forEach((image, index) =>
    console.log(`Image ${index} is ${image.size} bytes`)
  )
  // ✂ Return fresh gallery data
}
```

See [client usage for this example](https://github.com/jaydenseric/apollo-upload-client#multiple-files).

## Support

- Node >= 6.4.
- [Express](http://expressjs.com).
- [Koa](http://koajs.com).

## Inspiration

- [@HriBB](https://github.com/HriBB)’s [graphql-server-express-upload](https://github.com/HriBB/graphql-server-express-upload) and [apollo-upload-network-interface](https://github.com/HriBB/apollo-upload-network-interface) projects.
- [@danielbuechele](https://github.com/danielbuechele)’s [Medium article](https://medium.com/@danielbuechele/file-uploads-with-graphql-and-apollo-5502bbf3941e).
- [@jessedvrs](https://github.com/jessedvrs)’s [example code](https://github.com/HriBB/apollo-upload-network-interface/issues/5#issuecomment-280018715).
