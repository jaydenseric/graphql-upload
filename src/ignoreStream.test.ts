import { ignoreStream } from "./ignoreStream";
import { CountReadableStream } from "./test/CountReadableStream";
import { describe, expect, it } from 'vitest';

describe("GraphQLUpload", () => {
  it("`ignoreStream` ignores errors.", () => {
    expect(() => {
      const stream = new CountReadableStream({});
      ignoreStream(stream);
      stream.emit("error", new Error("Message."));
    }).not.toThrow();
  });
 it("`ignoreStream` resumes a paused stream.", () => {
   const stream = new CountReadableStream({});
   stream.pause();
   ignoreStream(stream);
   expect(stream.isPaused()).toBe(false);
 });
});
