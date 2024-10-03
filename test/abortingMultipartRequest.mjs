// @ts-check

import { FormDataEncoder } from "form-data-encoder";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Sends a multipart request that deliberately aborts after a certain amount of
 * data has been uploaded to the server, for testing purposes.
 * @param {URL} url The request URL.
 * @param {FormData} formData A `FormData` instance for the request body.
 * @param {string} abortMarker A unique character in the request body that marks
 *   where to abort the request.
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
  const abortController = new AbortController();
  const encoder = new FormDataEncoder(formData);

  try {
    await fetch(url, {
      method: "POST",
      headers: encoder.headers,
      body: new ReadableStream({
        async start(controller) {
          for await (const chunk of encoder) {
            const chunkString = textDecoder.decode(chunk);
            const chunkAbortIndex = chunkString.indexOf(abortMarker);

            // Check if the chunk has the abort marker character in it.
            if (chunkAbortIndex !== -1) {
              if (chunkAbortIndex !== 0)
                // Yield the final truncated chunk before aborting.
                controller.enqueue(
                  textEncoder.encode(chunkString.substring(0, chunkAbortIndex)),
                );

              // Abort the request after it has been received by the server
              // request handler, or else Node.js won’t run the handler.
              await requestReceived;

              abortController.abort();

              // Don’t iterate chunks after the abort marker.
              break;
            } else controller.enqueue(chunk);
          }

          controller.close();
        },
      }),
      // @ts-expect-error https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1483
      duplex: "half",
      signal: abortController.signal,
    });
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) throw error;
  }
}
