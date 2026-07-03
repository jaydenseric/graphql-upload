// @ts-check

import { doesNotThrow, strictEqual } from "node:assert";
import { Readable } from "node:stream";
import { describe, it } from "node:test";

import ignoreStream from "./ignoreStream.mjs";

describe(
  "Function `ignoreStream`.",
  {
    concurrency: true,
  },
  () => {
    it("Ignores errors.", () => {
      doesNotThrow(() => {
        const stream = new Readable({
          read() {},
        });

        ignoreStream(stream);

        stream.emit("error", new Error("Message."));
      });
    });

    it("Resumes a paused stream.", () => {
      doesNotThrow(() => {
        const stream = new Readable({
          read() {},
        });

        stream.pause();
        ignoreStream(stream);

        strictEqual(stream.isPaused(), false);
      });
    });
  },
);
