# apollo-upload-server change log

## next

- Added a change log.
- Dropped Yarn in favor of npm@5. Removed `yarn.lock` and updated install instructions.
- Updated dependencies.

## 2.0.1

- Support regular requests from clients other than apollo-upload-client again, fixing [#4](https://github.com/jaydenseric/apollo-upload-server/issues/4).
- Removed incorrect commas from example GraphQL input type.
- Updated dependencies.

## 2.0.0

- Support `apollo-upload-client` v3 and [query batching](http://dev.apollodata.com/core/network.html#query-batching).
- Clearer package description.

## 1.1.0

- Exporting a new helper function for processing requests. It can be used to create custom middleware, or middleware for unsupported routers.
- Exporting new Koa middleware.
- Upload directory is ensured on every request now. While slightly less efficient, it prevents major errors when if it is deleted while the server is running.
- Documented NPM install as well as Yarn.
- Typo fix in the readme.
- Updated dependencies.

## 1.0.2

- Fixed broken Github deep links in the readme.
- Readme rewording.
- Simplified `package.json` description.

## 1.0.1

- Added missing metadata to `package.json`.
- Added and a link in the readme.

## 1.0.0

Initial release.
