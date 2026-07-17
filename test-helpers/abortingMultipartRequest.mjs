// @ts-check

import { Buffer } from "node:buffer";

import isAbortError from "./isAbortError.mjs";

/**
 * Fetches a multipart request that deliberately aborts after a certain amount
 * of data has been uploaded to the server, for testing purposes.
 * @param {URL} url The request URL.
 * @param {FormData} formData Request form data.
 * @param {Uint8Array} abortMarker Byte sequence marking where to abort the
 *   request, before the first occurrence in the request body.
 * @param {Promise<void>} requestReceived Resolves once the request has been
 *   received by the server request handler.
 * @returns {Promise<void>} Resolves once the request aborts.
 */
export default async function abortingMultipartRequest(
  url,
  formData,
  abortMarker,
  requestReceived,
) {
  if (!abortMarker.length)
    throw new TypeError("Abort marker mustn’t be empty.");

  const request = new Request(url, {
    method: "POST",
    body: formData,
  });
  const requestBodyBytes = await request.bytes();
  const abortMarkerIndex = Buffer.prototype.indexOf.call(
    requestBodyBytes,
    abortMarker,
  );

  if (abortMarkerIndex === -1)
    throw new TypeError("Multipart request abort marker missing.");

  const abortController = new AbortController();

  /** @satisfies {RequestInit} */
  const fetchOptions = {
    method: "POST",
    headers: request.headers,
    body: new Blob([requestBodyBytes.subarray(0, abortMarkerIndex)])
      .stream()
      .pipeThrough(
        new TransformStream({
          async flush() {
            // Abort the request after it has been received by the server request
            // handler, or else Node.js won’t run the handler.
            await requestReceived;

            abortController.abort();
          },
        }),
      ),
    // @ts-expect-error https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
    duplex: "half",
    signal: abortController.signal,
  };

  await fetch(url, fetchOptions).catch((error) => {
    if (!isAbortError(error)) throw error;
  });
}
