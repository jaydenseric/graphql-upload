import { doesNotThrow, strictEqual } from "assert";

import ignoreStream from "../../private/ignoreStream.js";
import CountReadableStream from "../CountReadableStream.mjs";

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
