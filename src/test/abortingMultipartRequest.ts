import { FormDataEncoder } from "form-data-encoder";
import { Readable } from "stream";
import nodeAbortController from "node-abort-controller";
import fetch, { AbortError } from "node-fetch";

const AbortController =
  globalThis.AbortController || nodeAbortController.AbortController;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Sends a multipart request that deliberately aborts after a certain amount of
 * data has been uploaded to the server, for testing purposes.
 * @param {string} url The request URL.
 * @param {FormData} formData A `FormData` instance for the request body.
 * @param {string} abortMarker A unique character in the request body that marks
 *   where to abort the request.
 * @param {Promise<void>} requestReceived Resolves once the request has been
 *   received by the server request handler.
 * @returns {Promise<void>} Resolves once the request aborts.
 */
export async function abortingMultipartRequest(
  url: string,
  formData: FormData,
  abortMarker: string,
  requestReceived: Promise<void>
): Promise<void> {
  const abortController = new AbortController();
  // @ts-expect-error wtf?
  const encoder = new FormDataEncoder(formData);

  /**
   * An async generator to iterate the encoded chunks of the form data, that
   * only yields chunks up until the abort marker and then aborts.
   */
  async function* abortingFormData() {
    for await (const chunk of encoder) {
      const chunkString = textDecoder.decode(chunk);
      const chunkAbortIndex = chunkString.indexOf(abortMarker);

      // Check if the chunk has the abort marker character in it.
      if (chunkAbortIndex !== -1) {
        if (chunkAbortIndex !== 0)
          // Yield the final truncated chunk before aborting.
          yield textEncoder.encode(chunkString.substring(0, chunkAbortIndex));

        // Abort the request after it has been received by the server request
        // handler, or else Node.js won’t run the handler.
        await requestReceived;

        abortController.abort();

        // Don’t iterate chunks after the abort marker.
        break;
      } else yield chunk;
    }
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: encoder.headers,
      body: Readable.from(abortingFormData()),
      signal: abortController.signal,
    });
  } catch (error) {
    if (!(error instanceof AbortError)) throw error;
  }
}
