import stream from 'stream'
import http from 'http'
import t from 'tap'
import Koa from 'koa'
import express from 'express'
import fetch from 'node-fetch'
import FormData from 'form-data'
import {
  apolloUploadKoa,
  apolloUploadExpress,
  MaxFileSizeUploadError,
  MaxFilesUploadError,
  MapBeforeOperationsUploadError,
  FilesBeforeMapUploadError,
  FileMissingUploadError,
  UploadPromiseDisconnectUploadError,
  FileStreamDisconnectUploadError
} from '.'

// See: https://github.com/mike-marcacci/fs-capacitor/issues/1
process.setMaxListeners(20)

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

    // In node <= v8, any error passed to `socket.destroy(error)` is
    // written to stderr, which gives a false appearance of errors in
    // these tests. We're simply going to swallow these and reimplement
    // the default behavior:
    // https://github.com/nodejs/node/blob/241aa14d980e1d2bd6c20754b7058dda120c4673/lib/_http_server.js#L470
    if (parseInt(process.versions.node) <= 8)
      server.on('clientError', (error, socket) => {
        socket.destroy()
      })
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
  t.jobs = 2

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
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
    t.deepEquals(
      meta,
      {
        filename: 'a.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))

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
        t.test('Upload.', uploadTest(request.body.variables.file))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Handles unconsumed uploads.', async t => {
  t.jobs = 2

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
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'Contents.')
    t.deepEquals(
      meta,
      {
        filename: 'b.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB))

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
        t.test('Upload B.', uploadBTest(request.body.variables.fileB))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Aborted request.', async t => {
  t.jobs = 2

  const sendRequest = port =>
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
        // Will arrive in multiple chunks as the TCP max packet size is 64KB.
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

            process.nextTick(() => request.abort())

            return
          }

          callback(null, chunk)
        }
      })

      body.pipe(transform).pipe(request)
    })

  const uploadATest = upload => async t => {
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
    t.deepEquals(
      meta,
      {
        filename: 'a.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  const uploadBTest = upload => async t => {
    const { stream } = await upload

    await new Promise(resolve => {
      stream
        .on('error', error => {
          t.type(error, FileStreamDisconnectUploadError, 'Stream error.')
          resolve()
        })
        .on('end', () => {
          t.fail('File shouldn’t fully upload.')
          resolve()
        })
        .resume()
    })
  }

  const uploadCTest = upload => async t => {
    await t.rejects(
      upload,
      UploadPromiseDisconnectUploadError,
      'Rejection error.'
    )
  }

  await t.test('Stream error handled.', async t => {
    await t.test('Koa middleware.', async t => {
      t.plan(3)

      let testsDone
      const pendingTests = new Promise(resolve => (testsDone = resolve))
      const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
        await Promise.all([
          t.test('Upload A.', uploadATest(ctx.request.body.variables.fileA)),
          t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB)),
          t.test('Upload C.', uploadCTest(ctx.request.body.variables.fileC))
        ])
        ctx.status = 204
        await next()
        testsDone()
      })

      const port = await startServer(t, app)

      await sendRequest(port)

      await pendingTests
    })

    await t.todo('Express middleware.', async t => {
      t.plan(3)

      const app = express()
        .use(apolloUploadExpress())
        .use((request, response, next) => {
          Promise.all([
            t.test('Upload A.', uploadATest(request.body.variables.fileA)),
            t.test('Upload B.', uploadBTest(request.body.variables.fileB)),
            t.test('Upload C.', uploadCTest(request.body.variables.fileC))
          ]).then(() => next())
        })

      const port = await startServer(t, app)

      await sendRequest(port)
    })
  })

  await t.todo('Stream error unhandled.', async t => {
    await t.test('Koa middleware.', async t => {
      t.plan(2)

      const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
        await Promise.all([
          t.test('Upload A.', uploadATest(ctx.request.body.variables.fileA)),
          t.test('Upload C.', uploadCTest(ctx.request.body.variables.fileC))
        ])
        ctx.status = 204
        await next()
      })

      const port = await startServer(t, app)

      await sendRequest(port)
    })

    await t.test('Express middleware.', async t => {
      t.plan(2)

      const app = express()
        .use(apolloUploadExpress())
        .use((request, response, next) => {
          Promise.all([
            t.test('Upload A.', uploadATest(request.body.variables.fileA)),
            t.test('Upload C.', uploadCTest(request.body.variables.fileC))
          ]).then(() => next())
        })

      const port = await startServer(t, app)

      await sendRequest(port)
    })
  })
})

t.todo('Deduped files.', async t => {
  t.jobs = 2

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

  const uploadTest = upload => async t => {
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
    t.deepEquals(
      meta,
      {
        filename: 'a.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await Promise.all([
        t.test('Upload A.', uploadTest(ctx.request.body.variables.files[0])),
        t.test('Upload B.', uploadTest(ctx.request.body.variables.files[1]))
      ])

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await sendRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        Promise.all([
          t.test('Upload A.', uploadTest(request.body.variables.files[0])),
          t.test('Upload B.', uploadTest(request.body.variables.files[1]))
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Missing file.', async t => {
  t.jobs = 2

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
  t.jobs = 2

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
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'Contents.')
    t.deepEquals(
      meta,
      {
        filename: 'a.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await t.test('Upload.', uploadTest(ctx.request.body.variables.file))
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
        t.test('Upload.', uploadTest(request.body.variables.file))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Exceed max files.', async t => {
  t.jobs = 2

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
  t.jobs = 2

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
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.deepEquals(
      meta,
      {
        filename: 'a.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  const uploadBTest = upload => async t => {
    await t.rejects(upload, MaxFilesUploadError, 'Rejection error.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .use(apolloUploadKoa({ maxFiles: 2 }))
      .use(async (ctx, next) => {
        await Promise.all([
          t.test('Upload A.', uploadATest(ctx.request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(ctx.request.body.variables.files[1]))
        ])

        ctx.status = 204
        await next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 2 }))
      .use((request, response, next) => {
        Promise.all([
          t.test('Upload A.', uploadATest(request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(request.body.variables.files[1]))
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Exceed max file size.', async t => {
  t.jobs = 2

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
    const { stream } = await upload

    await new Promise((resolve, reject) => {
      stream
        .on('error', error => {
          t.type(error, MaxFileSizeUploadError, 'Stream error.')
          resolve()
        })
        .on('end', reject)
    })
  }

  const uploadBTest = upload => async t => {
    const { stream, ...meta } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'Contents.')
    t.deepEquals(
      meta,
      {
        filename: 'b.txt',
        mimetype: 'text/plain',
        encoding: '7bit'
      },
      'Metadata.'
    )
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .use(apolloUploadKoa({ maxFileSize: 1 }))
      .use(async (ctx, next) => {
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
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFileSize: 1 }))
      .use((request, response, next) => {
        Promise.all([
          t.test('Upload A.', uploadATest(request.body.variables.files[0])),
          t.test('Upload B.', uploadBTest(request.body.variables.files[1]))
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Misorder ‘map’ before ‘operations’.', async t => {
  t.jobs = 2

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
  t.jobs = 2

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
