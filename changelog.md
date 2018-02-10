# apollo-upload-server changelog

## Next

* Updated dependencies, `graphql` peer dependency range updated for v0.13.0.
* HTTPS `package.json` author URL.

## 4.0.2

* Temporary solution for importing CommonJS in `.mjs`, fixing reopened [#40](https://github.com/jaydenseric/apollo-upload-server/issues/40).

## 4.0.1

* Correct imports for vanilla Node.js `--experimental-modules` and `.mjs` support, fixing [#40](https://github.com/jaydenseric/apollo-upload-server/issues/40).

## 4.0.0

* Updated dependencies.
* Simplified npm scripts.
* Readme updates:
  * Documented [`Blob`](https://developer.mozilla.org/en/docs/Web/API/Blob) types, via [#39](https://github.com/jaydenseric/apollo-upload-server/pull/39).
  * Explained how to use `processRequest` for custom middleware.
  * Improved usage instructions.
  * Display oldest supported Node.js version.
  * Misc. tweaks including a simpler heading structure.

## 4.0.0-alpha.3

* Updated dependencies.
* Updated peer dependencies to support `graphql@0.12`, via [#36](https://github.com/jaydenseric/apollo-upload-server/pull/36).

## 4.0.0-alpha.2

* Updated dependencies.
* Smarter Babel config with `.babelrc.js`.
* Transpile and polyfill for Node.js v6.10+ (down from v7.6+) to [support AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html), fixing [#33](https://github.com/jaydenseric/apollo-upload-server/issues/33).
* Modular project structure that works better for native ESM.
* Added tests.
* Set up Travis to test using the latest stable Node.js version and the oldest supported in `package.json` `engines` (v6.10).
* Added a Travis readme badge.
* Refactor to use fewer Busboy event listeners.
* Improved error handling, fixing [#26](https://github.com/jaydenseric/apollo-upload-server/issues/26):
  * Custom errors are thrown or emitted with meaningful messages that are exported so consumers can use `instanceof` with them.
  * Where it makes sense, errors cause relevant HTTP status codes to be set in middleware.
  * [Misordered multipart fields](https://github.com/jaydenseric/graphql-multipart-request-spec) cause `processRequest` to throw `MapBeforeOperationsUploadError` and `FilesBeforeMapUploadError` errors in middleware.
  * The `map` field provided by the client is used to naively check the `maxFiles` option is not exceeded for a speedy `MaxFilesUploadError` error in middleware. The real number of files parsed is checked too, incase the request is malformed.
  * If files are missing from the request the `scalar Upload` promises reject with a `FileMissingUploadError` error.
  * Already if a file exceeds the `maxFileSize` option the file is truncated, the stream emits a `limit` event and `stream.truncated === true`. Now an `error` event is also emitted with a `MaxFileSizeUploadError`.
  * Aborting requests from the client causes `scalar Upload` promises to reject with a `UploadPromiseDisconnectUploadError` error for file upload streams that have not yet been parsed. For streams being parsed an `error` event is emitted with an `FileStreamDisconnectUploadError` error and `stream.truncated === true`. It is up to consumers to cleanup aborted streams in their resolvers.

## 4.0.0-alpha.1

* New API to support the [GraphQL multipart request spec v2.0.0-alpha.2](https://github.com/jaydenseric/graphql-multipart-request-spec/releases/tag/v2.0.0-alpha.2). Files no longer upload to the filesystem; [readable streams](https://nodejs.org/api/stream.html#stream_readable_streams) are used in resolvers instead. Fixes [#13](https://github.com/jaydenseric/apollo-upload-server/issues/13) via [#22](https://github.com/jaydenseric/apollo-upload-server/pull/22).
* Export a new `Upload` scalar type to use in place of the old `Upload` input type. It represents a file upload promise that resolves an object containing `stream`, `filename`, `mimetype` and `encoding`.
* Deprecated the `uploadDir` middleware option.
* Added new `maxFieldSize`, `maxFileSize` and `maxFiles` middleware options.
* `graphql` is now a peer dependency.
* Middleware are now arrow functions.

## 3.0.0

* Updated Node.js support from v6.4+ to v7.6+.
* Using Babel directly, dropping Rollup.
* New directory structure for compiled files.
* Module files now have `.mjs` extension.
* No longer publish the `src` directory.
* No more sourcemaps.
* Use an arrow function for the Koa middleware, to match the Express middleware.
* Express middleware now passes on errors instead of blocking, via [#20](https://github.com/jaydenseric/apollo-upload-server/pull/20).
* Compiled code is now prettier.
* Prettier markdown files.
* Updated package keywords.
* Updated an Apollo documentation link in the changelog.
* Readme improvements:
  * Added links to badges.
  * Removed the inspiration links; they are less relevant to the evolved codebase.
  * Fixed an Apollo link.
  * Replaced example resolver code with a link to the [Apollo upload examples](https://github.com/jaydenseric/apollo-upload-examples).

## 2.0.4

* Updated dependencies.
* Readme tweaks including a new licence badge.

## 2.0.3

* Updated dependencies.
* Removed `package-lock.json`. Lockfiles are [not recommended](https://github.com/sindresorhus/ama/issues/479#issuecomment-310661514) for packages.
* Moved Babel config out of `package.json` to prevent issues when consumers run Babel over `node_modules`.
* Readme tweaks and fixes:
  * Renamed the `File` input type `Upload` for clarity.
  * Wording and formatting improvements.
  * Covered React Native.
  * Documented custom middleware.

## 2.0.2

* Updated dependencies.
* Added a changelog.
* Dropped Yarn in favor of npm@5. Removed `yarn.lock` and updated install instructions.
* Set targeted Node version as a string for `babel-preset-env`.
* New ESLint config. Dropped [Standard Style](https://standardjs.com) and began using [Prettier](https://github.com/prettier/eslint-plugin-prettier).
* Using [lint-staged](https://github.com/okonet/lint-staged) to ensure contributors don't commit lint errors.
* Removed `build:watch` script. Use `npm run build -- --watch` directly.

## 2.0.1

* Updated dependencies.
* Support regular requests from clients other than apollo-upload-client again, fixing [#4](https://github.com/jaydenseric/apollo-upload-server/issues/4).
* Removed incorrect commas from example GraphQL input type.

## 2.0.0

* Support `apollo-upload-client` v3 and [query batching](https://apollographql.com/docs/apollo-server/requests.html#batching).
* Clearer package description.

## 1.1.0

* Updated dependencies.
* Exporting a new helper function for processing requests. It can be used to create custom middleware, or middleware for unsupported routers.
* Exporting new Koa middleware.
* Upload directory is ensured on every request now. While slightly less efficient, it prevents major errors when if it is deleted while the server is running.
* Documented npm install as well as Yarn.
* Typo fix in the readme.

## 1.0.2

* Fixed broken Github deep links in the readme.
* Readme rewording.
* Simplified `package.json` description.

## 1.0.1

* Added missing metadata to `package.json`.
* Added a link to apollographql/graphql-server in the readme.

## 1.0.0

* Initial release.
