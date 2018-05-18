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

const startServer = app =>
  new Promise((resolve, reject) => {
    app.listen(function(error) {
      if (error) reject(error)
      else resolve({ server: this, port: this.address().port })
    })
  })

const post = (port, body) =>
  fetch(`http://localhost:${port}`, { method: 'POST', body }).catch(error => {
    // Swallow intermittent error that effects Node.js < v10.
    if (error.code !== 'EPIPE') throw error
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
  const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
    await t.test(
      'Upload resolves.',
      uploadTest(ctx.request.body.variables.file)
    )

    ctx.status = 204
    await next()
  })

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  await post(port, body)
})

t.test('Deduped files.', async t => {
  const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
    t.equals(
      ctx.request.body.variables.files.length,
      2,
      '2 uploads in variables.'
    )

    for (let [index, upload] of ctx.request.body.variables.files.entries())
      await t.test(`Upload ${++index} resolves.`, uploadTest(upload))

    ctx.status = 204
    await next()
  })

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  await post(port, body)
})

t.test('Missing file.', async t => {
  const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
    await t.rejects(
      ctx.request.body.variables.file,
      FileMissingUploadError,
      'Upload rejects.'
    )
    ctx.status = 204
    await next()
  })

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  await post(port, body)
})

t.test('Extraneous file.', async t => {
  const app = new Koa().use(apolloUploadKoa()).use(async (ctx, next) => {
    await t.test(
      'Upload resolves.',
      uploadTest(ctx.request.body.variables.file)
    )
    ctx.status = 204
    await next()
  })

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  await post(port, body)
})

t.test('Exceed max files.', async t => {
  t.jobs = 2

  const createBody = () => {
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

    return body
  }

  await t.test('Koa middleware.', async t => {
    t.plan(2)

    const app = new Koa()
      .on('error', error =>
        t.type(error, MaxFilesUploadError, 'Middleware throws.')
      )
      .use(apolloUploadKoa({ maxFiles: 1 }))

    const { server, port } = await startServer(app)

    t.tearDown(() => server.close())

    const { status } = await post(port, createBody())

    t.equal(status, 413, 'Response status.')
  })

  await t.test('Express middleware.', async t => {
    t.plan(2)

    const app = express()
      .use(apolloUploadExpress({ maxFiles: 1 }))
      .use((error, request, response, next) => {
        t.type(error, MaxFilesUploadError, 'Middleware throws.')
        next(error)
      })

    const { server, port } = await startServer(app)

    t.tearDown(() => server.close())

    const { status } = await post(port, createBody())

    t.equal(status, 413, 'Response status.')
  })
})

t.test('Exceed max files with extraneous files interspersed.', async t => {
  const app = new Koa()
    .use(apolloUploadKoa({ maxFiles: 2 }))
    .use(async (ctx, next) => {
      await t.test(
        `Upload 1 resolves.`,
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

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  await post(port, body)
})

t.skip('Exceed max file size.', async t => {
  const app = new Koa()
    .use(apolloUploadKoa({ maxFileSize: 10 }))
    .use(async (ctx, next) => {
      await t.test('Upload resolves.', async t => {
        const { stream } = await uploadTest(ctx.request.body.variables.file)(t)
        await t.rejects(
          new Promise((resolve, reject) => {
            stream.on('end', resolve)
            stream.on('error', reject)
          }),
          MaxFileSizeUploadError,
          'Upload file stream emits error.'
        )
      })

      ctx.status = 204
      await next()
    })

  const { server, port } = await startServer(app)
  t.tearDown(() => server.close())

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

  await post(port, body)
})

t.test('Misorder “map” before “operations”.', async t => {
  t.plan(2)

  const app = new Koa()
    .on('error', error =>
      t.type(error, MapBeforeOperationsUploadError, 'Middleware throws.')
    )
    .use(apolloUploadKoa())

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  const { status } = await post(port, body)

  t.equal(status, 400, 'Response status.')
})

t.test('Misorder files before “map”.', async t => {
  t.plan(2)

  const app = new Koa()
    .on('error', error =>
      t.type(error, FilesBeforeMapUploadError, 'Middleware throws.')
    )
    .use(apolloUploadKoa())

  const { server, port } = await startServer(app)

  t.tearDown(() => server.close())

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

  const { status } = await post(port, body)

  t.equal(status, 400, 'Response status.')
})
