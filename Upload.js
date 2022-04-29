"use strict";

/**
 * A file expected to be uploaded as it has been declared in the `map` field of
 * a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * The [`processRequest`]{@link processRequest} function places references to an
 * instance of this class wherever the file is expected in the
 * [GraphQL operation]{@link GraphQLOperation}. The
 * [`Upload`]{@link GraphQLUpload} scalar derives it’s value from the
 * [`promise`]{@link Upload#promise} property.
 * @kind class
 * @name Upload
 * @example <caption>How to `import`.</caption>
 * ```js
 * import Upload from "graphql-upload/Upload.js";
 * ```
 * @example <caption>How to `require`.</caption>
 * ```js
 * const Upload = require("graphql-upload/Upload.js");
 * ```
 */
module.exports = class Upload {
  constructor() {
    /**
     * Promise that resolves file upload details. This should only be utilized
     * by [`GraphQLUpload`]{@link GraphQLUpload}.
     * @kind member
     * @name Upload#promise
     * @type {Promise<FileUpload>}
     */
    this.promise = new Promise((resolve, reject) => {
      /**
       * Resolves the upload promise with the file upload details. This should
       * only be utilized by [`processRequest`]{@link processRequest}.
       * @kind function
       * @name Upload#resolve
       * @param {FileUpload} file File upload details.
       */
      this.resolve = (file) => {
        /**
         * The file upload details, available when the
         * [upload promise]{@link Upload#promise} resolves. This should only be
         * utilized by [`processRequest`]{@link processRequest}.
         * @kind member
         * @name Upload#file
         * @type {undefined|FileUpload}
         */
        this.file = file;

        resolve(file);
      };

      /**
       * Rejects the upload promise with an error. This should only be
       * utilized by [`processRequest`]{@link processRequest}.
       * @kind function
       * @name Upload#reject
       * @param {object} error Error instance.
       */
      this.reject = reject;
    });

    // Prevent errors crashing Node.js, see:
    // https://github.com/nodejs/node/issues/20392
    this.promise.catch(() => {});
  }
};

/**
 * File upload details that are only available after the file’s field in the
 * [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * has begun streaming in.
 * @kind typedef
 * @name FileUpload
 * @type {object}
 * @prop {string} filename File name.
 * @prop {string} mimetype File MIME type. Provided by the client and can’t be trusted.
 * @prop {string} encoding File stream transfer encoding.
 * @prop {FileUploadCreateReadStream} createReadStream Creates a [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) of the file’s contents, for processing and storage.
 */

/**
 * Creates a
 * [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams)
 * of an [uploading file’s]{@link FileUpload} contents, for processing and
 * storage. Multiple calls create independent streams. Throws if called after
 * all resolvers have resolved, or after an error has interrupted the request.
 * @kind typedef
 * @name FileUploadCreateReadStream
 * @type {Function}
 * @param {object} [options] [`fs-capacitor`](https://npm.im/fs-capacitor) [`ReadStreamOptions`](https://github.com/mike-marcacci/fs-capacitor#readstreamoptions).
 * @param {string} [options.encoding=null] Specify an encoding for the [`data`](https://nodejs.org/api/stream.html#stream_event_data) chunks to be strings (without splitting multi-byte characters across chunks) instead of Node.js [`Buffer`](https://nodejs.org/api/buffer.html#buffer_buffer) instances. Supported values depend on the [`Buffer` implementation](https://github.com/nodejs/node/blob/v13.7.0/lib/buffer.js#L587-L663) and include `utf8`, `ucs2`, `utf16le`, `latin1`, `ascii`, `base64`, or `hex`.
 * @param {number} [options.highWaterMark=16384] Maximum number of bytes to store in the internal buffer before ceasing to read from the underlying resource.
 * @returns {Readable} [Node.js readable stream](https://nodejs.org/api/stream.html#stream_readable_streams) of the file’s contents.
 * @see [Node.js `Readable` stream constructor docs](https://nodejs.org/api/stream.html#stream_new_stream_readable_options).
 * @see [Node.js stream backpressure guide](https://nodejs.org/en/docs/guides/backpressuring-in-streams).
 */
