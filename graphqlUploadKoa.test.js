'use strict'

const Koa = require('koa')
const fetch = require('node-fetch')
const t = require('tap')
const graphqlUploadKoa = require('./graphqlUploadKoa')
const processRequest = require('./processRequest')
const startServer = require('./test-helpers/startServer')
const testGraphqlMultipartRequest = require('./test-helpers/testGraphqlMultipartRequest')

t.test('‘graphqlUploadKoa’ with a non multipart request.', async t => {
  const app = new Koa().use(
    graphqlUploadKoa({
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
  '‘graphqlUploadKoa’ with a multipart request and the default ‘processRequest’.',
  async t => {
    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ctx.request.body &&
      ctx.request.body.variables &&
      ctx.request.body.variables.file
        ? t.pass('Request was processed.')
        : t.fail('Request wasn’t processed.')

      await next()
    })

    const port = await startServer(t, app)

    await testGraphqlMultipartRequest(port)
  }
)

t.test(
  '‘graphqlUploadKoa’ with a multipart request and a custom ‘processRequest’.',
  async t => {
    const app = new Koa().use(
      graphqlUploadKoa({
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
