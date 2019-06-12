import util from 'util'
import Busboy from 'busboy'
import WriteStream from 'fs-capacitor'
import createError from 'http-errors'
import objectPath from 'object-path'

/**
 * Official [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * URL. Useful for error messages, etc.
 * @kind constant
 * @name SPEC_URL
 * @type {string}
 * @ignore
 */
const SPEC_URL = 'https://github.com/jaydenseric/graphql-multipart-request-spec'

/**
 * Checks if a value is an object with properties.
 * @kind function
 * @name isObject
 * @param {*} value Value to check.
 * @returns {boolean} Is the value an object.
 * @ignore
 */
const isObject = value => value && value.constructor === Object

/**
 * Checks if a value is a string.
 * @kind function
 * @name isString
 * @param {*} value Value to check.
 * @returns {boolean} Is the value a string.
 * @ignore
 */
const isString = value => typeof value === 'string' || value instanceof String

/**
 * Safely ignores a readable stream.
 * @kind function
 * @name ignoreStream
 * @param {ReadableStream} stream Readable stream.
 * @ignore
 */
const ignoreStream = stream => {
  // Prevent an unhandled error from crashing the process.
  stream.on('error', () => {})

  // Waste the stream.
  stream.resume()
}

/**
 * An expected file upload.
 * @kind class
 * @name Upload
 * @ignore
 */
class Upload {
  // eslint-disable-next-line require-jsdoc
  constructor() {
    /**
     * Promise that resolves file upload details.
     * @kind member
     * @name Upload#promise
     * @type {Promise<FileUpload>}
     * @ignore
     */
    this.promise = new Promise((resolve, reject) => {
      /**
       * Resolves the upload promise with the file upload details.
       * @kind function
       * @name Upload#resolve
       * @param {FileUpload} file File upload details.
       * @ignore
       */
      this.resolve = file => {
        this.file = file
        resolve(file)
      }

      /**
       * Rejects the upload promise with an error.
       * @kind function
       * @name Upload#reject
       * @param {Object} error Error instance.
       * @ignore
       */
      this.reject = reject
    })

    // Prevent errors crashing Node.js, see:
    // https://github.com/nodejs/node/issues/20392
    this.promise.catch(() => {})
  }
}

/**
 * Processes a [GraphQL multipart request](https://github.com/jaydenseric/graphql-multipart-request-spec).
 * Used in [`graphqlUploadKoa`]{@link graphqlUploadKoa} and [`graphqlUploadExpress`]{@link graphqlUploadExpress}
 * and can be used to create custom middleware.
 * @kind function
 * @name processRequest
 * @param {IncomingMessage} request [Node.js HTTP server request instance](https://nodejs.org/api/http.html#http_class_http_incomingmessage).
 * @param {ServerResponse} response [Node.js HTTP server response instance](https://nodejs.org/api/http.html#http_class_http_serverresponse).
 * @param {UploadOptions} [options] GraphQL upload options.
 * @returns {Promise<GraphQLOperation | Array<GraphQLOperation>>} GraphQL operation or batch of operations for a GraphQL server to consume (usually as the request body).
 * @example <caption>How to import.</caption>
 * ```js
 * import { processRequest } from 'graphql-upload'
 * ```
 */
