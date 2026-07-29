// @ts-check

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";

import isAbortError from "./isAbortError.mjs";

suite(
  "Function `isAbortError`.",
  {
    concurrency: true,
  },
  () => {
    test("Non error.", () => {
      strictEqual(isAbortError(true), false);
    });

    test("Non abort error.", () => {
      strictEqual(isAbortError(new Error()), false);
    });

    test("Abort error.", () => {
      strictEqual(isAbortError(AbortSignal.abort().reason), true);
    });
  },
);
