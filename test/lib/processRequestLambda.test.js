'use strict'

const { ok, strictEqual } = require('assert')
const FormData = require('form-data')
const { ReadStream } = require('fs-capacitor')
const Upload = require('../../lib/Upload')
const processRequestLambda = require('../../lib/processRequestLambda')
const streamToString = require('../streamToString')

module.exports = tests => {
  tests.add(
    '`processRequestLambda` with a single file and default `createReadStream` options.',
    async () => {
      const body = new FormData()

      body.append('operations', JSON.stringify({ variables: { file: null } }))
      body.append('map', JSON.stringify({ '1': ['variables.file'] }))
      body.append('1', 'a', { filename: 'a.txt' })

      const headers = body.getHeaders()
      const values = body.getBuffer().toString()

      // Create a fake Lambda event
      const event = {
        body: values,
        headers
      }

      const operation = await processRequestLambda(event)

      ok(operation.variables.file instanceof Upload)

      const upload = await operation.variables.file.promise

      strictEqual(upload.filename, 'a.txt')
      strictEqual(upload.mimetype, 'text/plain')
      strictEqual(upload.encoding, '7bit')

      const stream = upload.createReadStream()

      ok(stream instanceof ReadStream)
      strictEqual(stream._readableState.encoding, null)
      strictEqual(stream.readableHighWaterMark, 16384)
      strictEqual(await streamToString(stream), 'a')
    }
  )
}
