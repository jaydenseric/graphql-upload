# apollo-upload-server change log

## 2.0.4

- Updated dependencies.
- Readme tweaks including a new licence badge.

## 2.0.3

- Updated dependencies.
- Removed `package-lock.json`. Lockfiles are [not recommended](https://github.com/sindresorhus/ama/issues/479#issuecomment-310661514) for packages.
- Moved Babel config out of `package.json` to prevent issues when consumers run Babel over `node_modules`.
- Readme tweaks and fixes:
  - Renamed the `File` input type `Upload` for clarity.
  - Wording and formatting improvements.
  - Covered React Native.
  - Documented custom middleware.

## 2.0.2

- Updated dependencies.
- Added a change log.
- Dropped Yarn in favor of npm@5. Removed `yarn.lock` and updated install instructions.
- Set targeted Node version as a string for `babel-preset-env`.
- New ESLint config. Dropped [Standard Style](https://standardjs.com) and began using [Prettier](https://github.com/prettier/eslint-plugin-prettier).
- Using [lint-staged](https://github.com/okonet/lint-staged) to ensure contributors don't commit lint errors.
- Removed `build:watch` script. Use `npm run build -- --watch` directly.

## 2.0.1

- Updated dependencies.
- Support regular requests from clients other than apollo-upload-client again, fixing [#4](https://github.com/jaydenseric/apollo-upload-server/issues/4).
- Removed incorrect commas from example GraphQL input type.

## 2.0.0

- Support `apollo-upload-client` v3 and [query batching](http://dev.apollodata.com/core/network.html#query-batching).
- Clearer package description.

## 1.1.0

- Updated dependencies.
- Exporting a new helper function for processing requests. It can be used to create custom middleware, or middleware for unsupported routers.
- Exporting new Koa middleware.
- Upload directory is ensured on every request now. While slightly less efficient, it prevents major errors when if it is deleted while the server is running.
- Documented npm install as well as Yarn.
- Typo fix in the readme.

## 1.0.2

- Fixed broken Github deep links in the readme.
- Readme rewording.
- Simplified `package.json` description.

## 1.0.1

- Added missing metadata to `package.json`.
- Added a link to apollographql/graphql-server in the readme.

## 1.0.0

- Initial release.
