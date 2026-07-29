// @ts-check

import { doesNotThrow, strictEqual } from "node:assert";
import { Readable } from "node:stream";
import { suite, test } from "node:test";

import ignoreStream from "./ignoreStream.mjs";

suite(
  "Function `ignoreStream`.",
  {
    concurrency: true,
  },
  () => {
    test("Ignores errors.", () => {
      doesNotThrow(() => {
        const stream = new Readable({
          read() {},
        });

        ignoreStream(stream);

        stream.emit("error", new Error("Message."));
      });
    });

    test("Resumes a paused stream.", () => {
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
