import mkdirp from 'mkdirp'
import formidable from 'formidable'
import objectPath from 'object-path'

export function processRequest (request, {uploadDir} = {}) {
  // Ensure provided upload directory exists
  if (uploadDir) mkdirp.sync(uploadDir)

  const form = formidable.IncomingForm({
    // Defaults to the OS temp directory
    uploadDir
  })

  // Parse the multipart request
  return new Promise((resolve, reject) => {
    form.parse(request, (error, fields, files) => {
      if (error) reject(new Error(error))

      // Decode the GraphQL variables
      fields.variables = JSON.parse(fields.variables)

      // File field names contain the original path to
      // the File object in the GraphQL input variables.
      // Relevent data for each uploaded file now gets
      // placed back in the variables.
      const variables = objectPath(fields.variables)
      Object.keys(files).forEach(variablesPath => {
        const {name, type, size, path} = files[variablesPath]
        variables.set(variablesPath, {name, type, size, path})
      })

      // Provide fields for new request body
      resolve(fields)
    })
  })
}

export function apolloUploadExpress (options) {
  return (request, response, next) => {
    // Skip if there are no uploads
    if (!request.is('multipart/form-data')) return next()
    // Process the request
    processRequest(request, options).then(body => {
      request.body = body
      next()
    })
  }
}

export function apolloUploadKoa (options) {
  return async function (ctx, next) {
    // Skip if there are no uploads
    if (!ctx.request.is('multipart/form-data')) return await next()
    // Process the request
    ctx.request.body = await processRequest(ctx.req, options)
    await next()
  }
}
