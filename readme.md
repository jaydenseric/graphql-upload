This is a fork of [graphql-upload](https://github.com/jaydenseric/graphql-upload) by Jayden Seric which Apollo has created purely for the internal use of [Apollo Server](https://github.com/apollographql/apollo-server).

Apollo Server v2 depends on `graphql-upload` to provide an easy-to-use way to integrate `graphql-upload` into your servers without having to depend on `graphql-upload` yourself. It currently depends on v8 of `graphql-upload`.

`graphql-upload` made backwards-incompatible changes after v8, such as changing what Node versions are supported and removing the `stream` property that was later replaced with `createReadStream`. Because of this, we cannot upgrade the version of `graphql-upload` used by Apollo Server past v8 without potentially breaking users.

However, the latest release of `graphql-upload@8` (8.1.0) declares peer dependencies on `graphql` that do not include `graphql@15`. We want users of Apollo Server v2 to be able to use graphql v15 without getting peer dependencies warnings (or errors when they are using npm v7), so we have forked `graphql-upload` v8 just to extend the peer dependency.

We do not recommend that you directly depend on this fork. Our recommendation is that if you want to use uploads in your GraphQL server, you should consider disabling Apollo Server's built-in `graphql-upload` integration by passing `uploads: false` to `new ApolloServer` and use `graphql-upload` directly. That way, you can use the latest and greatest version of `graphql-upload`. We currently intend to remove the integration from Apollo Server v3.
