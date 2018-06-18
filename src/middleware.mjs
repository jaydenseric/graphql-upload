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
  constructor(errorHandler) {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = file => {
        this.file = file

        file.stream.once('end', () => {
          this.done = true
        })

        // Monkey patch busboy to emit an error when a file is too big.
        file.stream.once('limit', () =>
          file.stream.destroy(
            new MaxFileSizeUploadError(
              'File truncated as it exceeds the size limit.'
            )
          )
        )

        resolve(file)
      }
    })

    // Node has deprecated asynchronous handling of promises,
    // instead opting to crash the app.
    // https://github.com/nodejs/node/issues/20392
    this.promise.catch(errorHandler || defaultErrorHandler)
  }
}

export const processRequest = (
  request,
  { maxFieldSize, maxFileSize, maxFiles, errorHandler } = {}
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

    let resolveFinished
    const finished = new Promise(resolve => {
      resolveFinished = resolve
    })

    let operations
    let operationsPath
    let map
    let currentStream

    parser.on('field', (fieldName, value) => {
      switch (fieldName) {
        case 'operations':
          operations = JSON.parse(value)
          operationsPath = objectPath(operations)
          break
        case 'map': {
          if (!operations)
            return reject(
              new MapBeforeOperationsUploadError(
                `Misordered multipart fields; “map” should follow “operations” (${SPEC_URL}).`,
                400
              )
            )

          const mapEntries = Object.entries(JSON.parse(value))

          // Check max files is not exceeded, even though the number of files
          // to parse might not match the map provided by the client.
          if (mapEntries.length > maxFiles)
            return reject(
              new MaxFilesUploadError(
                `${maxFiles} max file uploads exceeded.`,
                413
              )
            )

          map = new Map()
          for (const [fieldName, paths] of mapEntries) {
            map.set(fieldName, new Upload(errorHandler))

            // Repopulate operations with the promise wherever the file occurred
            // for use by the Upload scalar.
            for (const path of paths)
              operationsPath.set(path, map.get(fieldName).promise)
          }

          resolve({ operations, finished })
        }
      }
    })

    parser.on('file', (fieldName, source, filename, encoding, mimetype) => {
      if (!map)
        return reject(
          new FilesBeforeMapUploadError(
            `Misordered multipart fields; files should follow “map” (${SPEC_URL}).`,
            400
          )
        )

      currentStream = source
      source.on('end', () => {
        if (currentStream === source) currentStream = null
      })

      if (map.has(fieldName)) {
        const capacitor = new Capacitor()
        capacitor.on('error', err => {
          source.unpipe()
          source.resume()
          const handler = errorHandler || defaultErrorHandler
          handler(err)
        })

        source.on('error', err => {
          if (!capacitor.finished) capacitor.destroy(err)
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
      parser.destroy(
        new MaxFilesUploadError(`${maxFiles} max file uploads exceeded.`)
      )
    })

    parser.once('finish', () => {
      if (map)
        for (const upload of map.values())
          if (!upload.file)
            upload.reject(
              new FileMissingUploadError('File missing in the request.')
            )

      resolveFinished()
    })

    parser.on('error', err => {
      if (map)
        for (const upload of map.values()) if (!upload.file) upload.reject(err)

      if (currentStream) currentStream.destroy(err)

      resolveFinished()
      request.unpipe(parser)
      request.resume()
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
  const { operations, finished } = await processRequest(ctx.req, options)
  ctx.request.body = operations
  await next()
  await finished
}

export const apolloUploadExpress = options => (request, response, next) => {
  if (!request.is('multipart/form-data')) return next()
  processRequest(request, options)
    .then(({ operations, finished }) => {
      request.body = operations

      const { send } = response
      response.send = (...args) => {
        finished.then(() => {
          response.send = send
          response.send(...args)
        })
      }

      next()
    })
    .catch(error => {
      if (error.status && error.expose) response.status(error.status)
      next(error)
    })
}
