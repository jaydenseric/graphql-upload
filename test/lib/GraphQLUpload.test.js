'use strict'

const { throws } = require('assert')
const { parseValue } = require('graphql')
const GraphQLUpload = require('../../lib/GraphQLUpload')

module.exports = tests => {
  tests.add('`GraphQLUpload` scalar `parseLiteral`.', () => {
    throws(
      () => {
        // The dummy value is irrelevant.
        GraphQLUpload.parseLiteral(parseValue('""'))
      },
      {
        name: 'GraphQLError',
        message: 'Upload literal unsupported.',
        locations: [{ line: 1, column: 1 }]
      }
    )
  })

  tests.add('`GraphQLUpload` scalar `serialize`.', () => {
    throws(
      () => {
        // The dummy value is irrelevant.
        GraphQLUpload.serialize('')
      },
      {
        name: 'GraphQLError',
        message: 'Upload serialization unsupported.'
      }
    )
  })
}
