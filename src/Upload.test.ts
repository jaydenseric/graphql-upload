import { Upload } from "./Upload";
import { describe, expect, it } from 'vitest';

describe("Upload", () => {
  it("`Upload` class resolving a file.", async () => {
    const upload = new Upload();

    expect(upload.promise).toBeInstanceOf(Promise);

    expect(upload.resolve).toBeTypeOf('function');

    const file: any = {};

    upload.resolve?.(file);

    const resolved = await upload.promise;

    expect(resolved).toStrictEqual(file);
    expect(upload.file).toStrictEqual(file);
  });
  it("`Upload` class with a handled rejection.", () => {
    const upload = new Upload();

    expect(upload.promise).toBeInstanceOf(Promise);
    expect(upload.reject).toBeTypeOf('function');

    const error = new Error("Message.");

    upload.reject?.(error);

    // This is the safe way to check the promise status, see:
    // https://github.com/nodejs/node/issues/31392#issuecomment-575451230
    // await rejects(Promise.race([upload.promise, Promise.resolve()]), error);
    expect(upload.promise).rejects.toBe(error);
  });
  it("`Upload` class with an unhandled rejection.", () => {
     const upload = new Upload();

    expect(upload.promise).toBeInstanceOf(Promise);
    expect(upload.reject).toBeTypeOf("function");

    const error = new Error("Message.");

    upload.reject?.(error);

    // Node.js CLI flag `--unhandled-rejections=throw` must be used when these
    // tests are run with Node.js v14 (it’s unnecessary for Node.js v15+) or the
    // process won’t exit with an error if the unhandled rejection is’t silenced
    // as intended.
  });
});