import { Stream } from "stream";

/**
 * Safely ignores a Node.js readable stream.
 */
export function ignoreStream(stream: Stream) {
  // Prevent an unhandled error from crashing the process.
  stream.on("error", () => {});
}
