import { ok, rejects, strictEqual } from "assert";
import Upload from "../../public/Upload.js";

export default (tests) => {
  tests.add("`Upload` class resolving a file.", async () => {
    const upload = new Upload();

    ok(upload.promise instanceof Promise);
    strictEqual(typeof upload.resolve, "function");

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

    // Rely on the fact that `-r hard-rejection/register` is used when these
    // tests are run via the Node.js CLI. The process won’t exit with an error
    // if the unhandled rejection is silenced as intended.
  });
};
