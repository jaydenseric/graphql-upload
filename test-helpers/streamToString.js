/**
 * Converts a readable stream to a string.
 * @kind function
 * @name streamToString
 * @param {ReadableStream} stream Readable stream.
 * @returns {Promise<string>} A string promise.
 * @ignore
 */
module.exports = function streamToString(stream) {
  return new Promise((resolve, reject) => {
    let data = ''
    stream
      .on('error', reject)
      .on('data', chunk => {
        data += chunk
      })
      .on('end', () => resolve(data))
  })
}
