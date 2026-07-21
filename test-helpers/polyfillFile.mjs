// @ts-check

import { File as NodeFile } from "node:buffer";

// Todo: Delete this polyfill once all supported Node.js versions have the
// global `File`:
// https://nodejs.org/api/globals.html#class-file
// @ts-expect-error It’s not a perfect polyfill, but works for the tests.
globalThis.File ??= NodeFile;
