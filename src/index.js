import mkdirp from 'mkdirp'
import formidable from 'formidable'
import objectPath from 'object-path'

export function apolloUploadExpress ({
  // Defaults to the OS temp directory
  uploadDir
}) {
  // Ensure provided upload directory exists
  if (uploadDir) mkdirp.sync(uploadDir)

  return (request, response, next) => {
    // Skip if there are no uploads
    if (!request.is('multipart/form-data')) return next()

    // Parse the multipart request
    const form = formidable.IncomingForm({
      uploadDir
    })
    form.parse(request, (error, fields, files) => {
      if (error) return next(error)

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

      // Apollo expects the fields in the request body
      request.body = fields

      // Request ready for Apollo middleware
      next()
    })
  }
}
