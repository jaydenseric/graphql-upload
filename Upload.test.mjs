// @ts-check

import { ok, rejects, strictEqual } from "node:assert";

import Upload from "./Upload.mjs";

/**
 * Adds `Upload` tests.
 * @param {import("test-director").default} tests Test director.
 */
export default (tests) => {
  tests.add("`Upload` class resolving a file.", async () => {
    const upload = new Upload();

    ok(upload.promise instanceof Promise);
    strictEqual(typeof upload.resolve, "function");

    /** @type {any} */
    const file = {};

    upload.resolve(file);

    const resolved = await upload.promise;

    strictEqual(resolved, file);
    strictEqual(upload.file, file);
  });

  tests.add("`Upload` class with a handled rejection.", async () => {
    const upload = new Upload();

    ok(upload.promise instanceof Promise);
    strictEqual(typeof upload.reject, "function");

    const error = new Error("Message.");

    upload.reject(error);

    // This is the safe way to check the promise status, see:
    // https://github.com/nodejs/node/issues/31392#issuecomment-575451230
    await rejects(Promise.race([upload.promise, Promise.resolve()]), error);
  });

  tests.add("`Upload` class with an unhandled rejection.", async () => {
    const upload = new Upload();

    ok(upload.promise instanceof Promise);
    strictEqual(typeof upload.reject, "function");

    const error = new Error("Message.");

    upload.reject(error);

    // Node.js CLI flag `--unhandled-rejections=throw` must be used when these
    // tests are run with Node.js v14 (it’s unnecessary for Node.js v15+) or the
    // process won’t exit with an error if the unhandled rejection is’t silenced
    // as intended.
  });
};
