// @ts-check

import { doesNotThrow, strictEqual } from "node:assert";

import ignoreStream from "./ignoreStream.mjs";
import CountReadableStream from "./test/CountReadableStream.mjs";

/**
 * Adds `ignoreStream` tests.
 * @param {import("test-director").default} tests Test director.
 */
export default (tests) => {
  tests.add("`ignoreStream` ignores errors.", () => {
    doesNotThrow(() => {
      const stream = new CountReadableStream();
      ignoreStream(stream);
      stream.emit("error", new Error("Message."));
    });
  });

  tests.add("`ignoreStream` resumes a paused stream.", () => {
    const stream = new CountReadableStream();
    stream.pause();
    ignoreStream(stream);
    strictEqual(stream.isPaused(), false);
  });
};