export const processRequest = (
  request,
  response,
  {
    maxFieldSize = 1000000, // 1 MB
    maxFileSize = Infinity,
    maxFiles = Infinity
  } = {}
) =>
  new Promise((resolve, reject) => {
    let requestEnded = false
    let released = false
    let exitError
    let currentStream
    let operations
    let operationsPath
    let map

    const parser = new Busboy({
      headers: request.headers,
      limits: {
        fieldSize: maxFieldSize,
        fields: 2, // Only operations and map.
        fileSize: maxFileSize,
        files: maxFiles
      }
    })

    /**
     * Exits request processing with an error. Successive calls have no effect.
     * @kind function
     * @name processRequest~exit
     * @param {Object} error Error instance.
     * @ignore
     */
    const exit = error => {
      if (exitError) return
      exitError = error

      reject(exitError)

      parser.destroy()

      if (currentStream) currentStream.destroy(exitError)

      if (map)
        for (const upload of map.values())
          if (!upload.file) upload.reject(exitError)

      request.unpipe(parser)

      // With a sufficiently large request body, subsequent events in the same
      // event frame cause the stream to pause after the parser is destroyed. To
      // ensure that the request resumes, the call to .resume() is scheduled for
      // later in the event loop.
      setImmediate(() => {
        request.resume()
      })
    }

    /**
     * Releases resources and cleans up Capacitor temporary files. Successive
     * calls have no effect.
     * @kind function
     * @name processRequest~release
     * @ignore
     */
    const release = () => {
      if (released) return
      released = true

      if (map)
        for (const upload of map.values())
          if (upload.file) upload.file.capacitor.destroy()
    }

    parser.on('field', (fieldName, value) => {
      if (exitError) return

      switch (fieldName) {
        case 'operations':
          try {
            operations = JSON.parse(value)
          } catch (error) {
            return exit(
              createError(
                400,
                `Invalid JSON in the ‘operations’ multipart field (${SPEC_URL}).`
              )
            )
          }

          if (!isObject(operations) && !Array.isArray(operations))
            return exit(
              createError(
                400,
                `Invalid type for the ‘operations’ multipart field (${SPEC_URL}).`
              )
            )

          operationsPath = objectPath(operations)

          break
        case 'map': {
          if (!operations)
            return exit(
              createError(
                400,
                `Misordered multipart fields; ‘map’ should follow ‘operations’ (${SPEC_URL}).`
              )
            )

          let parsedMap
          try {
            parsedMap = JSON.parse(value)
          } catch (error) {
            return exit(
              createError(
                400,
                `Invalid JSON in the ‘map’ multipart field (${SPEC_URL}).`
              )
            )
          }

          if (!isObject(parsedMap))
            return exit(
              createError(
                400,
                `Invalid type for the ‘map’ multipart field (${SPEC_URL}).`
              )
            )

          const mapEntries = Object.entries(parsedMap)

          // Check max files is not exceeded, even though the number of files to
          // parse might not match the map provided by the client.
          if (mapEntries.length > maxFiles)
            return exit(
              createError(413, `${maxFiles} max file uploads exceeded.`)
            )

          map = new Map()
          for (const [fieldName, paths] of mapEntries) {
            if (!Array.isArray(paths))
              return exit(
                createError(
                  400,
                  `Invalid type for the ‘map’ multipart field entry key ‘${fieldName}’ array (${SPEC_URL}).`
                )
              )

            map.set(fieldName, new Upload())

            for (const [index, path] of paths.entries()) {
              if (!isString(path))
                return exit(
                  createError(
                    400,
                    `Invalid type for the ‘map’ multipart field entry key ‘${fieldName}’ array index ‘${index}’ value (${SPEC_URL}).`
                  )
                )

              try {
                operationsPath.set(path, map.get(fieldName).promise)
              } catch (error) {
                return exit(
                  createError(
                    400,
                    `Invalid object path for the ‘map’ multipart field entry key ‘${fieldName}’ array index ‘${index}’ value ‘${path}’ (${SPEC_URL}).`
                  )
                )
              }
            }
          }

          resolve(operations)
        }
      }
    })

    parser.on('file', (fieldName, stream, filename, encoding, mimetype) => {
      if (exitError) {
        ignoreStream(stream)
        return
      }

      if (!map) {
        ignoreStream(stream)
        return exit(
          createError(
            400,
            `Misordered multipart fields; files should follow ‘map’ (${SPEC_URL}).`
          )
        )
      }

      currentStream = stream
      stream.on('end', () => {
        if (currentStream === stream) currentStream = null
      })

      const upload = map.get(fieldName)

      if (!upload) {
        // The file is extraneous. As the rest can still be processed, just
        // ignore it and don’t exit with an error.
        ignoreStream(stream)
        return
      }

      const capacitor = new WriteStream()

      capacitor.on('error', () => {
        stream.unpipe()
        stream.resume()
      })

      stream.on('limit', () => {
        if (currentStream === stream) currentStream = null
        stream.unpipe()
        capacitor.destroy(
          createError(413, 'File truncated as it exceeds the size limit.')
        )
      })

      stream.on('error', error => {
        if (currentStream === stream) currentStream = null
        stream.unpipe()
        capacitor.destroy(exitError || error)
      })

      stream.pipe(capacitor)

      const file = {
        filename,
        mimetype,
        encoding,
        createReadStream() {
          const error = capacitor.error || (released ? exitError : null)
          if (error) throw error
          return capacitor.createReadStream()
        }
      }

      let capacitorStream
      Object.defineProperty(file, 'stream', {
        get: util.deprecate(function() {
          if (!capacitorStream) capacitorStream = this.createReadStream()
          return capacitorStream
        }, 'File upload property ‘stream’ is deprecated. Use ‘createReadStream()’ instead.')
      })

      Object.defineProperty(file, 'capacitor', { value: capacitor })

      upload.resolve(file)
    })

    parser.once('filesLimit', () =>
      exit(createError(413, `${maxFiles} max file uploads exceeded.`))
    )

    parser.once('finish', () => {
      request.unpipe(parser)
      request.resume()

      if (!operations)
        return exit(
          createError(
            400,
            `Missing multipart field ‘operations’ (${SPEC_URL}).`
          )
        )

      if (!map)
        return exit(
          createError(400, `Missing multipart field ‘map’ (${SPEC_URL}).`)
        )

      for (const upload of map.values())
        if (!upload.file)
          upload.reject(createError(400, 'File missing in the request.'))
    })

    parser.once('error', exit)

    response.once('finish', release)
    response.once('close', release)

    request.once('end', () => {
      requestEnded = true
    })

    request.once('close', () => {
      if (!requestEnded)
        exit(
          createError(
            499,
            'Request disconnected during file upload stream parsing.'
          )
        )
    })

    request.pipe(parser)
  })

/**
 * GraphQL upload server options, mostly relating to security, performance and
 * limits.
 * @kind typedef
 * @name UploadOptions
 * @type {Object}
 * @prop {number} [maxFieldSize=1000000] Maximum allowed non-file multipart form field size in bytes; enough for your queries.
 * @prop {number} [maxFileSize=Infinity] Maximum allowed file size in bytes.
 * @prop {number} [maxFiles=Infinity] Maximum allowed number of files.
 */

/**
 * A GraphQL operation object in a shape that can be consumed and executed by
 * most GraphQL servers.
 * @kind typedef
 * @name GraphQLOperation
 * @type {Object}
 * @prop {string} query GraphQL document containing queries and fragments.
 * @prop {string|null} [operationName] GraphQL document operation name to execute.
 * @prop {object|null} [variables] GraphQL document operation variables and values map.
 * @see [GraphQL over HTTP spec](https://github.com/APIs-guru/graphql-over-http#request-parameters).
 * @see [Apollo Server POST requests](https://www.apollographql.com/docs/apollo-server/requests#postRequests).
 */
