/**
 * Official [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
 * URL. Useful for error messages, etc.
 * @kind constant
 * @name SPEC_URL
 * @type {string}
 * @example <caption>How to import.</caption>
 * ```js
 * import { SPEC_URL } from 'apollo-upload-server'
 * ```
 */
export const SPEC_URL =
  'https://github.com/jaydenseric/graphql-multipart-request-spec'

/* eslint-disable require-jsdoc */

export class UploadError extends Error {
  constructor(message, status) {
    super(message)

    this.name = this.constructor.name

    if (typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(this, this.constructor)
    else this.stack = new Error(message).stack

    if (status) {
      this.status = status
      this.expose = true
    }
  }
}

export class ParseUploadError extends UploadError {}
export class MaxFileSizeUploadError extends UploadError {}
export class MaxFilesUploadError extends UploadError {}
export class MapBeforeOperationsUploadError extends UploadError {}
export class FilesBeforeMapUploadError extends UploadError {}
export class FileMissingUploadError extends UploadError {}
export class DisconnectUploadError extends UploadError {}

/* eslint-enable require-jsdoc */
