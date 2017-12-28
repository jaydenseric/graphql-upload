export const SPEC_URL =
  'https://github.com/jaydenseric/graphql-multipart-request-spec'

export class UploadError extends Error {
  constructor(name, message, status) {
    super(message)
    this.name = `${name}UploadError`
    if (status) {
      this.status = status
      this.expose = true
    }
  }
}
