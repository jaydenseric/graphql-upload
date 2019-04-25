import fs from 'fs'
import http from 'http'
import stream from 'stream'
import express from 'express'
import FormData from 'form-data'
import { ReadStream } from 'fs-capacitor'
import Koa from 'koa'
import fetch from 'node-fetch'
import t from 'tap'
import { graphqlUploadKoa, graphqlUploadExpress } from '.'

// eslint-disable-next-line no-console
console.log(
  `Testing ${
    process.execArgv.includes('--experimental-modules') ? 'ESM' : 'CJS'
  } library with ${process.env.NODE_ENV} NODE_ENV…\n\n`
)

/**
 * Asynchronously starts a server and automatically closes it when the given
 * test tears down.
 * @kind function
 * @name startServer
 * @param {Test} t Tap test.
 * @param {Object} app A Koa or Express app.
 * @returns {Promise<number>} The port the server is listening on.
 * @ignore
 */
const startServer = (t, app) =>
  new Promise((resolve, reject) => {
    const server = app.listen(undefined, 'localhost', function(error) {
      if (error) reject(error)
      else {
        t.tearDown(() => this.close())
        resolve(this.address().port)
      }
    })

    // Node.js < v9 writes errors passed to `socket.destroy(error)` to stderr:
    // https://github.com/nodejs/node/blob/v8.11.3/lib/_http_server.js#L470.
    // In aborted upload tests this output may be mistaken for an issue.
    if (parseInt(process.versions.node) <= 8)
      // Swallow errors and reimplement default behavior.
      server.on('clientError', (error, socket) => socket.destroy())
  })

/**
 * Converts a readable stream to a string.
 * @kind function
 * @name streamToString
 * @param {ReadableStream} stream Readable stream.
 * @returns {Promise<string>} A string promise.
 * @ignore
 */
const streamToString = stream =>
  new Promise((resolve, reject) => {
    let data = ''
    stream
      .on('error', reject)
      .on('data', chunk => {
        data += chunk
      })
      .on('end', () => resolve(data))
  })

/**
 * Snapshots an error.
 * @param {Object} error An error.
 * @returns {string} Error snapshot.
 */
const snapshotError = ({ name, message, status, statusCode, expose }) =>
  JSON.stringify({ name, message, status, statusCode, expose }, null, 2)

/* eslint-disable require-jsdoc */

t.test('Single file.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ "1": ["variables.file"] }')
    body.append('1', 'a', { filename: 'a.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    let variables

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    if (!file.capacitor.closed)
      await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    let variables

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        ;({ variables } = request.body)

        try {
          await t.test('Upload.', uploadTest(request.body.variables.file))
          next()
        } catch (error) {
          next(error)
        }
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    if (!file.capacitor.closed)
      await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })
})

t.test('Single file batched.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      '[{ "variables": { "file": null } }, { "variables": { "file": null } }]'
    )
    body.append(
      'map',
      '{ "1": ["0.variables.file"], "2": ["1.variables.file"] }'
    )
    body.append('1', 'a', { filename: 'a.txt' })
    body.append('2', 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadATest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
  }

  const uploadBTest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(4)

    let operations

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      operations = ctx.request.body

      await Promise.all([
        t.test('Upload A.', uploadATest(ctx.request.body[0].variables.file)),
        t.test('Upload B.', uploadBTest(ctx.request.body[1].variables.file))
      ])

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await operations[0].variables.file
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await operations[1].variables.file
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(4)

    let operations

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        operations = request.body

        try {
          await Promise.all([
            t.test('Upload A.', uploadATest(request.body[0].variables.file)),
            t.test('Upload B.', uploadBTest(request.body[1].variables.file))
          ])
          next()
        } catch (error) {
          next(error)
        }
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await operations[0].variables.file
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await operations[1].variables.file
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })
})

