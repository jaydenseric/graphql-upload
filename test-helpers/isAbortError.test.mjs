// @ts-check

import { strictEqual } from "node:assert";
import { describe, it } from "node:test";

import isAbortError from "./isAbortError.mjs";

describe(
  "Function `isAbortError`.",
  {
    concurrency: true,
  },
  () => {
    it("Non error.", () => {
      strictEqual(isAbortError(true), false);
    });

    it("Non abort error.", () => {
      strictEqual(isAbortError(new Error()), false);
    });

    it("Abort error.", () => {
      strictEqual(isAbortError(AbortSignal.abort().reason), true);
    });
  },
);
