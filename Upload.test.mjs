// @ts-check

/** @import { FileUpload } from "./processRequest.mjs" */

import { ok, rejects, strictEqual } from "node:assert";
import { describe, it } from "node:test";

import Upload from "./Upload.mjs";

describe(
  "Class `Upload`.",
  {
    concurrency: true,
  },
  () => {
    it("Resolving a file.", async () => {
      const upload = new Upload();

      ok(upload.promise instanceof Promise);
      strictEqual(typeof upload.resolve, "function");

      const file = /** @type {FileUpload} */ ({});

      upload.resolve(file);

      const resolved = await upload.promise;

      strictEqual(resolved, file);
      strictEqual(upload.file, file);
    });

    it("Handled rejection.", async () => {
      const upload = new Upload();

      ok(upload.promise instanceof Promise);
      strictEqual(typeof upload.reject, "function");

      const error = new Error("Message.");

      upload.reject(error);

      // This is the safe way to check the promise status, see:
      // https://github.com/nodejs/node/issues/31392#issuecomment-575451230
      await rejects(Promise.race([upload.promise, Promise.resolve()]), error);
    });

    it("Unhandled rejection.", async () => {
      const upload = new Upload();

      ok(upload.promise instanceof Promise);
      strictEqual(typeof upload.reject, "function");

      const error = new Error("Message.");

      upload.reject(error);

      // Rely on the Node.js v15+ CLI option default
      // `--unhandled-rejections=throw` exiting the process with an error if the
      // unhandled rejection isn’t silenced as intended.
    });
  },
);