t.test('Invalid ‘operations’ JSON.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ variables: { "file": null } }')
    body.append('map', '{ "1": ["variables.file"] }')

    // We need at least one of these “immediate” failures to have a request body
    // larger than node’s internal stream buffer, so that we can test stream
    // resumption.
    // See: https://github.com/jaydenseric/graphql-upload/issues/123
    body.append('1', 'a'.repeat(70000), { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Invalid ‘operations’ type.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', 'null')
    body.append('map', '{ "1": ["variables.file"] }')

    // We need at least one of these “immediate” failures to have a request body
    // larger than node’s internal stream buffer, so that we can test stream
    // resumption.
    // See: https://github.com/jaydenseric/graphql-upload/issues/123
    body.append('1', 'a'.repeat(70000), { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Invalid ‘map’ JSON.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ 1: ["variables.file"] }')
    body.append('1', 'a', { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Invalid ‘map’ type.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', 'null')
    body.append('1', 'a', { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Invalid ‘map’ entry type.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ "1": null }')
    body.append('1', 'a', { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Invalid ‘map’ entry array item type.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ "1": [null] }')
    body.append('1', 'a', { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Handles unconsumed uploads.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      '{ "variables": { "fileA": null, "fileB": null } }'
    )
    body.append('map', '{ "1": ["variables.fileA"], "2": ["variables.fileB"] }')
    body.append('1', 'a', { filename: 'a.txt' })
    body.append('2', 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadBTest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(3)

    let variables

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)

      await t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB))

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.fileA
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.fileB
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(3)

    let variables

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        ;({ variables } = request.body)

        try {
          await t.test('Upload B.', uploadBTest(request.body.variables.fileB))
          next()
        } catch (error) {
          next(error)
        }
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.fileA
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.fileB
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })
})

t.test('Aborted request.', async t => {
  const sendRequest = (port, requestHasBeenReceived) =>
    new Promise((resolve, reject) => {
      const body = new FormData()

      body.append(
        'operations',
        '{ "variables": { "fileA": null, "fileB": null, "fileC": null } }'
      )
      body.append(
        'map',
        '{ "1": ["variables.fileA"], "2": ["variables.fileB"], "3": ["variables.fileC"] }'
      )
      body.append('1', 'a', { filename: 'a.txt' })
      body.append(
        '2',
        // Will arrive in multiple chunks as the TCP max packet size is 64000
        // bytes and the default Node.js fs stream buffer is 65536 bytes.
        `${'1'.repeat(70000)}⛔${'2'.repeat(10)}`,
        { filename: 'b.txt' }
      )
      body.append('3', 'c', { filename: 'c.txt' })

      const request = http.request({
        method: 'POST',
        host: 'localhost',
        port,
        headers: body.getHeaders()
      })

      request.on('error', error => {
        // Error expected when the connection is aborted.
        if (error.code !== 'ECONNRESET') reject(error)
      })

      // This may happen before all middleware has run.
      request.on('close', resolve)

      const transform = new stream.Transform({
        transform(chunk, encoding, callback) {
          if (this._aborted) return

          const chunkString = chunk.toString('utf8')
          const chunkAbortIndex = chunkString.indexOf('⛔')

          // Check if the chunk has the abort marker character ‘⛔’ in it.
          if (chunkAbortIndex !== -1) {
            this._aborted = true

            if (chunkAbortIndex !== 0)
              // Send partial chunk before abort.
              callback(null, chunkString.substr(0, chunkAbortIndex))

            setImmediate(async () => {
              await requestHasBeenReceived
              request.abort()
            })

            return
          }

          callback(null, chunk)
        }
      })

      body.pipe(transform).pipe(request)
    })

  const uploadCTest = upload => async t => {
    try {
      await upload
      t.fail('No rejection error.')
    } catch (error) {
      t.matchSnapshot(snapshotError(error), 'Rejection error.')
    }
  }

  await t.test('Immediate stream creation.', async t => {
    const uploadATest = (file, stream) => async t => {
      t.matchSnapshot(JSON.stringify(file, null, 2), 'Enumerable properties.')
      t.type(stream, ReadStream, 'Stream type.')
      t.equals(await streamToString(stream), 'a', 'Contents.')
    }

    const uploadBTest = (file, stream) => async t => {
      await new Promise(resolve => {
        if (stream.error) {
          t.matchSnapshot(snapshotError(stream.error), 'Stream error.')
          resolve()
          return
        }

        if (stream.ended) {
          t.fail('File shouldn’t fully upload.')
          resolve()
          return
        }

        stream
          .on('error', error => {
            t.matchSnapshot(snapshotError(error), 'Stream error.')
            resolve()
          })
          .on('end', () => {
            t.fail('File shouldn’t fully upload.')
            resolve()
          })
          .resume()
      })
    }

    await t.test('Koa middleware.', async t => {
      t.plan(5)

      let requestHasBeenReceived
      const requestHasBeenReceivedPromise = new Promise(
        resolve => (requestHasBeenReceived = resolve)
      )

      let variables
      let finish

      const finished = new Promise(resolve => (finish = resolve))
      const app = new Koa()
        .use(async (ctx, next) => {
          requestHasBeenReceived()
          await next()
        })
        .use(graphqlUploadKoa())
        .use(async (ctx, next) => {
          ;({ variables } = ctx.request.body)

          const fileA = await ctx.request.body.variables.fileA
          const fileB = await ctx.request.body.variables.fileB

          const streamA = fileA.createReadStream()
          const streamB = fileB.createReadStream()

          await Promise.all([
            t.test('Upload A.', uploadATest(fileA, streamA)),
            t.test('Upload B.', uploadBTest(fileB, streamB)),
            t.test('Upload C.', uploadCTest(ctx.request.body.variables.fileC))
          ])

          ctx.status = 204
          await next()
          finish()
        })
      const port = await startServer(t, app)
      await sendRequest(port, requestHasBeenReceivedPromise)
      await finished

      const fileA = await variables.fileA
      if (!fileA.capacitor.closed)
        await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
      if (!fileB.capacitor.closed)
        await new Promise(resolve => fileB.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
    })

    await t.test('Express middleware.', async t => {
      t.plan(5)

      let requestHasBeenReceived
      const requestHasBeenReceivedPromise = new Promise(
        resolve => (requestHasBeenReceived = resolve)
      )

      let variables
      let finish

      const finished = new Promise(resolve => (finish = resolve))
      const app = express()
        .use((request, response, next) => {
          requestHasBeenReceived()
          next()
        })
        .use(graphqlUploadExpress())
        .use(async (request, response, next) => {
          ;({ variables } = request.body)

          const fileA = await request.body.variables.fileA
          const fileB = await request.body.variables.fileB

          const streamA = fileA.createReadStream()
          const streamB = fileB.createReadStream()

          await Promise.all([
            t.test('Upload A.', uploadATest(fileA, streamA)),
            t.test('Upload B.', uploadBTest(fileB, streamB)),
            t.test('Upload C.', uploadCTest(request.body.variables.fileC))
          ])

          finish()
          next()
        })
      const port = await startServer(t, app)
      await sendRequest(port, requestHasBeenReceivedPromise)
      await finished

      const fileA = await variables.fileA
      if (!fileA.capacitor.closed)
        await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
      if (!fileB.capacitor.closed)
        await new Promise(resolve => fileB.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
    })
  })

  await t.test('Delayed stream creation.', async t => {
    const uploadATest = upload => async t => {
      const { createReadStream } = await upload
      try {
        createReadStream()
        t.fail('No stream error.')
      } catch (error) {
        t.matchSnapshot(snapshotError(error), 'Stream error.')
      }
    }

    const uploadBTest = upload => async t => {
      const { createReadStream } = await upload
      try {
        createReadStream()
        t.fail('No stream error.')
      } catch (error) {
        t.matchSnapshot(snapshotError(error), 'Stream error.')
      }
    }

    await t.test('Koa middleware.', async t => {
      t.plan(5)

      let requestHasBeenReceived
      const requestHasBeenReceivedPromise = new Promise(
        resolve => (requestHasBeenReceived = resolve)
      )

      let variables
      let finish

      const finished = new Promise(resolve => (finish = resolve))
      const app = new Koa()
        .use(async (ctx, next) => {
          requestHasBeenReceived()
          await next()
        })
        .use(graphqlUploadKoa())
        .use(async (ctx, next) => {
          ;({ variables } = ctx.request.body)

          // This ensures that the upload has streamed in as far as it will, and
          // the parser has been detached.
          await new Promise(resolve => {
            const interval = setInterval(() => {
              if (!ctx.req.listeners('data').length) {
                clearInterval(interval)
                resolve()
              }
            }, 1)
          })

          await Promise.all([
            t.test('Upload A.', uploadATest(ctx.request.body.variables.fileA)),
            t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB)),
            t.test('Upload C.', uploadCTest(ctx.request.body.variables.fileC))
          ])

          ctx.status = 204
          await next()
          finish()
        })

      const port = await startServer(t, app)
      await sendRequest(port, requestHasBeenReceivedPromise)
      await finished

      const fileA = await variables.fileA
      if (!fileA.capacitor.closed)
        await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
      if (!fileB.capacitor.closed)
        await new Promise(resolve => fileB.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
    })

    await t.test('Express middleware.', async t => {
      t.plan(5)

      let requestHasBeenReceived
      const requestHasBeenReceivedPromise = new Promise(
        resolve => (requestHasBeenReceived = resolve)
      )

      let variables
      let finish

      const finished = new Promise(resolve => (finish = resolve))
      const app = express()
        .use((request, response, next) => {
          requestHasBeenReceived()
          next()
        })
        .use(graphqlUploadExpress())
        .use(async (request, response, next) => {
          ;({ variables } = request.body)

          // This ensures that the upload has streamed in as far as it will, and
          // the parser has been detached.
          await new Promise(resolve => {
            const interval = setInterval(() => {
              if (!request.listeners('data').length) {
                clearInterval(interval)
                resolve()
              }
            }, 1)
          })

          await Promise.all([
            t.test('Upload A.', uploadATest(request.body.variables.fileA)),
            t.test('Upload B.', uploadBTest(request.body.variables.fileB)),
            t.test('Upload C.', uploadCTest(request.body.variables.fileC))
          ])
          finish()
          next()
        })
      const port = await startServer(t, app)
      await sendRequest(port, requestHasBeenReceivedPromise)
      await finished

      const fileA = await variables.fileA
      if (!fileA.capacitor.closed)
        await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
      if (!fileB.capacitor.closed)
        await new Promise(resolve => fileB.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
    })
  })
})

t.test('Deduped files.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "files": [null, null] } }')
    body.append('map', '{ "1": ["variables.files.0", "variables.files.1"] }')
    body.append('1', 'a', { filename: 'a.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = (file, stream) => async t => {
    t.matchSnapshot(JSON.stringify(file, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(7)

    let variables

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)

      t.strictSame(
        ctx.request.body.variables.files[0],
        ctx.request.body.variables.files[1],
        'Same promise.'
      )

      const [file1, file2] = await Promise.all([
        ctx.request.body.variables.files[0],
        ctx.request.body.variables.files[1]
      ])

      t.strictSame(file1, file2, 'Same file.')

      const stream1 = file1.createReadStream()
      const stream2 = file2.createReadStream()

      t.strictNotSame(stream1, stream2, 'Different streams.')

      await Promise.all([
        t.test('Upload A.', uploadTest(file1, stream1)),
        t.test('Upload B.', uploadTest(file2, stream2))
      ])

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(7)

    let variables

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        ;({ variables } = request.body)
        t.strictSame(
          request.body.variables.files[0],
          request.body.variables.files[1],
          'Same promise.'
        )

        const [file1, file2] = await Promise.all([
          request.body.variables.files[0],
          request.body.variables.files[1]
        ])
        t.strictSame(file1, file2, 'Same file.')

        const stream1 = file1.createReadStream()
        const stream2 = file2.createReadStream()
        t.strictNotSame(stream1, stream2, 'Different streams.')

        await Promise.all([
          t.test('Upload A.', uploadTest(file1, stream1)),
          t.test('Upload B.', uploadTest(file2, stream2))
        ])

        next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })
})

t.test('Missing file.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ "1": ["variables.file"] }')

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      try {
        await ctx.request.body.variables.file
        t.fail('No rejection error.')
      } catch (error) {
        t.matchSnapshot(snapshotError(error), 'Rejection error.')
      }

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(1)

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        try {
          await request.body.variables.file
          t.fail('No rejection error.')
        } catch (error) {
          t.matchSnapshot(snapshotError(error), 'Rejection error.')
        }

        next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Extraneous file.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ "1": ["variables.file"] }')
    body.append('1', 'a', { filename: 'a.txt' })
    body.append('2', 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    let variables

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))
      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    if (!file.capacitor.closed)
      await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    let variables

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        ;({ variables } = request.body)

        try {
          await t.test('Upload.', uploadTest(request.body.variables.file))
          next()
        } catch (error) {
          next(error)
        }
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    if (!file.capacitor.closed)
      await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })
})

