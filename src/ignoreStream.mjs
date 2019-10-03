/**
 * Safely ignores a readable stream.
 * @kind function
 * @name ignoreStream
 * @param {ReadableStream} stream Readable stream.
 * @ignore
 */
export const ignoreStream = stream => {
  // Prevent an unhandled error from crashing the process.
  stream.on('error', () => {})

  // Waste the stream.
  stream.resume()
}
