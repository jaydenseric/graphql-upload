import Busboy from 'busboy'
import objectPath from 'object-path'
import Capacitor from 'fs-capacitor'
import {
  SPEC_URL,
  MaxFileSizeUploadError,
  MaxFilesUploadError,
  MapBeforeOperationsUploadError,
  FilesBeforeMapUploadError,
  FileMissingUploadError,
  UploadPromiseDisconnectUploadError,
  FileStreamDisconnectUploadError
} from './errors'

const defaultErrorHandler = () => {}

class Upload {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = file => {
        this.file = file
        resolve(file)
      }
    })

    // Node has deprecated asynchronous handling of promises,
    // instead opting to crash the app.
    // https://github.com/nodejs/node/issues/20392
    this.promise.catch(defaultErrorHandler)
  }
}

// Dicer does not export definite error types, and so we are going to use
// its message as a mechanism for type detection:
const isEarlyTerminationError = err =>
  // https://github.com/mscdex/dicer/blob/3f75d507b7ad1a395f04028c724ee3ad99b78bb4/lib/Dicer.js#L62
  err.message === 'Unexpected end of multipart data' ||
  // https://github.com/mscdex/dicer/blob/3f75d507b7ad1a395f04028c724ee3ad99b78bb4/lib/Dicer.js#L65
  err.message ===
    'Part terminated early due to unexpected end of multipart data'

export const processRequest = (
  request,
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

    const exit = err => {
      reject(err)
      parser.destroy(err)
    }

    parser.on('field', (fieldName, value) => {
      switch (fieldName) {
        case 'operations':
          try {
            operations = JSON.parse(value)
            operationsPath = objectPath(operations)
          } catch (err) {
            exit(err)
          }
          break
        case 'map': {
          if (!operations)
            return exit(
              new MapBeforeOperationsUploadError(
                `Misordered multipart fields; “map” should follow “operations” (${SPEC_URL}).`,
                400
              )
            )

          let mapEntries
          try {
            mapEntries = Object.entries(JSON.parse(value))
          } catch (err) {
            return exit(err)
          }

          // Check max files is not exceeded, even though the number of files
          // to parse might not match the map provided by the client.
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

            // Repopulate operations with the promise wherever the file occurred
            // for use by the Upload scalar.
            for (const path of paths)
              operationsPath.set(path, map.get(fieldName).promise)
          }

          resolve(operations)
        }
      }
    })

    parser.on('file', (fieldName, source, filename, encoding, mimetype) => {
      if (!map) {
        source.on('error', defaultErrorHandler)
        source.resume()
        return exit(
          new FilesBeforeMapUploadError(
            `Misordered multipart fields; files should follow “map” (${SPEC_URL}).`,
            400
          )
        )
      }

      currentStream = source
      source.on('end', () => {
        if (currentStream === source) currentStream = null
      })

      if (map.has(fieldName)) {
        const capacitor = new Capacitor()
        capacitor.on('error', () => {
          source.unpipe()
          source.resume()
        })

        // Monkey patch busboy to emit an error when a file is too big.
        source.on('limit', () =>
          capacitor.destroy(
            new MaxFileSizeUploadError(
              'File truncated as it exceeds the size limit.'
            )
          )
        )

        source.on('error', err => {
          if (capacitor.finished || capacitor.destroyed) return

          // A terminated connection may cause the request to emit a 'close' event either before or after
          // the parser encounters an error, depending on the version of node and the state of stream buffers.
          if (isEarlyTerminationError(err))
            err = new FileStreamDisconnectUploadError(err.message)

          capacitor.destroy(err)
        })

        source.pipe(capacitor)

        map.get(fieldName).resolve({
          stream: capacitor,
          filename,
          mimetype,
          encoding
        })
      }

      // Discard the unexpected file.
      else source.resume()
    })

    parser.once('filesLimit', () => {
      exit(new MaxFilesUploadError(`${maxFiles} max file uploads exceeded.`))
    })

    parser.once('finish', () => {
      request.unpipe(parser)
      request.resume()

      if (map)
        for (const upload of map.values())
          if (!upload.file)
            upload.reject(
              new FileMissingUploadError('File missing in the request.')
            )
    })

    parser.on('error', err => {
      request.unpipe(parser)
      request.resume()

      if (map)
        for (const upload of map.values()) if (!upload.file) upload.reject(err)

      if (currentStream) currentStream.destroy(err)
    })

    request.on('close', () => {
      if (map)
        for (const upload of map.values())
          if (!upload.file)
            upload.reject(
              new UploadPromiseDisconnectUploadError(
                'Request disconnected before file upload stream parsing.'
              )
            )

      if (!parser._finished)
        parser.destroy(
          new FileStreamDisconnectUploadError(
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
    ctx.request.body = await processRequest(ctx.req, options)
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

  processRequest(request, options)
    .then(body => {
      request.body = body
      next()
    })
    .catch(error => {
      if (error.status && error.expose) response.status(error.status)
      next(error)
    })
}

export const apolloUpLoadRestify = (options) => (req, res, next) => {
  if (req.contentType().toLowerCase() !== 'multipart/form-data') {
    return next();
  }
  processRequest(req, options)
    .then((body) => {
      req.body = body;
      return next();
    })
    .catch((error) => {
      return next(new Error(error))
    });
};