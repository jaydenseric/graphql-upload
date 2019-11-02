import util from 'util'
import Busboy from 'busboy'
import { WriteStream } from 'fs-capacitor'
import createError from 'http-errors'
import objectPath from 'object-path'
import { SPEC_URL } from './constants'
import { ignoreStream } from './ignoreStream'
import { isEnumerableObject } from './isEnumerableObject'

/**
 * An expected file upload.
 * @kind class
 * @name Upload
 * @ignore
 */
class Upload {
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
       * @param {object} error Error instance.
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
 * Errors are created with [`http-errors`](https://npm.im/http-errors) to assist
 * in sending responses with appropriate HTTP status codes. Used in
 * [`graphqlUploadExpress`]{@link graphqlUploadExpress} and
 * [`graphqlUploadKoa`]{@link graphqlUploadKoa} and can be used to
 * create custom middleware.
 * @kind function
 * @name processRequest
 * @type {ProcessRequestFunction}
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
    let released
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
     * @param {object} error Error instance.
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
      // istanbul ignore next
      if (released) return
      released = true

      if (map)
        for (const upload of map.values())
          if (upload.file) upload.file.capacitor.release()
    }

    /**
     * Handles when the request is closed before it properly ended.
     * @kind function
     * @name processRequest~abort
     * @ignore
     */
    const abort = () => {
      exit(
        createError(
          499,
          'Request disconnected during file upload stream parsing.'
        )
      )
    }

    parser.on(
      'field',
      (fieldName, value, fieldNameTruncated, valueTruncated) => {
        if (exitError) return

        if (valueTruncated)
          return exit(
            createError(
              413,
              `The ‘${fieldName}’ multipart field value exceeds the ${maxFieldSize} byte size limit.`
            )
          )

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

            if (!isEnumerableObject(operations) && !Array.isArray(operations))
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

            if (!isEnumerableObject(parsedMap))
              return exit(
                createError(
                  400,
                  `Invalid type for the ‘map’ multipart field (${SPEC_URL}).`
                )
              )

            const mapEntries = Object.entries(parsedMap)

            // Check max files is not exceeded, even though the number of files to
            // parse might not match th(e map provided by the client.
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
                if (typeof path !== 'string')
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
      }
    )

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
        currentStream = null
      })

      const upload = map.get(fieldName)

      if (!upload) {
        // The file is extraneous. As the rest can still be processed, just
        // ignore it and don’t exit with an error.
        ignoreStream(stream)
        return
      }

      let fileError
      const capacitor = new WriteStream()

      capacitor.on('error', () => {
        stream.unpipe()
        stream.resume()
      })

      stream.on('limit', () => {
        fileError = createError(
          413,
          `File truncated as it exceeds the ${maxFileSize} byte size limit.`
        )
        stream.unpipe()
        capacitor.destroy(fileError)
      })

      stream.on('error', error => {
        fileError = error
        stream.unpipe()
        // istanbul ignore next
        capacitor.destroy(exitError || error)
      })

      const file = {
        filename,
        mimetype,
        encoding,
        createReadStream() {
          const error = fileError || (released ? exitError : null)
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

      capacitor.once('close', () =>
        Object.defineProperty(file, 'closed', { value: true })
      )

      stream.pipe(capacitor)
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

    request.once('close', abort)
    request.once('end', () => {
      request.removeListener('close', abort)
    })

    request.pipe(parser)
  })
