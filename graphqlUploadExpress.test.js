'use strict'

const express = require('express')
const createError = require('http-errors')
const fetch = require('node-fetch')
const t = require('tap')
const graphqlUploadExpress = require('./graphqlUploadExpress')
const processRequest = require('./processRequest')
const startServer = require('./test-helpers/startServer')
const testGraphqlMultipartRequest = require('./test-helpers/testGraphqlMultipartRequest')

t.test('‘graphqlUploadExpress’ with a non multipart request.', async t => {
  const app = express().use(
    graphqlUploadExpress({
      // eslint-disable-next-line require-await
      async processRequest() {
        t.fail('‘processRequest’ ran.')
      }
    })
  )

  const port = await startServer(t, app)

  await fetch(`http://localhost:${port}`, { method: 'POST' })

  t.pass('‘processRequest’ skipped.')
})

t.test(
  '‘graphqlUploadExpress’ with a multipart request and the default ‘processRequest’.',
  async t => {
    const app = express()
      .use(graphqlUploadExpress())
      .use((request, response, next) => {
        request.body && request.body.variables && request.body.variables.file
          ? t.pass('Request was processed.')
          : t.fail('Request wasn’t processed.')

        next()
      })
    const port = await startServer(t, app)

    await testGraphqlMultipartRequest(port)
  }
)

t.test(
  '‘graphqlUploadExpress’ with a multipart request and a custom ‘processRequest’.',
  async t => {
    const app = express().use(
      graphqlUploadExpress({
        async processRequest(...args) {
          t.pass('‘processRequest’ ran.')
          await processRequest(...args)
        }
      })
    )

    const port = await startServer(t, app)

    await testGraphqlMultipartRequest(port)
  }
)

t.test(
  '‘graphqlUploadExpress’ with ‘processRequest’ throwing a non HTTP error.',
  async t => {
    const app = express()
      .use(
        graphqlUploadExpress({
          async processRequest(...args) {
            await processRequest(...args)
            throw new Error('Test.')
          }
        })
      )
      .use((error, request, response, next) => {
        t.equals(response.statusCode, 200, 'Response status.')
        t.match(
          error,
          {
            name: 'Error',
            message: 'Test.',
            status: undefined,
            statusCode: undefined,
            expose: undefined
          },
          'Express middleware forwarded error.'
        )

        if (response.headersSent) return next(error)
        response.send()
      })

    const port = await startServer(t, app)

    await testGraphqlMultipartRequest(port)
  }
)

t.test(
  '‘graphqlUploadExpress’ with ‘processRequest’ throwing a HTTP error.',
  async t => {
    const app = express()
      .use(
        graphqlUploadExpress({
          async processRequest(...args) {
            await processRequest(...args)
            throw createError(400, 'Test.')
          }
        })
      )
      .use((error, request, response, next) => {
        t.equals(response.statusCode, 400, 'Response status.')
        t.match(
          error,
          {
            name: 'Error',
            message: 'Test.',
            status: 400,
            statusCode: 400,
            expose: true
          },
          'Express middleware forwarded error.'
        )

        if (response.headersSent) return next(error)
        response.send()
      })

    const port = await startServer(t, app)

    await testGraphqlMultipartRequest(port)
  }
)
