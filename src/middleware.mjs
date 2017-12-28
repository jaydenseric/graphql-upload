import Busboy from 'busboy'
import objectPath from 'object-path'
import { SPEC_URL, UploadError } from './errors'

class Upload {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = file => {
        this.file = file

        file.stream.once('end', () => {
          this.done = true
        })

        // Monkey patch busboy to emit an error when a file is too big.
        file.stream.once('limit', () => {
          file.stream.emit(
            'error',
            new UploadError(
              'MaxFileSize',
              'File truncated as it exceeds the size limit.'
            )
          )
        })

        resolve(file)
      }
    })
  }
}

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

    function onFilesLimit() {
      if (map)
        for (const upload of Object.values(map))
          if (!upload.file)
            upload.reject(
              new UploadError(
                'MaxFiles',
                `${maxFiles} max file uploads exceeded.`
              )
            )
    }

    function onField(fieldName, value) {
      switch (fieldName) {
        case 'operations':
          operations = JSON.parse(value)
          operationsPath = objectPath(operations)
          break
        case 'map': {
          if (!operations)
            return reject(
              new UploadError(
                'MapBeforeOperations',
                `Misordered multipart fields; “map” should follow “operations” (${SPEC_URL}).`,
                400
              )
            )

          const mapEntries = Object.entries(JSON.parse(value))

          // Check max files is not exceeded, even though the number of files
          // to parse might not match the map provided by the client.
          if (mapEntries.length > maxFiles)
            return reject(
              new UploadError(
                'MaxFiles',
                `${maxFiles} max file uploads exceeded.`,
                413
              )
            )

          map = {}
          for (const [fieldName, paths] of mapEntries) {
            map[fieldName] = new Upload()

            // Repopulate operations with the promise wherever the file occured
            // for use by the Upload scalar.
            for (const path of paths)
              operationsPath.set(path, map[fieldName].promise)
          }

          resolve(operations)
        }
      }
    }

    function onFile(fieldName, stream, filename, encoding, mimetype) {
      if (!map)
        return reject(
          new UploadError(
            'FilesBeforeMap',
            `Misordered multipart fields; files should follow “map” (${SPEC_URL}).`,
            400
          )
        )

      if (fieldName in map)
        // File is expected.
        map[fieldName].resolve({
          stream,
          filename,
          mimetype,
          encoding
        })
      else
        // Discard the unexpected file.
        stream.resume()
    }

    function onFinish() {
      if (map)
        for (const upload of Object.values(map))
          if (!upload.file)
            upload.reject(
              new UploadError('FileMissing', 'File missing in the request.')
            )
    }

    function onAborted() {
      if (map)
        for (const upload of Object.values(map))
          if (!upload.file)
            upload.reject(
              new UploadError(
                'AbortedUploadPromise',
                'Request aborted before the file upload stream could be parsed.'
              )
            )
          else if (!upload.done) {
            upload.file.stream.truncated = true
            upload.file.stream.emit(
              'error',
              new UploadError(
                'AbortedFileStream',
                'Request aborted while the file upload stream was being parsed.'
              )
            )
            upload.file.stream.destroy()
          }
    }

    parser.once('filesLimit', onFilesLimit)
    parser.on('field', onField)
    parser.on('file', onFile)
    parser.once('finish', onFinish)
    request.once('aborted', onAborted)

    request.pipe(parser)
  })

export const apolloUploadKoa = options => async (ctx, next) => {
  if (ctx.request.is('multipart/form-data'))
    ctx.request.body = await processRequest(ctx.req, options)
  await next()
}

export const apolloUploadExpress = options => (request, response, next) => {
  if (!request.is('multipart/form-data')) return next()
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
