'use strict'

const { deepStrictEqual, ok, strictEqual } = require('assert')
const FormData = require('form-data')
const createError = require('http-errors')
const Koa = require('koa')
const fetch = require('node-fetch')
const graphqlUploadKoa = require('../../lib/graphqlUploadKoa')
const processRequest = require('../../lib/processRequest')
const listen = require('../listen')

module.exports = tests => {
  tests.add('`graphqlUploadKoa` with a non multipart request.', async () => {
    let processRequestRan = false

    const app = new Koa().use(
      graphqlUploadKoa({
        async processRequest() {
          processRequestRan = true
        }
      })
    )

    const { port, close } = await listen(app)

    try {
      await fetch(`http://localhost:${port}`, { method: 'POST' })
      strictEqual(processRequestRan, false)
    } finally {
      close()
    }
  })

  tests.add('`graphqlUploadKoa` with a multipart request.', async () => {
    let ctxRequestBody

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ctxRequestBody = ctx.request.body
      await next()
    })

    const { port, close } = await listen(app)

    try {
      const body = new FormData()

      body.append('operations', JSON.stringify({ variables: { file: null } }))
      body.append('map', JSON.stringify({ '1': ['variables.file'] }))
      body.append('1', 'a', { filename: 'a.txt' })

      await fetch(`http://localhost:${port}`, { method: 'POST', body })

      ok(ctxRequestBody)
      ok(ctxRequestBody.variables)
      ok(ctxRequestBody.variables.file)
    } finally {
      close()
    }
  })

  tests.add(
    '`graphqlUploadKoa` with option `processRequest` and a multipart request.',
    async () => {
      let processRequestRan = false
      let ctxRequestBody

      const app = new Koa()
        .use(
          graphqlUploadKoa({
            processRequest(...args) {
              processRequestRan = true
              return processRequest(...args)
            }
          })
        )
        .use(async (ctx, next) => {
          ctxRequestBody = ctx.request.body
          await next()
        })

      const { port, close } = await listen(app)

      try {
        const body = new FormData()

        body.append('operations', JSON.stringify({ variables: { file: null } }))
        body.append('map', JSON.stringify({ '1': ['variables.file'] }))
        body.append('1', 'a', { filename: 'a.txt' })

        await fetch(`http://localhost:${port}`, { method: 'POST', body })

        strictEqual(processRequestRan, true)
        ok(ctxRequestBody)
        ok(ctxRequestBody.variables)
        ok(ctxRequestBody.variables.file)
      } finally {
        close()
      }
    }
  )

  tests.add(
    '`graphqlUploadKoa` with option `processRequest`, a multipart request, and an exposed error.',
    async () => {
      let koaError

      const error = createError(400, 'Message.')
      const app = new Koa()
        .on('error', error => {
          koaError = error
        })
        .use(
          graphqlUploadKoa({
            async processRequest(request) {
              request.resume()
              throw error
            }
          })
        )

      const { port, close } = await listen(app)

      try {
        const body = new FormData()

        body.append('operations', JSON.stringify({ variables: { file: null } }))
        body.append('map', JSON.stringify({ '1': ['variables.file'] }))
        body.append('1', 'a', { filename: 'a.txt' })

        await fetch(`http://localhost:${port}`, {
          method: 'POST',
          body
        })

        deepStrictEqual(koaError, error)
      } finally {
        close()
      }
    }
  )
}
