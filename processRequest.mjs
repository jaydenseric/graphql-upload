// @ts-check

import busboy from "busboy";
import { WriteStream } from "fs-capacitor";
import createError from "http-errors";
import objectPath from "object-path";

import GRAPHQL_MULTIPART_REQUEST_SPEC_URL from "./GRAPHQL_MULTIPART_REQUEST_SPEC_URL.mjs";
import ignoreStream from "./ignoreStream.mjs";
import Upload from "./Upload.mjs";

/** @typedef {import("./GraphQLUpload.mjs").default} GraphQLUpload */

/**
 * Processes an incoming
 * [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * It parses the `operations` and `map` fields to create an {@linkcode Upload}
 * instance for each expected file upload, placing references wherever the file
 * is expected in the GraphQL operation for the {@linkcode GraphQLUpload} scalar
 * to derive it’s value. Errors are created with
 * [`http-errors`](https://npm.im/http-errors) to assist in sending responses
 * with appropriate HTTP status codes. Used to create custom middleware.
 * @type {ProcessRequestFunction}
 */
export default function processRequest(
  request,
  response,
  {
    maxFieldSize = 1000000, // 1 MB
    maxFileSize = Infinity,
    maxFiles = Infinity,
    disabledFileMimeTypes =  /** @type {string[]} */[],
  } = {}
) {
  return new Promise((resolve, reject) => {
    /** @type {boolean} */
    let released;

    /** @type {Error} */
    let exitError;

    /**
     * @type {{ [key: string]: unknown } | Array<
     *   { [key: string]: unknown }
     * >}
     */
    let operations;

    /**
     * @type {import("object-path").ObjectPathBound<
     *   { [key: string]: unknown } | Array<{ [key: string]: unknown }>
     * >}
     */
    let operationsPath;

    /** @type {Map<string, Upload>} */
    let map;

    const parser = busboy({
      headers: request.headers,
      defParamCharset: "utf8",
      limits: {
        fieldSize: maxFieldSize,
        fields: 2, // Only operations and map.
        fileSize: maxFileSize,
        files: maxFiles,
      },
    });

    /**
     * Exits request processing with an error. Successive calls have no effect.
     * @param {Error} error Error instance.
     * @param {boolean} [isParserError] Is the error from the parser.
     */
    function exit(error, isParserError = false) {
      if (exitError) return;

      exitError = error;

      if (map)
        for (const upload of map.values())
          if (!upload.file) upload.reject(exitError);

      // If the error came from the parser, don’t cause it to be emitted again.
      isParserError ? parser.destroy() : parser.destroy(exitError);

      request.unpipe(parser);

      // With a sufficiently large request body, subsequent events in the same
      // event frame cause the stream to pause after the parser is destroyed. To
      // ensure that the request resumes, the call to .resume() is scheduled for
      // later in the event loop.
      setImmediate(() => {
        request.resume();
      });

      reject(exitError);
    }

    parser.on("field", (fieldName, value, { valueTruncated, mimeType }) => {
      if (valueTruncated)
        return exit(
          createError(
            413,
            `The ‘${fieldName}’ multipart field value exceeds the ${maxFieldSize} byte size limit.`
          )
        );

      switch (fieldName) {
        case "operations":
          try {
            operations = JSON.parse(value);
          } catch (error) {
            return exit(
              createError(
                400,
                `Invalid JSON in the ‘operations’ multipart field (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
              )
            );
          }

          // `operations` should be an object or an array. Note that arrays
          // and `null` have an `object` type.
          if (typeof operations !== "object" || !operations)
            return exit(
              createError(
                400,
                `Invalid type for the ‘operations’ multipart field (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
              )
            );

          operationsPath = objectPath(operations);

          break;
        case "map": {
          if (!operations)
            return exit(
              createError(
                400,
                `Misordered multipart fields; ‘map’ should follow ‘operations’ (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
              )
            );

          let parsedMap;
          try {
            parsedMap = JSON.parse(value);
          } catch (error) {
            return exit(
              createError(
                400,
                `Invalid JSON in the ‘map’ multipart field (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
              )
            );
          }

          // `map` should be an object.
          if (
            typeof parsedMap !== "object" ||
            !parsedMap ||
            Array.isArray(parsedMap)
          )
            return exit(
              createError(
                400,
                `Invalid type for the ‘map’ multipart field (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
              )
            );

          const mapEntries = Object.entries(parsedMap);

          // Check max files is not exceeded, even though the number of files
          // to parse might not match the map provided by the client.
          if (mapEntries.length > maxFiles)
            return exit(
              createError(413, `${maxFiles} max file uploads exceeded.`)
            );

          map = new Map();
          for (const [fieldName, paths] of mapEntries) {
            if (!Array.isArray(paths))
              return exit(
                createError(
                  400,
                  `Invalid type for the ‘map’ multipart field entry key ‘${fieldName}’ array (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
                )
              );

            map.set(fieldName, new Upload());

            for (const [index, path] of paths.entries()) {
              if (typeof path !== "string")
                return exit(
                  createError(
                    400,
                    `Invalid type for the ‘map’ multipart field entry key ‘${fieldName}’ array index ‘${index}’ value (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
                  )
                );

              try {
                operationsPath.set(path, map.get(fieldName));
              } catch (error) {
                return exit(
                  createError(
                    400,
                    `Invalid object path for the ‘map’ multipart field entry key ‘${fieldName}’ array index ‘${index}’ value ‘${path}’ (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
                  )
                );
              }
            }
          }

          if (disabledFileMimeTypes.length === 0) {
            resolve(operations);
          }
        }
      }
    });

    parser.on(
      "file",
      (fieldName, stream, { filename, encoding, mimeType: mimetype }) => {
        if (disabledFileMimeTypes.includes(mimetype) === true) {
          ignoreStream(stream);

          return exit(createError(400, `mimetype ${mimetype} is not allowed.`));
        }

        if (!map) {
          ignoreStream(stream);
          return exit(
            createError(
              400,
              `Misordered multipart fields; files should follow ‘map’ (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
            )
          );
        }

        const upload = map.get(fieldName);

        if (!upload) {
          // The file is extraneous. As the rest can still be processed, just
          // ignore it and don’t exit with an error.
          ignoreStream(stream);
          return;
        }

        /** @type {Error} */
        let fileError;

        const capacitor = new WriteStream();

        capacitor.on("error", () => {
          stream.unpipe();
          stream.resume();
        });

        stream.on("limit", () => {
          fileError = createError(
            413,
            `File truncated as it exceeds the ${maxFileSize} byte size limit.`
          );
          stream.unpipe();
          capacitor.destroy(fileError);
        });

        stream.on("error", (error) => {
          fileError = error;
          stream.unpipe();
          capacitor.destroy(fileError);
        });

        /** @type {FileUpload} */
        const file = {
          filename,
          mimetype,
          encoding,
          createReadStream(options) {
            const error = fileError || (released ? exitError : null);
            if (error) throw error;
            return capacitor.createReadStream(options);
          },
          capacitor,
        };

        Object.defineProperty(file, "capacitor", {
          enumerable: false,
          configurable: false,
          writable: false,
        });

        stream.pipe(capacitor);
        upload.resolve(file);
      }
    );

    parser.once("filesLimit", () =>
      exit(createError(413, `${maxFiles} max file uploads exceeded.`))
    );

    parser.once("finish", () => {
      request.unpipe(parser);
      request.resume();

      if (!operations)
        return exit(
          createError(
            400,
            `Missing multipart field ‘operations’ (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
          )
        );

      if (!map)
        return exit(
          createError(
            400,
            `Missing multipart field ‘map’ (${GRAPHQL_MULTIPART_REQUEST_SPEC_URL}).`
          )
        );

      for (const upload of map.values()) {
        if (!upload.file) {
          upload.reject(createError(400, "File missing in the request."));
        }
      }

      if (disabledFileMimeTypes.length !== 0) {
        resolve(operations);
      }
    });

    // Use the `on` method instead of `once` as in edge cases the same parser
    // could have multiple `error` events and all must be handled to prevent the
    // Node.js process exiting with an error. One edge case is if there is a
    // malformed part header as well as an unexpected end of the form.
    parser.on("error", (/** @type {Error} */ error) => {
      exit(error, true);
    });

    response.once("close", () => {
      released = true;

      if (map)
        for (const upload of map.values())
          if (upload.file)
            // Release resources and clean up temporary files.
            upload.file.capacitor.release();
    });

    request.once("close", () => {
      if (!request.readableEnded)
        exit(
          createError(
            499,
            "Request disconnected during file upload stream parsing."
          )
        );
    });

    request.pipe(parser);
  });
}

/**
 * File upload details that are only available after the file’s field in the
 * [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * has begun streaming in.
 * @typedef {object} FileUpload
 * @prop {string} filename File name.
 * @prop {string} mimetype File MIME type. Provided by the client and can’t be
 *   trusted.
 * @prop {string} encoding File stream transfer encoding.
 * @prop {import("fs-capacitor").WriteStream} capacitor A private implementation
 *   detail that shouldn’t be used outside
 *   [`graphql-upload`](https://npm.im/graphql-upload).
 * @prop {FileUploadCreateReadStream} createReadStream Creates a
 *   [Node.js readable stream](https://nodejs.org/api/stream.html#readable-streams)
 *   of the file’s contents, for processing and storage.
 */

/**
 * Creates a
 * [Node.js readable stream](https://nodejs.org/api/stream.html#readable-streams)
 * of an {@link FileUpload uploading file’s} contents, for processing and
 * storage. Multiple calls create independent streams. Throws if called after
 * all resolvers have resolved, or after an error has interrupted the request.
 * @callback FileUploadCreateReadStream
 * @param {FileUploadCreateReadStreamOptions} [options] Options.
 * @returns {import("node:stream").Readable}
 *   [Node.js readable stream](https://nodejs.org/api/stream.html#readable-streams)
 *   of the file’s contents.
 * @see [Node.js `Readable` stream constructor docs](https://nodejs.org/api/stream.html#new-streamreadableoptions).
 * @see [Node.js stream backpressure guide](https://nodejs.org/en/docs/guides/backpressuring-in-streams).
 */

/**
 * {@linkcode FileUploadCreateReadStream} options.
 * @typedef {object} FileUploadCreateReadStreamOptions
 * @prop {import("fs-capacitor")
 *   .ReadStreamOptions["encoding"]} [options.encoding] Specify an encoding for
 *   the [`data`](https://nodejs.org/api/stream.html#event-data) chunks to be
 *   strings (without splitting multi-byte characters across chunks) instead of
 *   Node.js [`Buffer`](https://nodejs.org/api/buffer.html#buffer) instances.
 *   Supported values depend on the
 *   [`Buffer` implementation](https://github.com/nodejs/node/blob/v18.1.0/lib/buffer.js#L590-L680)
 *   and include `utf8`, `ucs2`, `utf16le`, `latin1`, `ascii`, `base64`,
 *   `base64url`, or `hex`. Defaults to `utf8`.
 * @prop {import("fs-capacitor")
 *   .ReadStreamOptions["highWaterMark"]} [options.highWaterMark] Maximum number
 *   of bytes to store in the internal buffer before ceasing to read from the
 *   underlying resource. Defaults to `16384`.
 */

/**
 * Processes an incoming
 * [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * @callback ProcessRequestFunction
 * @param {import("node:http").IncomingMessage} request
 *   [Node.js HTTP server request instance](https://nodejs.org/api/http.html#http_class_http_incomingmessage).
 * @param {import("node:http").ServerResponse} response
 *   [Node.js HTTP server response instance](https://nodejs.org/api/http.html#http_class_http_serverresponse).
 * @param {ProcessRequestOptions} [options] Options.
 * @returns {Promise<
 *   { [key: string]: unknown } | Array<{ [key: string]: unknown }>
 * >} GraphQL operation or batch of operations for a GraphQL server to consume
 *   (usually as the request body). A GraphQL operation typically has the
 *   properties `query` and `variables`.
 */

/**
 * {@linkcode ProcessRequestFunction} options.
 * @typedef {object} ProcessRequestOptions
 * @prop {number} [maxFieldSize] Maximum allowed non file multipart form field
 *   size in bytes; enough for your queries. Defaults to `1000000` (1 MB).
 * @prop {number} [maxFileSize] Maximum allowed file size in bytes. Defaults to
 *   `Infinity`.
 * @prop {number} [maxFiles] Maximum allowed number of files. Defaults to
 *   `Infinity`.
 * @prop {string[]} [disabledFileMimeTypes] Disabled mime file types. Defaults to
 *  `[]`.
 */
