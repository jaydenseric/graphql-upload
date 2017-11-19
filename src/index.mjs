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

export const processRequest = (
  request,
  { maxFieldSize, maxFileSize, maxFiles } = {}
) =>
  new Promise(resolve => {
    const busboy = new Busboy({
      headers: request.headers,
      limits: {
        fieldSize: maxFieldSize,
        fields: 2, // Only operations and map
        fileSize: maxFileSize,
        files: maxFiles
      }
    })

    // GraphQL multipart request spec:
    // https://github.com/jaydenseric/graphql-multipart-request-spec

    let operations
    let operationsPath

    busboy.on('field', (fieldName, value) => {
      switch (fieldName) {
        case 'operations':
          operations = JSON.parse(value)
          operationsPath = objectPath(operations)
          break
        case 'map': {
          for (const [mapFieldName, paths] of Object.entries(
            JSON.parse(value)
          )) {
            // Upload scalar
            const upload = new Promise(resolve =>
              busboy.on(
                'file',
                (fieldName, stream, filename, encoding, mimetype) =>
                  fieldName === mapFieldName &&
                  resolve({ stream, filename, mimetype, encoding })
              )
            )

            for (const path of paths) operationsPath.set(path, upload)
          }
          resolve(operations)
        }
      }
    })

    request.pipe(busboy)
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
