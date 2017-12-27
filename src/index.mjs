import { GraphQLScalarType } from 'graphql'
import Busboy from 'busboy'
import objectPath from 'object-path'

export const GraphQLUpload = new GraphQLScalarType({
  name: 'Upload',
  description:
    'The `Upload` scalar type represents a file upload promise that resolves ' +
    'an object containing `stream`, `filename`, `mimetype` and `encoding`.',
  parseValue: value => value,
  parseLiteral() {
    throw new Error('Upload scalar literal unsupported')
  },
  serialize() {
    throw new Error('Upload scalar serialization unsupported')
  }
})

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
            new Error('File truncated as it exceeds the size limit.')
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

    // GraphQL multipart request spec:
    // https://github.com/jaydenseric/graphql-multipart-request-spec

    let operations
    let operationsPath
    let map

    parser.on('field', (fieldName, value) => {
      switch (fieldName) {
        case 'operations':
          operations = JSON.parse(value)
          operationsPath = objectPath(operations)
          break
        case 'map': {
          if (!operations) {
            const error = new Error(
              'Misordered multipart fields; “map” should follow “operations”.'
            )
            error.status = 400
            error.expose = true
            reject(error)
          }

          map = JSON.parse(value)

          // Check max files is not exceeded, even though the number of files
          // to parse might not match the map provided by the client.
          if (Object.keys(map).length > maxFiles) {
            const error = new Error(`${maxFiles} max file uploads exceeded.`)
            error.status = 413
            error.expose = true
            reject(error)
          }

          for (const [fieldName, paths] of Object.entries(map)) {
            map[fieldName] = new Upload()

            // Repopulate operations with the promise wherever the file occured
            // for use by the Upload scalar.
            for (const path of paths)
              operationsPath.set(path, map[fieldName].promise)
          }

          resolve(operations)
        }
      }
    })

    parser.on('file', (fieldName, stream, filename, encoding, mimetype) => {
      if (!map) {
        const error = new Error(
          'Misordered multipart fields; files should follow “map”.'
        )
        error.status = 400
        error.expose = true
        reject(error)
      }

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
    })

    parser.once('filesLimit', () => {
      for (const upload of Object.values(map))
        if (!upload.file)
          upload.reject(new Error(`${maxFiles} max file uploads exceeded.`))
    })

    parser.once('finish', () => {
      for (const upload of Object.values(map))
        if (!upload.file)
          upload.reject(new Error('File missing in the request.'))
    })

    request.once('aborted', () => {
      for (const upload of Object.values(map))
        if (!upload.file)
          upload.reject(
            new Error(
              'Request aborted before the file upload stream could be parsed.'
            )
          )
        else if (!upload.done) {
          upload.file.stream.truncated = true
          upload.file.stream.emit(
            'error',
            new Error(
              'Request aborted while the file upload stream was being parsed.'
            )
          )
          upload.file.stream.destroy()
        }
    })

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
    .catch(next)
}
