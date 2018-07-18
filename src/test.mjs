import fs from 'fs'
import stream from 'stream'
import path from 'path'
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

// GraphQL multipart request spec:
// https://github.com/jaydenseric/graphql-multipart-request-spec

// Will arrive in multiple chunks as the TCP max packet size is 64KB.
const TEST_FILE_PATH = 'test-file.txt'

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
      .on('end', () => {
        resolve(data)
      })
  })

const uploadTest = (upload, filePath = TEST_FILE_PATH) => async t => {
  const { stream, filename, mimetype, encoding } = await upload

  t.type(stream, 'Capacitor', 'Stream.')
  t.equals(filename, path.basename(filePath), 'Filename.')
  t.equals(mimetype, 'text/plain', 'MIME type.')
  t.equals(encoding, '7bit', 'Encoding.')

  await new Promise((resolve, reject) => {
    let size = 0
    stream
      .on('error', reject)
      .on('data', chunk => (size += chunk.length))
      .on('end', () => {
        t.equals(size, fs.statSync(filePath).size, 'Bytes.')
        resolve()
      })
  })
}

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
    body.append(1, 'a', { filename: 'a.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = upload => async t => {
    const { stream, filename, mimetype, encoding } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'File contents.')
    t.equals(filename, 'a.txt', 'File name.')
    t.equals(mimetype, 'text/plain', 'MIME type.')
    t.equals(encoding, '7bit', 'Encoding.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await t.test(
        'Upload resolves.',
        uploadTest(ctx.request.body.variables.file)
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
        t.test('Upload resolves.', uploadTest(request.body.variables.file))
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
    body.append(1, 'a', { filename: 'a.txt' })
    body.append(2, 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadBTest = upload => async t => {
    const { stream, filename, mimetype, encoding } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'File contents.')
    t.equals(filename, 'b.txt', 'File name.')
    t.equals(mimetype, 'text/plain', 'MIME type.')
    t.equals(encoding, '7bit', 'Encoding.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB))

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await Promise.race([
      sendRequest(port),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('The request did not complete.'))
        }, 500)
      })
    ])
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

    await Promise.race([
      sendRequest(port),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('The request did not complete.'))
        }, 500)
      })
    ])
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

      body.append(1, fs.createReadStream(TEST_FILE_PATH))
      body.append(
        2,
        // Will arrive in multiple chunks as the TCP max packet size is 64KB.
        `${'b'.repeat(100000)}end`,
        { filename: 'b.txt' }
      )
      body.append(3, 'c', { filename: 'c.txt' })

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

      // This may emit before downstream middleware has been processed.
      request.on('close', resolve)

      let data = ''
      const transform = new stream.Transform({
        transform(chunk, encoding, callback) {
          if (this._aborted) return

          const chunkString = chunk.toString('utf8')

          data += chunkString

          if ((data.match(/end/g) || []).length === 2) {
            this._aborted = true

            // Pipe how much of this chunk to the request before aborting?
            const length =
              chunkString.length - (data.length - data.lastIndexOf('end'))

            if (length < 1) {
              // Abort now.
              request.abort()
              return
            }

            // Send partial chunk and then abort.
            callback(null, chunkString.substr(0, length))
            setImmediate(() => request.abort())
            return
          }

          callback(null, chunk)
        }
      })

      body.pipe(transform).pipe(request)
    })

  const uploadBTest = upload => async t => {
    const { stream } = await upload
    return new Promise((resolve, reject) => {
      stream
        .on('error', error => {
          t.type(error, FileStreamDisconnectUploadError, 'Stream error.')
          resolve()
        })
        .on('end', reject)
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
      let resume
      const delay = new Promise(resolve => (resume = resolve))
      const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
        try {
          await Promise.all([
            t.test('Upload A.', uploadTest(ctx.request.body.variables.fileA)),
            t.test('Upload B.', uploadBTest(ctx.request.body.variables.fileB)),
            t.test('Upload C.', uploadCTest(ctx.request.body.variables.fileC))
          ])
        } finally {
          resume()
        }

        ctx.status = 204
        await next()
      })
      const port = await startServer(t, app)
      await sendRequest(port)
      await delay
    })

    await t.test('Express middleware.', async t => {
      let resume
      const delay = new Promise(resolve => (resume = resolve))
      const app = express()
        .use(apolloUploadExpress())
        .use((request, response, next) => {
          Promise.all([
            t.test('Upload A.', uploadTest(request.body.variables.fileA)),
            t.test('Upload B.', uploadBTest(request.body.variables.fileB)),
            t.test('Upload C.', uploadCTest(request.body.variables.fileC))
          ])
            .then(() => {
              resume()
              next()
            })
            .catch(error => {
              resume()
              next(error)
            })
        })

      const port = await startServer(t, app)

      await sendRequest(port)
      await delay
    })
  })

  await t.test('Stream error unhandled.', async t => {
    await t.test('Koa middleware.', async t => {
      let resume
      const delay = new Promise(resolve => (resume = resolve))
      const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
        try {
          await Promise.all([
            t.test('Upload A.', uploadTest(ctx.request.body.variables.fileA)),
            t.test('Upload C.', uploadCTest(ctx.request.body.variables.fileC))
          ])
        } finally {
          resume()
        }

        ctx.status = 204
        await next()
      })

      const port = await startServer(t, app)

      await sendRequest(port)
      await delay
    })

    await t.test('Express middleware.', async t => {
      let resume
      const delay = new Promise(resolve => (resume = resolve))
      const app = express()
        .use(apolloUploadExpress())
        .use((request, response, next) => {
          Promise.all([
            t.test('Upload A.', uploadTest(request.body.variables.fileA)),
            t.test('Upload C.', uploadCTest(request.body.variables.fileC))
          ])
            .then(() => {
              resume()
              next()
            })
            .catch(error => {
              resume()
              next(error)
            })
        })

      const port = await startServer(t, app)

      await sendRequest(port)
      await delay
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

    body.append(1, 'a', { filename: 'a.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = upload => async t => {
    const { stream, filename, mimetype, encoding } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'File contents.')
    t.equals(filename, 'a.txt', 'File name.')
    t.equals(mimetype, 'text/plain', 'MIME type.')
    t.equals(encoding, '7bit', 'Encoding.')
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

    body.append(1, 'a', { filename: 'a.txt' })
    body.append(2, 'b', { filename: 'b.txt' })

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  const uploadTest = upload => async t => {
    const { stream, filename, mimetype, encoding } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'a', 'File contents.')
    t.equals(filename, 'a.txt', 'File name.')
    t.equals(mimetype, 'text/plain', 'MIME type.')
    t.equals(encoding, '7bit', 'Encoding.')
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
        t.test('Upload resolves.', uploadTest(request.body.variables.file))
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

    body.append(1, 'a', { filename: 'a.txt' })
    body.append(2, 'b', { filename: 'b.txt' })

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

    body.append('1', fs.createReadStream(TEST_FILE_PATH))
    body.append('extraneous', fs.createReadStream(TEST_FILE_PATH))
    body.append('2', fs.createReadStream(TEST_FILE_PATH))

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
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
          t.test('Upload A.', uploadTest(ctx.request.body.variables.files[0])),
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
          t.test('Upload A.', uploadTest(request.body.variables.files[0])),
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

    body.append(1, 'aa', { filename: 'a.txt' })
    body.append(2, 'b', { filename: 'b.txt' })

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
    const { stream, filename, mimetype, encoding } = await upload

    t.type(stream, 'Capacitor', 'Stream type.')
    t.equals(await streamToString(stream), 'b', 'File contents.')
    t.equals(filename, 'b.txt', 'File name.')
    t.equals(mimetype, 'text/plain', 'MIME type.')
    t.equals(encoding, '7bit', 'Encoding.')
  }

  await t.test('Koa middleware.', async t => {
    t.plan(1)

    const app = new Koa()
      .use(apolloUploadKoa({ maxFileSize: 1 }))
      .use(async (ctx, next) => {
        await t.test('Upload resolves.', async t => {
          await t.test(
            'Upload A.',
            uploadATest(ctx.request.body.variables.files[0])
          )

          await t.test(
            'Upload B.',
            uploadBTest(ctx.request.body.variables.files[1])
          )
        })

        ctx.status = 204
        await next()
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(1)

    const app = express()
      .use(apolloUploadExpress({ maxFileSize: 1 }))
      .use((request, response, next) => {
        t.test('Upload resolves.', async t => {
          await t.test(
            'Upload A.',
            uploadATest(request.body.variables.files[0])
          )

          await t.test(
            'Upload B.',
            uploadBTest(request.body.variables.files[1])
          )
        })
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await sendRequest(port)
  })
})

t.test('Misorder “map” before “operations”.', async t => {
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
      .use(apolloUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, MapBeforeOperationsUploadError, 'Middleware throws.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})

t.test('Misorder files before “map”.', async t => {
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
      .use(apolloUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        if (response.headersSent) return next(error)

        t.type(error, FilesBeforeMapUploadError, 'Middleware throws.')

        response.send()
      })

    const port = await startServer(t, app)

    await sendRequest(t, port)
  })
})
