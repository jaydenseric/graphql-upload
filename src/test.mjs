import fs from 'fs'
import stream from 'stream'
import http from 'http'
import t from 'tap'
import Koa from 'koa'
import express from 'express'
import fetch from 'node-fetch'
import FormData from 'form-data'
import { ReadStream } from 'fs-capacitor'
import {
  apolloUploadKoa,
  apolloUploadExpress,
  ParseUploadError,
  MaxFileSizeUploadError,
  MaxFilesUploadError,
  MapBeforeOperationsUploadError,
  FilesBeforeMapUploadError,
  FileMissingUploadError,
  DisconnectUploadError
} from '.'

// GraphQL multipart request spec:
// https://github.com/jaydenseric/graphql-multipart-request-spec

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

t.test('Single file.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

    body.append('map', JSON.stringify({ 1: ['variables.file'] }))
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

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    let variables

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        ;({ variables } = request.body)
        t.test('Upload.', uploadTest(request.body.variables.file))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })
})

t.test('Invalid ‘operations’ JSON.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append('operations', '{ variables: { "file": null } }')
    body.append('map', JSON.stringify({ 1: ['variables.file'] }))
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
        t.type(error, ParseUploadError, 'Middleware throws.')
      )
      .use(apolloUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, ParseUploadError, 'Middleware throws.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Invalid ‘map’ JSON.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )
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
        t.type(error, ParseUploadError, 'Middleware throws.')
      )
      .use(apolloUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, ParseUploadError, 'Middleware throws.')

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
      JSON.stringify({
        variables: {
          fileA: null,
          fileB: null
        }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        1: ['variables.fileA'],
        2: ['variables.fileB']
      })
    )
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

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)

      await t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB))

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.fileA
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.fileB
    await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(3)

    let variables

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        ;({ variables } = request.body)

        t.test('Upload B.', uploadBTest(request.body.variables.fileB))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.fileA
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.fileB
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
        JSON.stringify({
          variables: {
            fileA: null,
            fileB: null,
            fileC: null
          }
        })
      )

      body.append(
        'map',
        JSON.stringify({
          1: ['variables.fileA'],
          2: ['variables.fileB'],
          3: ['variables.fileC']
        })
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
    await t.rejects(upload, DisconnectUploadError, 'Rejection error.')
  }

  await t.test('Immediate stream creation.', async t => {
    const uploadATest = (file, stream) => async t => {
      t.matchSnapshot(JSON.stringify(file, null, 2), 'Enumerable properties.')
      t.type(stream, ReadStream, 'Stream type.')
      t.equals(await streamToString(stream), 'a', 'Contents.')
    }

    const uploadBTest = (file, stream) => async t => {
      await new Promise(resolve => {
        stream
          .on('error', error => {
            t.type(error, DisconnectUploadError, 'Stream error.')
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
        .use(apolloUploadKoa())
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
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
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
        .use(apolloUploadExpress())
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
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
    })
  })

  await t.test('Delayed stream creation.', async t => {
    const uploadATest = upload => async t => {
      const { createReadStream } = await upload
      t.throws(
        () => {
          createReadStream()
        },
        DisconnectUploadError,
        'Stream error.'
      )
    }

    const uploadBTest = upload => async t => {
      const { createReadStream } = await upload
      t.throws(
        () => {
          createReadStream()
        },
        DisconnectUploadError,
        'Stream error.'
      )
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
        .use(apolloUploadKoa())
        .use(async (ctx, next) => {
          ;({ variables } = ctx.request.body)

          await new Promise(resolve => setTimeout(resolve, 10))

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
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
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
        .use(apolloUploadExpress())
        .use(async (request, response, next) => {
          ;({ variables } = request.body)
          await new Promise(resolve => setTimeout(resolve, 10))
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
      await new Promise(resolve => fileA.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

      const fileB = await variables.fileB
      await new Promise(resolve => fileB.capacitor.once('close', resolve))
      t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
    })
  })
})

t.test('Deduped files.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          files: [null, null]
        }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        1: ['variables.files.0', 'variables.files.1']
      })
    )

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

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
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
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(7)

    let variables

    const app = express()
      .use(apolloUploadExpress())
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
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })
})

