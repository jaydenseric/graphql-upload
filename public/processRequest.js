"use strict";

const Busboy = require("busboy");
const { WriteStream } = require("fs-capacitor");
const createError = require("http-errors");
const objectPath = require("object-path");
const GRAPHQL_MULTIPART_REQUEST_SPEC_URL = require("../private/GRAPHQL_MULTIPART_REQUEST_SPEC_URL");
const ignoreStream = require("../private/ignoreStream");
const Upload = require("./Upload");

/**
 * Processes a
 * [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * It parses the `operations` and `map` fields to create an
 * [`Upload`]{@link Upload} instance for each expected file upload, placing
 * references wherever the file is expected in the
 * [GraphQL operation]{@link GraphQLOperation} for the
 * [`Upload`]{@link GraphQLUpload} scalar to derive it’s value. Errors are
 * created with [`http-errors`](https://npm.im/http-errors) to assist in sending
 * responses with appropriate HTTP status codes. Used in
 * [`graphqlUploadExpress`]{@link graphqlUploadExpress} and
 * [`graphqlUploadKoa`]{@link graphqlUploadKoa} and can be used to create custom
 * middleware.
 * @kind function
 * @name processRequest
 * @type {ProcessRequestFunction}
 * @example <caption>Ways to `import`.</caption>
 * ```js
 * import { processRequest } from "graphql-upload";
 * ```
 *
 * ```js
 * import processRequest from "graphql-upload/public/processRequest.js";
 * ```
 * @example <caption>Ways to `require`.</caption>
 * ```js
 * const { processRequest } = require("graphql-upload");
 * ```
 *
 * ```js
 * const processRequest = require("graphql-upload/public/processRequest.js");
 * ```
 */
module.exports = function processRequest(
  request,
  response,
  {
    maxFieldSize = 1000000, // 1 MB
    maxFileSize = Infinity,
    maxFiles = Infinity,
  } = {}
) {
  return new Promise((resolve, reject) => {
    let released;
    let exitError;
    let lastFileStream;
    let operations;
    let operationsPath;
    let map;

    const parser = new Busboy({
      headers: request.headers,
      limits: {
        fieldSize: maxFieldSize,
        fields: 2, // Only operations and map.
        fileSize: maxFileSize,
        files: maxFiles,
      },
    });

    /**
     * Exits request processing with an error. Successive calls have no effect.
     * @kind function
     * @name processRequest~exit
     * @param {object} error Error instance.
     * @ignore
     */
    const exit = (error) => {
      // None of the tested scenarios cause multiple calls of this function, but
      // it’t still good to guard against it happening in case it’s possible now
      // or in the future.
      // coverage ignore next line
      if (exitError) return;

      exitError = error;

      reject(exitError);

      parser.destroy();

      if (
        lastFileStream &&
        !lastFileStream.readableEnded &&
        !lastFileStream.destroyed
      )
        lastFileStream.destroy(exitError);

      if (map)
        for (const upload of map.values())
          if (!upload.file) upload.reject(exitError);

      request.unpipe(parser);

      // With a sufficiently large request body, subsequent events in the same
      // event frame cause the stream to pause after the parser is destroyed. To
      // ensure that the request resumes, the call to .resume() is scheduled for
      // later in the event loop.
      setImmediate(() => {
        request.resume();
      });
    };

    parser.on(
      "field",
      (fieldName, value, fieldNameTruncated, valueTruncated) => {
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

            resolve(operations);
          }
        }
      }
    );

    parser.on("file", (fieldName, stream, filename, encoding, mimetype) => {
      lastFileStream = stream;

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

      const file = {
        filename,
        mimetype,
        encoding,
        createReadStream(options) {
          const error = fileError || (released ? exitError : null);
          if (error) throw error;
          return capacitor.createReadStream(options);
        },
      };

      Object.defineProperty(file, "capacitor", { value: capacitor });

      stream.pipe(capacitor);
      upload.resolve(file);
    });

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

      for (const upload of map.values())
        if (!upload.file)
          upload.reject(createError(400, "File missing in the request."));
    });

    parser.once("error", exit);

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
};
