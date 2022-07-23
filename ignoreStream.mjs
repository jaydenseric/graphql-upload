// @ts-check

/**
 * Safely ignores a Node.js readable stream.
 * @param {import("stream").Readable} stream Node.js readable stream.
 */
export default function ignoreStream(stream) {
  // Prevent an unhandled error from crashing the process.
  stream.on("error", () => {});

  // Waste the stream.
  stream.resume();
}
