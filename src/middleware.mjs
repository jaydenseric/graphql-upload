import Busboy from 'busboy'
import objectPath from 'object-path'
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

    const close = () => {
      if (map)
        for (const upload of map.values())
          if (!upload.file)
            upload.reject(
              new UploadPromiseDisconnectUploadError(
                'Request disconnected before file upload stream parsing.'
              )
            )
          else if (!upload.done && !upload.file.stream.truncated) {
            upload.file.stream.truncated = true

            // Prevent a crash if the stream disconnects before the consumers’
            // error listeners can attach.
            if (!upload.file.stream.listenerCount('error'))
              upload.file.stream.once('error', () => {})

            upload.file.stream.destroy(
              new FileStreamDisconnectUploadError(
                'Request disconnected during file upload stream parsing.'
              )
            )
          }
    }

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
            map.set(fieldName, new Upload())

            // Repopulate operations with the promise wherever the file occurred
            // for use by the Upload scalar.
            for (const path of paths)
              operationsPath.set(path, map.get(fieldName).promise)
          }

          resolve({ operations, map })
        }
      }
    })

    parser.on('file', (fieldName, stream, filename, encoding, mimetype) => {
      if (!map)
        return reject(
          new FilesBeforeMapUploadError(
            `Misordered multipart fields; files should follow “map” (${SPEC_URL}).`,
            400
          )
        )

      if (map.has(fieldName))
        // File is expected.
        map.get(fieldName).resolve({
          stream,
          filename,
          mimetype,
          encoding
        })
      // Discard the unexpected file.
      else stream.resume()
    })

    parser.once('filesLimit', () => {
      if (map)
        for (const upload of map.values())
          if (!upload.file)
            upload.reject(
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
    })

    parser.on('error', close)

    request.on('close', close)

    request.pipe(parser)
  })

export const apolloUploadKoa = options => async (ctx, next) => {
  if (!ctx.request.is('multipart/form-data')) return next()

  // add uploads to the request
  const { operations, map } = await processRequest(ctx.req, options)
  ctx.request.body = operations

  try {
    ctx.respond = false
    await next()
  } finally {
    await Promise.all(
      [...map.values()].map(async upload => {
        if (upload.done) return

        await upload.promise
        return new Promise(resolve => {
          upload.file.stream.on('end', resolve)
          upload.file.stream.on('error', resolve)
          if (!upload.file.stream.readableFlowing) upload.file.stream.resume()
        })
      })
    )

    ctx.respond = true
    if (ctx.body) ctx.body = ctx.body
  }
}

export const apolloUploadExpress = options => (request, response, next) => {
  if (!request.is('multipart/form-data')) return next()
  processRequest(request, options)
    .then(({ operations }) => {
      request.body = operations
      next()
    })
    .catch(error => {
      if (error.status && error.expose) response.status(error.status)
      next(error)
    })
}
