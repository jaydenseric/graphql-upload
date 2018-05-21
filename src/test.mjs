import fs from 'fs'
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
  FileMissingUploadError
} from '.'

// GraphQL multipart request spec:
// https://github.com/jaydenseric/graphql-multipart-request-spec

const TEST_FILE_PATH = 'package.json'

const startServer = (t, app) =>
  new Promise((resolve, reject) => {
    app.listen(function(error) {
      if (error) reject(error)
      else {
        t.tearDown(() => this.close())
        resolve(this.address().port)
      }
    })
  })

const uploadTest = upload => async t => {
  const resolved = await upload

  t.type(resolved.stream, 'FileStream', 'Stream.')
  t.equals(resolved.filename, 'package.json', 'Filename.')
  t.equals(resolved.mimetype, 'application/json', 'MIME type.')
  t.equals(resolved.encoding, '7bit', 'Encoding.')

  // Resume and discard the stream. Otherwise busboy hangs, there is no
  // response and the connection eventually resets.
  resolved.stream.resume()

  return resolved
}

t.test('Single file.', async t => {
  t.jobs = 2

  const testRequest = async port => {
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
    body.append(1, fs.createReadStream(TEST_FILE_PATH))

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
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

    await testRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(1)

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        t
          .test('Upload resolves.', uploadTest(request.body.variables.file))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })
})

t.test('Deduped files.', async t => {
  t.jobs = 2

  const testRequest = async port => {
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

    body.append(1, fs.createReadStream(TEST_FILE_PATH))

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
      await Promise.all([
        t.test(
          'Upload 1 resolves.',
          uploadTest(ctx.request.body.variables.files[0])
        ),
        t.test(
          'Upload 2 resolves.',
          uploadTest(ctx.request.body.variables.files[1])
        )
      ])

      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await testRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        Promise.all([
          t.test(
            'Upload 1 resolves.',
            uploadTest(request.body.variables.files[0])
          ),
          t.test(
            'Upload 2 resolves.',
            uploadTest(request.body.variables.files[1])
          )
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })
})

t.test('Missing file.', async t => {
  t.jobs = 2

  const testRequest = async port => {
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
        'Upload rejects.'
      )
      ctx.status = 204
      await next()
    })

    const port = await startServer(t, app)

    await testRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(1)

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        t
          .rejects(
            request.body.variables.file,
            FileMissingUploadError,
            'Upload rejects.'
          )
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })
})

t.test('Extraneous file.', async t => {
  t.jobs = 2

  const testRequest = async port => {
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

    body.append(1, fs.createReadStream(TEST_FILE_PATH))
    body.append(2, fs.createReadStream(TEST_FILE_PATH))

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
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

    await testRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(1)

    const app = express()
      .use(apolloUploadExpress())
      .use((request, response, next) => {
        t
          .test('Upload resolves.', uploadTest(request.body.variables.file))
          .then(() => next())
          .catch(next)
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })
})

t.test('Exceed max files.', async t => {
  t.jobs = 2

  const testRequest = async (t, port) => {
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

    body.append(1, fs.createReadStream(TEST_FILE_PATH))
    body.append(2, fs.createReadStream(TEST_FILE_PATH))

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

    await testRequest(t, port)
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

    await testRequest(t, port)
  })
})

t.test('Exceed max files with extraneous files interspersed.', async t => {
  t.jobs = 2

  const testRequest = async port => {
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

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .use(apolloUploadKoa({ maxFiles: 2 }))
      .use(async (ctx, next) => {
        await t.test(
          'Upload 1 resolves.',
          uploadTest(ctx.request.body.variables.files[0])
        )

        await t.rejects(
          ctx.request.body.variables.files[1],
          MaxFilesUploadError,
          'Upload 2 rejects.'
        )

        ctx.status = 204
        await next()
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 2 }))
      .use((request, response, next) => {
        Promise.all([
          t.test(
            'Upload 1 resolves.',
            uploadTest(request.body.variables.files[0])
          ),
          t.rejects(
            request.body.variables.files[1],
            MaxFilesUploadError,
            'Upload 2 rejects.'
          )
        ]).then(() => next())
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })
})

t.test('Exceed max file size.', async t => {
  t.jobs = 2

  const testRequest = async port => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

    body.append('map', JSON.stringify({ '1': ['variables.file'] }))
    body.append('1', fs.createReadStream(TEST_FILE_PATH))

    await fetch(`http://localhost:${port}`, { method: 'POST', body })
  }

  await t.skip('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .use(apolloUploadKoa({ maxFileSize: 10 }))
      .use(async (ctx, next) => {
        await t.test('Upload resolves.', async t => {
          const { stream } = await uploadTest(ctx.request.body.variables.file)(
            t
          )
          await t.rejects(
            new Promise((resolve, reject) => {
              stream.on('end', () => resolve())
              stream.on('error', error => reject(error))
            }),
            MaxFileSizeUploadError,
            'Upload file stream emits error.'
          )
        })

        ctx.status = 204
        await next()
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })

  await t.skip('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFileSize: 10 }))
      .use((request, response, next) => {
        uploadTest(request.body.variables.file)(t).then(({ stream }) => {
          t
            .rejects(
              new Promise((resolve, reject) => {
                stream.on('end', () => resolve())
                stream.on('error', error => reject(error))
              }),
              MaxFileSizeUploadError,
              'Upload file stream emits error.'
            )
            .then(() => next())
            .catch(next)
        })
      })

    const port = await startServer(t, app)

    await testRequest(port)
  })
})

t.test('Misorder “map” before “operations”.', async t => {
  t.jobs = 2

  const testRequest = async (t, port) => {
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

    body.append('1', fs.createReadStream(TEST_FILE_PATH))

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

    await testRequest(t, port)
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

    await testRequest(t, port)
  })
})

t.test('Misorder files before “map”.', async t => {
  t.jobs = 2

  const testRequest = async (t, port) => {
    const body = new FormData()

    body.append(
      'operations',
      JSON.stringify({
        variables: {
          file: null
        }
      })
    )

    body.append('1', fs.createReadStream(TEST_FILE_PATH))

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

    await testRequest(t, port)
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

    await testRequest(t, port)
  })
})
