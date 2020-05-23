'use strict';

const http = require('http');
const { Transform } = require('stream');

/**
 * Sends a multipart request that deliberately aborts after a certain amount of
 * data has been uploaded to the server, for testing purposes.
 * @kind function
 * @name abortingMultipartRequest
 * @param {string} url The request URL.
 * @param {FormData} formData A `FormData` instance for the request body.
 * @param { string} abortMarker A unique character in the request body that marks where to abort the request.
 * @param {Promise<void>} requestReceived Resolves once the request has been received by the server request handler.
 * @returns {Promise<void>} Resolves once the aborted request closes.
 * @ignore
 */
module.exports = function abortingMultipartRequest(
  url,
  formData,
  abortMarker,
  requestReceived
) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: 'POST',
      headers: formData.getHeaders(),
    });

    request.on('error', (error) => {
      // Error expected when the connection is aborted.
      if (error.code !== 'ECONNRESET') reject(error);
    });

    request.on('close', resolve);

    const transform = new Transform({
      transform(chunk, encoding, callback) {
        if (this._aborted) return;

        const chunkString = chunk.toString('utf8');
        const chunkAbortIndex = chunkString.indexOf(abortMarker);

        // Check if the chunk has the abort marker character in it.
        if (chunkAbortIndex !== -1) {
          this._aborted = true;

          if (chunkAbortIndex !== 0)
            // Send partial chunk before abort.
            callback(null, chunkString.substr(0, chunkAbortIndex));

          // Abort the request after it has been received by the server request
          // handler, or else Node.js won’t run the handler.
          requestReceived.then(() => request.abort());

          return;
        }

        callback(null, chunk);
      },
    });

    formData.pipe(transform).pipe(request);
  });
};
