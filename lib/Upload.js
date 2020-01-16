'use strict'

/**
 * An expected file upload.
 * @kind class
 * @name Upload
 * @ignore
 */
module.exports = class Upload {
  constructor() {
    /**
     * Promise that resolves file upload details.
     * @kind member
     * @name Upload#promise
     * @type {Promise<FileUpload>}
     * @ignore
     */
    this.promise = new Promise((resolve, reject) => {
      /**
       * Resolves the upload promise with the file upload details.
       * @kind function
       * @name Upload#resolve
       * @param {FileUpload} file File upload details.
       * @ignore
       */
      this.resolve = file => {
        this.file = file
        resolve(file)
      }

      /**
       * Rejects the upload promise with an error.
       * @kind function
       * @name Upload#reject
       * @param {object} error Error instance.
       * @ignore
       */
      this.reject = reject
    })

    // Prevent errors crashing Node.js, see:
    // https://github.com/nodejs/node/issues/20392
    this.promise.catch(() => {})
  }
}
