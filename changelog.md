# apollo-upload-server changelog

## Next

### Major

- The `processRequest` function now requires a [`http.ServerResponse`](https://nodejs.org/api/http.html#http_class_http_serverresponse) instance as its second argument.
- `Upload` scalar promises now resolve with a `createReadStream` method instead of a `stream` property, via [#92](https://github.com/jaydenseric/apollo-upload-server/pull/92).
- Replaced the previously exported error classes with [`http-errors`](https://npm.im/http-errors) and snapshot tested error details, via [#105](https://github.com/jaydenseric/apollo-upload-server/pull/105).

### Minor

- An `Upload` variable can now be used by multiple resolvers, via [#92](https://github.com/jaydenseric/apollo-upload-server/pull/92).
- Multiple `Upload` scalar variables can now use the same multipart data, via [#92](https://github.com/jaydenseric/apollo-upload-server/pull/92).
- Export a new `ParseUploadError` that is thrown with a `400` status when `operations` or `map` multipart fields contain invalid JSON, fixing [#95](https://github.com/jaydenseric/apollo-upload-server/issues/95).
- Tweaked `GraphQLUpload` scalar description to remove details about how it resolves on the server as they are irrelevant to API users.
- Tweaked `GraphQLUpload` scalar error messages.

### Patch

- Updated dev dependencies.
- Removed the [`npm-run-all`](https://npm.im/npm-run-all) dev dependency and made scripts and tests sync for easier debugging, at the cost of slightly longer build times.
- Configured Prettier to lint `.yml` files.
- Explicitly set `processRequest` default options instead of relying on [`busboy`](https://npm.im/busboy) defaults.
- Ensure the readme Travis build status badge only tracks `master` branch.

## 6.0.0-alpha.1

Big thanks to new collaborator [@mike-marcacci](https://github.com/mike-marcacci) for his help solving tricky bugs and edge-cases!

### Major

- Updated Node.js support from v6.10+ to v8.5+ for [native ESM](https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V8.md#8.5.0), [object rest/spread properties](https://node.green#ES2018-features-object-rest-spread-properties), and [async functions](https://node.green#ES2017-features-async-functions).
- Removed the [`@babel/runtime`](https://npm.im/@babel/runtime) dependency and config.
- Fixed [#45](https://github.com/jaydenseric/apollo-upload-server/issues/45), [#77](https://github.com/jaydenseric/apollo-upload-server/issues/77) and [#83](https://github.com/jaydenseric/apollo-upload-server/issues/83) via [#81](https://github.com/jaydenseric/apollo-upload-server/pull/81):
  - Add `error` event listeners to file streams to prevent server crashes on aborted requests or parser errors.
  - Use [`fs-capacitor`](https://npm.im/fs-capacitor) to ensure the server doesn’t hang if an upload `await` is out of order, or is never consumed.

### Minor

- Refactored package scripts to use `prepare` to support installation via Git (e.g. `npm install jaydenseric/apollo-upload-server`).

### Patch

- Updated dependencies.
- Use single instead of double typographic quotes in error messages.
- Use `babel.config.js` instead of `.babelrc.js`.
- Enabled `shippedProposals` in [`@babel/preset-env`](https://npm.im/@babel/preset-env) config.
- Improved testing:
  - Use [`tap`](https://npm.im/tap) instead of [`ava`](https://npm.im/ava). Tests no longer transpile on the fly, are faster and AVA no longer dictates the Babel version.
  - Tests run against the actual dist `.mjs` and `.js` files in native ESM (`--experimental-modules`) and CJS environments.
  - Removed `get-port` dev dependency.
  - Added Express tests.
  - Test middleware error response status codes.
  - Test behavior of aborted HTTP requests.
  - Test that the app can respond if an upload is not handled.
  - Test files to upload are created in context, rather than using arbitrary project files, via [#89](https://github.com/jaydenseric/apollo-upload-server/pull/89).
- Improved `package.json` scripts:
  - Leveraged `npm-run-all` more for parallelism and reduced noise.
  - Removed the clean script `rimraf` dev dependency in favour of native `rm -rf`. Leaner and faster; we only support \*nix now for contributing anyway.
  - No longer use `cross-env`; contributors with Windows may setup and use a Bash shell.
  - Renamed the `ESM` environment variable to `BABEL_ESM` to be more specific.
  - Removed linting fix scripts.
  - Linting included in the test script; Travis CI will fail PR's with lint errors.
  - Custom watch script.
- Improved ESLint config:
  - Simplified ESLint config with [`eslint-config-env`](https://npm.im/eslint-config-env).
  - Removed redundant [`eslint-plugin-ava`](https://npm.im/eslint-plugin-ava) dev dependency and config.
  - Undo overriding ESLint ignoring dotfiles by default as there are none now.
- Use `.prettierignore` to leave `package.json` formatting to npm.
- Tweaked package `description` and `keywords`.
- Compact package `repository` field.
- Improved documentation.
- Readme badge changes to deal with [shields.io](https://shields.io) unreliability:
  - Use the official Travis build status badge.
  - Use [Badgen](https://badgen.net) for the npm version badge.
  - Removed the licence badge. The licence can be found in `package.json` and rarely changes.
  - Removed the Github issues and stars badges. The readme is most viewed on Github anyway.
- Changelog version entries now have “Major”, “Minor” and “Patch” subheadings.

## 5.0.0

### Major

- [`graphql`](https://npm.im/graphql) peer dependency range updated to `^0.13.1` for native ESM support via `.mjs`. It’s a breaking change despite being a semver patch.

### Patch

- Updated dependencies.
- More robust npm scripts, with the ability to watch builds and tests together.
- Fixed missing dev dependency for fetching in tests.
- Use [`eslint-plugin-ava`](https://github.com/avajs/eslint-plugin-ava).
- HTTPS `package.json` author URL.
- New readme logo URL that doesn’t need to be updated every version.

## 4.0.2

### Patch

- Temporary solution for importing CommonJS in `.mjs`, fixing reopened [#40](https://github.com/jaydenseric/apollo-upload-server/issues/40).

## 4.0.1

### Patch

- Correct imports for vanilla Node.js `--experimental-modules` and `.mjs` support, fixing [#40](https://github.com/jaydenseric/apollo-upload-server/issues/40).

## 4.0.0

### Patch

- Updated dependencies.
- Simplified npm scripts.
- Readme updates:
  - Documented [`Blob`](https://developer.mozilla.org/en/docs/Web/API/Blob) types, via [#39](https://github.com/jaydenseric/apollo-upload-server/pull/39).
  - Explained how to use `processRequest` for custom middleware.
  - Improved usage instructions.
  - Display oldest supported Node.js version.
  - Misc. tweaks including a simpler heading structure.

## 4.0.0-alpha.3

### Minor

- Updated peer dependencies to support `graphql@0.12`, via [#36](https://github.com/jaydenseric/apollo-upload-server/pull/36).

### Patch

- Updated dependencies.

## 4.0.0-alpha.2

### Minor

- Transpile and polyfill for Node.js v6.10+ (down from v7.6+) to [support AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html), fixing [#33](https://github.com/jaydenseric/apollo-upload-server/issues/33).
- Modular project structure that works better for native ESM.
- Added tests.
- Set up Travis to test using the latest stable Node.js version and the oldest supported in `package.json` `engines` (v6.10).
- Added a Travis readme badge.
- Improved error handling, fixing [#26](https://github.com/jaydenseric/apollo-upload-server/issues/26):
  - Custom errors are thrown or emitted with meaningful messages that are exported so consumers can use `instanceof` with them.
  - Where it makes sense, errors cause relevant HTTP status codes to be set in middleware.
  - [Misordered multipart fields](https://github.com/jaydenseric/graphql-multipart-request-spec) cause `processRequest` to throw `MapBeforeOperationsUploadError` and `FilesBeforeMapUploadError` errors in middleware.
  - The `map` field provided by the client is used to naively check the `maxFiles` option is not exceeded for a speedy `MaxFilesUploadError` error in middleware. The real number of files parsed is checked too, incase the request is malformed.
  - If files are missing from the request the `scalar Upload` promises reject with a `FileMissingUploadError` error.
  - Already if a file exceeds the `maxFileSize` option the file is truncated, the stream emits a `limit` event and `stream.truncated === true`. Now an `error` event is also emitted with a `MaxFileSizeUploadError`.
  - Aborting requests from the client causes `scalar Upload` promises to reject with a `UploadPromiseDisconnectUploadError` error for file upload streams that have not yet been parsed. For streams being parsed an `error` event is emitted with an `FileStreamDisconnectUploadError` error and `stream.truncated === true`. It is up to consumers to cleanup aborted streams in their resolvers.

### Patch

- Updated dependencies.
- Smarter Babel config with `.babelrc.js`.
- Refactor to use fewer Busboy event listeners.

## 4.0.0-alpha.1

### Major

- New API to support the [GraphQL multipart request spec v2.0.0-alpha.2](https://github.com/jaydenseric/graphql-multipart-request-spec/releases/tag/v2.0.0-alpha.2). Files no longer upload to the filesystem; [readable streams](https://nodejs.org/api/stream.html#stream_readable_streams) are used in resolvers instead. Fixes [#13](https://github.com/jaydenseric/apollo-upload-server/issues/13) via [#22](https://github.com/jaydenseric/apollo-upload-server/pull/22).
- Export a new `Upload` scalar type to use in place of the old `Upload` input type. It represents a file upload promise that resolves an object containing `stream`, `filename`, `mimetype` and `encoding`.
- Deprecated the `uploadDir` middleware option.
- `graphql` is now a peer dependency.

### Minor

- Added new `maxFieldSize`, `maxFileSize` and `maxFiles` middleware options.

### Patch

- Middleware are now arrow functions.

## 3.0.0

### Major

- Updated Node.js support from v6.4+ to v7.6+.
- Express middleware now passes on errors instead of blocking, via [#20](https://github.com/jaydenseric/apollo-upload-server/pull/20).

### Patch

- Using Babel directly, dropping Rollup.
- New directory structure for compiled files.
- Module files now have `.mjs` extension.
- No longer publish the `src` directory.
- No more sourcemaps.
- Use an arrow function for the Koa middleware, to match the Express middleware.
- Compiled code is now prettier.
- Prettier markdown files.
- Updated package keywords.
- Updated an Apollo documentation link in the changelog.
- Readme improvements:
  - Added links to badges.
  - Removed the inspiration links; they are less relevant to the evolved codebase.
  - Fixed an Apollo link.
  - Replaced example resolver code with a link to the [Apollo upload examples](https://github.com/jaydenseric/apollo-upload-examples).

## 2.0.4

### Patch

- Updated dependencies.
- Readme tweaks including a new license badge.

## 2.0.3

### Patch

- Updated dependencies.
- Removed `package-lock.json`. Lockfiles are [not recommended](https://github.com/sindresorhus/ama/issues/479#issuecomment-310661514) for packages.
- Moved Babel config out of `package.json` to prevent issues when consumers run Babel over `node_modules`.
- Readme tweaks and fixes:
  - Renamed the `File` input type `Upload` for clarity.
  - Wording and formatting improvements.
  - Covered React Native.
  - Documented custom middleware.

## 2.0.2

### Patch

- Updated dependencies.
- Added a changelog.
- Dropped Yarn in favor of npm@5. Removed `yarn.lock` and updated install instructions.
- Set targeted Node version as a string for `babel-preset-env`.
- New ESLint config. Dropped [Standard Style](https://standardjs.com) and began using [Prettier](https://github.com/prettier/eslint-plugin-prettier).
- Using [lint-staged](https://github.com/okonet/lint-staged) to ensure contributors don't commit lint errors.
- Removed `build:watch` script. Use `npm run build -- --watch` directly.

## 2.0.1

### Patch

- Updated dependencies.
- Support regular requests from clients other than apollo-upload-client again, fixing [#4](https://github.com/jaydenseric/apollo-upload-server/issues/4).
- Removed incorrect commas from example GraphQL input type.

## 2.0.0

### Major

- Support `apollo-upload-client` v3 and [query batching](https://apollographql.com/docs/apollo-server/requests#batching).

### Patch

- Clearer package description.
- Use [Standard Style](https://standardjs.com) instead of ESLint directly.

## 1.1.0

### Minor

- Exporting a new helper function for processing requests. It can be used to create custom middleware, or middleware for unsupported routers.
- Exporting new Koa middleware.
- Upload directory is ensured on every request now. While slightly less efficient, it prevents major errors when if it is deleted while the server is running.

### Patch

- Updated dependencies.
- Documented npm install as well as Yarn.
- Typo fix in the readme.

## 1.0.2

### Patch

- Fixed broken Github deep links in the readme.
- Readme rewording.
- Simplified `package.json` description.

## 1.0.1

### Patch

- Added missing metadata to `package.json`.
- Added a link to apollographql/graphql-server in the readme.

## 1.0.0

Initial release.
