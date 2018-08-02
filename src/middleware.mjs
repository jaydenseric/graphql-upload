import Busboy from 'busboy'
import objectPath from 'object-path'
import WriteStream from 'fs-capacitor'
import {
  SPEC_URL,
  MaxFileSizeUploadError,
  MaxFilesUploadError,
  MapBeforeOperationsUploadError,
  FilesBeforeMapUploadError,
  FileMissingUploadError,
  DisconnectUploadError
} from './errors'

class Upload {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = file => {
        this.file = file
        resolve(file)
      }
    })

    // Prevent errors crashing Node.js, see:
    // https://github.com/nodejs/node/issues/20392
    this.promise.catch(() => {})
  }
}

export const processRequest = (
  request,
  response,
  { maxFieldSize, maxFileSize, maxFiles } = {}
) =>
  new Promise((resolve, reject) => {
    const parser = new Busboy({
      headers: request.headers,
      limits: {
        fieldSize: maxFieldSize,
        fields: 2, // Only operations and map.
        fileSize: maxFileSize,
        files: maxFiles
      }
    })

    let operations
    let operationsPath
    let map
    let currentStream
    let requestEnded = false
    let error

    const exit = e => {
      error = error || e
      reject(error)
      request.unpipe(parser)
      parser.destroy(error)
    }

    parser.on('field', (fieldName, value) => {
      switch (fieldName) {
        case 'operations':
          try {
            operations = JSON.parse(value)
            operationsPath = objectPath(operations)
          } catch (error) {
            exit(error)
          }
          break
        case 'map': {
          if (!operations)
            return exit(
              new MapBeforeOperationsUploadError(
                `Misordered multipart fields; ‘map’ should follow ‘operations’ (${SPEC_URL}).`,
                400
              )
            )

          let mapEntries
          try {
            mapEntries = Object.entries(JSON.parse(value))
          } catch (error) {
            return exit(error)
          }

          // Check max files is not exceeded, even though the number of files to
          // parse might not match the map provided by the client.
          if (mapEntries.length > maxFiles)
            return exit(
              new MaxFilesUploadError(
                `${maxFiles} max file uploads exceeded.`,
                413
              )
            )

          map = new Map()
          for (const [fieldName, paths] of mapEntries) {
            map.set(fieldName, new Upload())

            for (const path of paths)
              operationsPath.set(path, map.get(fieldName).promise)
          }

          resolve(operations)
        }
      }
    })

    parser.on('file', (fieldName, stream, filename, encoding, mimetype) => {
      if (!map) {
        // Prevent an unhandled error from crashing the process.
        stream.on('error', () => {})
        stream.resume()

        return exit(
          new FilesBeforeMapUploadError(
            `Misordered multipart fields; files should follow ‘map’ (${SPEC_URL}).`,
            400
          )
        )
      }

      currentStream = stream
      stream.on('end', () => {
        if (currentStream === stream) currentStream = null
      })

      const upload = map.get(fieldName)
      if (upload) {
        const capacitor = new WriteStream()

        capacitor.on('error', () => {
          stream.unpipe()
          stream.resume()
        })

        stream.on('limit', () => {
          currentStream = null
          stream.unpipe()
          capacitor.destroy(
            new MaxFileSizeUploadError(
              'File truncated as it exceeds the size limit.',
              413
            )
          )
        })

        stream.on('error', error => {
          currentStream = null
          if (capacitor.finished || capacitor.destroyed) return

          // A terminated connection may cause the request to emit a 'close'
          // event either before or after the parser encounters an error,
          // depending on the Node.js version and the state of stream buffers.

          if (
            error.message ===
              // https://github.com/mscdex/dicer/blob/v0.2.5/lib/Dicer.js#L62
              'Unexpected end of multipart data' ||
            error.message ===
              // https://github.com/mscdex/dicer/blob/v0.2.5/lib/Dicer.js#L65
              'Part terminated early due to unexpected end of multipart data'
          )
            error = new DisconnectUploadError(error.message)

          stream.unpipe()
          capacitor.destroy(error)
        })

        stream.pipe(capacitor)

        upload.resolve(
          Object.create(null, {
            capacitor: { value: capacitor, enumerable: false },
            createReadStream: {
              value() {
                if (capacitor.error || error) throw capacitor.error || error
                return capacitor.createReadStream()
              },
              enumerable: true
            },
            encoding: { value: encoding, enumerable: true },
            filename: { value: filename, enumerable: true },
            mimetype: { value: mimetype, enumerable: true }
          })
        )
      }
      // Discard the unexpected file.
      else {
        stream.on('error', () => {})
        stream.resume()
      }
    })

    parser.once('filesLimit', () => {
      exit(
        new MaxFilesUploadError(`${maxFiles} max file uploads exceeded.`, 413)
      )
    })

    parser.once('finish', () => {
      request.unpipe(parser)
      request.resume()

      if (map)
        for (const upload of map.values())
          if (!upload.file)
            upload.reject(
              new FileMissingUploadError('File missing in the request.', 400)
            )
    })

    parser.on('error', error => {
      request.unpipe(parser)
      request.resume()

      if (currentStream) currentStream.destroy(error)

      if (map)
        for (const upload of map.values())
          if (!upload.file) upload.reject(error)
    })

    const release = () => {
      if (map)
        for (const upload of map.values())
          if (upload.file) upload.file.capacitor.destroy()
    }

    response.on('finish', release)
    response.on('close', release)

    request.on('end', () => {
      requestEnded = true
    })

    request.on('close', () => {
      if (!requestEnded)
        exit(
          new DisconnectUploadError(
            'Request disconnected during file upload stream parsing.'
          )
        )
    })

    request.pipe(parser)
  })

export const apolloUploadKoa = options => async (ctx, next) => {
  if (!ctx.request.is('multipart/form-data')) return next()

  const finished = new Promise(resolve => ctx.req.on('end', resolve))

  try {
    ctx.request.body = await processRequest(ctx.req, ctx.res, options)
    await next()
  } finally {
    await finished
  }
}

export const apolloUploadExpress = options => (request, response, next) => {
  if (!request.is('multipart/form-data')) return next()

  const finished = new Promise(resolve => request.on('end', resolve))

  const { send } = response
  response.send = (...args) => {
    finished.then(() => {
      response.send = send
      response.send(...args)
    })
  }

  processRequest(request, response, options)
    .then(body => {
      request.body = body
      next()
    })
    .catch(error => {
      if (error.status && error.expose) response.status(error.status)
      next(error)
    })
}
