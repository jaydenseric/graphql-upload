import mkdirp from 'mkdirp'
import formidable from 'formidable'
import objectPath from 'object-path'

export function processRequest(request, { uploadDir } = {}) {
  // Ensure provided upload directory exists
  if (uploadDir) mkdirp.sync(uploadDir)

  const form = formidable.IncomingForm({
    // Defaults to the OS temp directory
    uploadDir
  })

  // Parse the multipart form request
  return new Promise((resolve, reject) => {
    form.parse(request, (error, { operations }, files) => {
      if (error) reject(new Error(error))

      // Decode the GraphQL operation(s). This is an array if batching is
      // enabled.
      operations = JSON.parse(operations)

      // Check if files were uploaded
      if (Object.keys(files).length) {
        // File field names contain the original path to the File object in the
        // GraphQL operation input variables. Relevent data for each uploaded
        // file now gets placed back in the variables.
        const operationsPath = objectPath(operations)
        Object.keys(files).forEach(variablesPath => {
          const { name, type, size, path } = files[variablesPath]
          operationsPath.set(variablesPath, { name, type, size, path })
        })
      }

      // Provide fields for replacement request body
      resolve(operations)
    })
  })
}

export function apolloUploadKoa(options) {
  return async function(ctx, next) {
    // Skip if there are no uploads
    if (ctx.request.is('multipart/form-data'))
      ctx.request.body = await processRequest(ctx.req, options)
    await next()
  }
}

export function apolloUploadExpress(options) {
  return (request, response, next) => {
    // Skip if there are no uploads
    if (!request.is('multipart/form-data')) return next()
    processRequest(request, options)
      .then(body => {
        request.body = body
        next()
      })
      .catch(next)
  }
}
