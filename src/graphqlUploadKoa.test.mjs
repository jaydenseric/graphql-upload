import Koa from 'koa'
import fetch from 'node-fetch'
import t from 'tap'
import { graphqlUploadKoa } from './graphqlUploadKoa'
import { processRequest } from './processRequest'
import { startServer } from './test-helpers/startServer'
import { testGraphqlMultipartRequest } from './test-helpers/testGraphqlMultipartRequest'

t.test('‘graphqlUploadKoa’ with a non multipart request.', async t => {
  const app = new Koa().use(
    graphqlUploadKoa({
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