t.test('Missing file.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: { file: null }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        1: ['variables.file']
      })
    )

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await t.rejects(
        ctx.request.body.variables.file,
        FileMissingUploadError,
        'Rejection error.'
      )
      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(1)

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        t.rejects(
          request.body.variables.file,
          FileMissingUploadError,
          'Rejection error.'
        )
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Extraneous file.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        1: ['variables.file']
      })
    )

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

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      ;({ variables } = ctx.request.body)
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))
      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    let variables

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        ;({ variables } = request.body)
        t.test('Upload.', uploadTest(request.body.variables.file))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const file = await variables.file
    await new Promise(resolve => file.capacitor.once('close', resolve))
    t.false(fs.existsSync(file.capacitor.path), 'Cleanup.')
  })
})

t.test('Exceed max files.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          files: [null, null]
        }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        1: ['variables.files.0'],
        2: ['variables.files.1']
      })
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
        t.type(error, MaxFilesUploadError, 'Middleware throws.')
      )
      .use(apolloUploadKoa({ maxFiles: 1 }))

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, MaxFilesUploadError, 'Middleware throws.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Exceed max files with extraneous files interspersed.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          files: [null, null]
        }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        '1': ['variables.files.0'],
        '2': ['variables.files.1']
      })
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
    await t.rejects(upload, MaxFilesUploadError, 'Rejection error.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(3)

    let variables
    let finish

    const finished = new Promise(resolve => (finish = resolve))
    const app = new Koa()
      .use(apolloUploadKoa({ maxFiles: 2 }))
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
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(3)

    let variables

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 2 }))
      .use((request, response, next) => {
        ;({ variables } = request.body)
        Promise.all([
          t.test('Upload A.', uploadATest(request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(request.body.variables.files[1]))
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')
  })
})

t.test('Exceed max file size.', async t => {
  const sendRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          files: [null, null]
        }
      })
    )

    body.append(
      'map',
      JSON.stringify({
        1: ['variables.files.0'],
        2: ['variables.files.1']
      })
    )

    body.append('1', 'aa', { filename: 'a.txt' })
    body.append('2', 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadATest = upload => async t => {
    const { createReadStream } = await upload
    t.throws(() => createReadStream(), MaxFileSizeUploadError, 'Stream error.')
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
      .use(apolloUploadKoa({ maxFileSize: 1 }))
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
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(4)

    let variables

    const app = express()
      .use(apolloUploadExpress({ maxFileSize: 1 }))
      .use((request, response, next) => {
        ;({ variables } = request.body)

        Promise.all([
          t.test('Upload A.', uploadATest(request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(request.body.variables.files[1]))
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await sendRequest(port)

    const fileA = await variables.files[0]
    await new Promise(resolve => fileA.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileA.capacitor.path), 'Cleanup A.')

    const fileB = await variables.files[1]
    await new Promise(resolve => fileB.capacitor.once('close', resolve))
    t.false(fs.existsSync(fileB.capacitor.path), 'Cleanup B.')
  })
})

t.test('Misorder ‘map’ before ‘operations’.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append(
      'map',
      JSON.stringify({
        '1': ['variables.file']
      })
    )

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

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
        t.type(error, MapBeforeOperationsUploadError, 'Middleware throws.')
      )
      .use(apolloUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, MapBeforeOperationsUploadError, 'Middleware throws.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Misorder files before ‘map’.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

    body.append('1', 'a', { filename: 'a.txt' })

    body.append(
      'map',
      JSON.stringify({
        '1': ['variables.file']
      })
    )

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
        t.type(error, FilesBeforeMapUploadError, 'Middleware throws.')
      )
      .use(apolloUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, FilesBeforeMapUploadError, 'Middleware throws.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.todo('Missing ‘map’ and files.', async t => {
  const sendRequest = async (t, port) => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

    const { status } = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      body
    })

    t.equal(status, 400, 'Response status.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', () =>
        // Todo: Test the error.
        t.pass('Error.')
      )
      .use(apolloUploadKoa())

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress())
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        // Todo: Test the error.
        t.pass('Error.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})