t.test('Exceed max files.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "files": [null, null] } }')
    body.append(
      'map',
      '{ "1": ["variables.files.0"], "2": ["variables.files.1"] }'
    )
    body.append('1', 'a', { filename: 'a.txt' })
    body.append('2', 'b', { filename: 'b.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 413, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa({ maxFiles: 1 }))

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Exceed max files with extraneous files interspersed.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "files": [null, null] } }')
    body.append(
      'map',
      '{ "1": ["variables.files.0"], "2": ["variables.files.1"] }'
    )
    body.append('1', 'a', { filename: 'a.txt' })
    body.append('extraneous', 'b', { filename: 'b.txt' })
    body.append('2', 'c', { filename: 'c.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadATest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
  }

  const uploadBTest = upload => async t => {
    try {
      await upload
      t.fail('No rejection error.')
    } catch (error) {
      t.matchSnapshot(snapshotError(error), 'Rejection error.')
    }
  }

  await t.test('Koa middleware.', async t => {
    t.plan(3)

    let variables
    let finish

    const finished = new Promise(resolve => (finish = resolve))
    const app = new Koa()
      .use(graphqlUploadKoa({ maxFiles: 2 }))
      .use(async (ctx, next) => {
        ;({ variables } = ctx.request.body)

        await Promise.all([
          t.test('Upload A.', uploadATest(ctx.request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(ctx.request.body.variables.files[1]))
        ])

        ctx.status = 204
        await next()
        finish()
      })

    const port = await startServer(t, app)

    await sendRequest(port)
    await finished

    const fileA = await variables.files[0]
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(3)

    let variables

    const app = express()
      .use(graphqlUploadExpress({ maxFiles: 2 }))
      .use(async (request, response, next) => {
        ;({ variables } = request.body)

        await Promise.all([
          t.test('Upload A.', uploadATest(request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(request.body.variables.files[1]))
        ])

        next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')
  })
})

t.test('Exceed max file size.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "files": [null, null] } }')
    body.append(
      'map',
      '{ "1": ["variables.files.0"], "2": ["variables.files.1"] }'
    )
    body.append('1', 'aa', { filename: 'a.txt' })
    body.append('2', 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadATest = upload => async t => {
    const { createReadStream } = await upload
    try {
      createReadStream()
      t.fail('No stream error.')
    } catch (error) {
      t.matchSnapshot(snapshotError(error), 'Stream error.')
    }
  }

  const uploadBTest = upload => async t => {
    const resolved = await upload
    const stream = resolved.createReadStream()

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')
    t.type(stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(4)

    let variables

    const app = new Koa()
      .use(graphqlUploadKoa({ maxFileSize: 1 }))
      .use(async (ctx, next) => {
        ;({ variables } = ctx.request.body)
        await t.test(
          'Upload A.',
          uploadATest(ctx.request.body.variables.files[0])
        )

        await t.test(
          'Upload B.',
          uploadBTest(ctx.request.body.variables.files[1])
        )

        ctx.status = 204
        await next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(4)

    let variables

    const app = express()
      .use(graphqlUploadExpress({ maxFileSize: 1 }))
      .use(async (request, response, next) => {
        ;({ variables } = request.body)

        await Promise.all([
          t.test('Upload A.', uploadATest(request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(request.body.variables.files[1]))
        ])

        next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    if (!fileA.capacitor.closed)
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    if (!fileB.capacitor.closed)
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })
})

t.test('Misorder ‘map’ before ‘operations’.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('map', '{ "1": ["variables.file"] }')
    body.append('operations', '{ "variables": { "file": null } }')
    body.append('1', 'a', { filename: 'a.txt' })

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Misorder files before ‘map’.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('1', 'a', { filename: 'a.txt' })
    body.append('map', '{ "1": ["variables.file"] }')

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Missing ‘map’ and files.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Missing ‘operations’, ‘map’ and files.', async t => {
  const sendRequest = async (t, port) => {
    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body: new FormData()
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
      )
      .use(graphqlUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(graphqlUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)
        t.matchSnapshot(snapshotError(error), 'Middleware throws.')
        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Deprecated file upload ‘stream’ property.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append('operations', '{ "variables": { "file": null } }')
    body.append('map', '{ "1": ["variables.file"] }')
    body.append('1', 'a', { filename: 'a.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = upload => async t => {
    const resolved = await upload

    // Store the original process deprecation mode.
    const { throwDeprecation } = process

    // Allow deprecation warning to be tested.
    process.throwDeprecation = true

    try {
      resolved.stream
      t.fail('No deprecation warning.')
    } catch (error) {
      t.matchSnapshot(snapshotError(error), 'Deprecation warning.')
    }

    // Restore process deprecation mode. The warning won't appear again as
    // Node.js only displays it once per process.
    process.throwDeprecation = throwDeprecation

    t.matchSnapshot(JSON.stringify(resolved, null, 2), 'Enumerable properties.')

    t.true(
      resolved.stream === resolved.stream,
      'Accessing ‘stream’ multiple times gets the same stream.'
    )
    t.type(resolved.stream, ReadStream, 'Stream type.')
    t.equals(await streamToString(resolved.stream), 'a', 'Contents.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    let variables

    const app = new Koa().use(graphqlUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    if (!file.capacitor.closed)
      await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    let variables

    const app = express()
      .use(graphqlUploadExpress())
      .use(async (request, response, next) => {
        ;({ variables } = request.body)

        try {
          await t.test('Upload.', uploadTest(request.body.variables.file))
          next()
        } catch (error) {
          next(error)
        }
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    if (!file.capacitor.closed)
      await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })
})
