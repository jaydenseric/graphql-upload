// @ts-check

"use strict";

/**
 * Safely ignores a Node.js readable stream.
 * @param {import("stream").Readable} stream Node.js readable stream.
 */
function ignoreStream(stream) {
  // Prevent an unhandled error from crashing the process.
  stream.on("error", () => {});

  // Waste the stream.
  stream.resume();
}

module.exports = ignoreStream;
