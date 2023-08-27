// @ts-check

import { doesNotThrow, strictEqual } from "node:assert";
import { describe, it } from "node:test";

import ignoreStream from "./ignoreStream.mjs";
import CountReadableStream from "./test/CountReadableStream.mjs";

describe(
  "Function `ignoreStream`.",
  {
    concurrency: true,
  },
  () => {
    it("Ignores errors.", () => {
      doesNotThrow(() => {
        const stream = new CountReadableStream();
        ignoreStream(stream);
        stream.emit("error", new Error("Message."));
      });
    });

    it("Resumes a paused stream.", () => {
      doesNotThrow(() => {
        const stream = new CountReadableStream();
        stream.pause();
        ignoreStream(stream);
        strictEqual(stream.isPaused(), false);
      });
    });
  },
);
