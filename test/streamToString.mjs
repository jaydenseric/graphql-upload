// @ts-check

/**
 * Converts a Node.js readable stream to a string.
 * @param {import("node:stream").Readable} stream Node.js readable stream.
 * @returns {Promise<string>} Resolves the final string.
 */
export default function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let data = "";
    stream
      .on("error", reject)
      .on("data", (chunk) => {
        data += chunk;
      })
      .on("end", () => resolve(data));
  });
}
