// @ts-check

/** @import { Readable } from "node:stream" */

/**
 * Safely ignores a Node.js readable stream.
 * @param {Readable} stream Node.js readable stream.
 */
export default function ignoreStream(stream) {
  // Prevent an unhandled error from crashing the process.
  stream.on("error", () => {});

  // Waste the stream.
  stream.resume();
}
