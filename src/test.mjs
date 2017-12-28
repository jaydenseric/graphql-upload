import { createReadStream } from 'fs'
import test from 'ava'
import Koa from 'koa'
import getPort from 'get-port'
import got from 'got'
import FormData from 'form-data'
import { apolloUploadKoa } from '.'

// GraphQL multipart request spec:
// https://github.com/jaydenseric/graphql-multipart-request-spec

const TEST_FILE_PATH = 'package.json'

function checkUpload(t, { stream, ...meta }) {
  t.truthy(
    stream.constructor.name === 'FileStream',
    'Resolved upload object in variables contains a stream.'
  )

  t.deepEqual(
    meta,
    {
      filename: 'package.json',
      mimetype: 'application/json',
      encoding: '7bit'
    },
    'Resolved upload object in variables contains correct meta.'
  )
}

test('Single file.', async t => {
  const port = await getPort()
  const app = new Koa()

  app.use(apolloUploadKoa()).use(async (ctx, next) => {
    checkUpload(t, await ctx.request.body.variables.file)
    ctx.status = 204
    await next()
  })

  const server = app.listen(port)

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
  body.append('1', createReadStream(TEST_FILE_PATH))

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Deduped files.', async t => {
  const port = await getPort()
  const app = new Koa()

  app.use(apolloUploadKoa()).use(async (ctx, next) => {
    const files = await Promise.all(ctx.request.body.variables.files)
    files.forEach(file => checkUpload(t, file))
    ctx.status = 204
    await next()
  })

  const server = app.listen(port)

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
    JSON.stringify({ '1': ['variables.files.0', 'variables.files.1'] })
  )

  body.append('1', createReadStream(TEST_FILE_PATH))

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Extraneous file.', async t => {
  const port = await getPort()
  const app = new Koa()

  app.use(apolloUploadKoa()).use(async (ctx, next) => {
    checkUpload(t, await ctx.request.body.variables.file)
    ctx.status = 204
    await next()
  })

  const server = app.listen(port)

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
  body.append('1', createReadStream(TEST_FILE_PATH))
  body.append('2', createReadStream(TEST_FILE_PATH))

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Missing file.', async t => {
  const port = await getPort()
  const app = new Koa()

  app.use(apolloUploadKoa()).use(async (ctx, next) => {
    const error = await t.throws(ctx.request.body.variables.file)
    t.is(error.name, 'FileMissingUploadError')
    ctx.status = 204
    await next()
  })

  const server = app.listen(port)

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

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Exceed max files.', async t => {
  const port = await getPort()
  const app = new Koa()

  app
    .use(async (ctx, next) => {
      try {
        await next()
      } catch (error) {
        t.is(error.name, 'MaxFilesUploadError')
      }
      ctx.status = 204
    })
    .use(apolloUploadKoa({ maxFiles: 1 }))

  const server = app.listen(port)

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

  body.append('1', createReadStream(TEST_FILE_PATH))
  body.append('2', createReadStream(TEST_FILE_PATH))

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Exceed max files with extraneous files intersperced.', async t => {
  const port = await getPort()
  const app = new Koa()

  app.use(apolloUploadKoa({ maxFiles: 2 })).use(async (ctx, next) => {
    checkUpload(t, await ctx.request.body.variables.files[0])

    const error = await t.throws(ctx.request.body.variables.files[1])
    t.is(error.name, 'MaxFilesUploadError')

    ctx.status = 204

    await next()
  })

  const server = app.listen(port)

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

  body.append('1', createReadStream(TEST_FILE_PATH))
  body.append('extraneous', createReadStream(TEST_FILE_PATH))
  body.append('2', createReadStream(TEST_FILE_PATH))

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Misorder “map” before “operations”.', async t => {
  const port = await getPort()
  const app = new Koa()

  app
    .use(async (ctx, next) => {
      try {
        await next()
      } catch (error) {
        t.is(error.name, 'MapBeforeOperationsUploadError')
      }
      ctx.status = 204
    })
    .use(apolloUploadKoa())

  const server = app.listen(port)

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

  body.append('1', createReadStream(TEST_FILE_PATH))

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Misorder files before “map”.', async t => {
  const port = await getPort()
  const app = new Koa()

  app
    .use(async (ctx, next) => {
      try {
        await next()
      } catch (error) {
        t.is(error.name, 'FilesBeforeMapUploadError')
      }
      ctx.status = 204
    })
    .use(apolloUploadKoa())

  const server = app.listen(port)

  const body = new FormData()

  body.append(
    'operations',
    JSON.stringify({
      variables: {
        file: null
      }
    })
  )

  body.append('1', createReadStream(TEST_FILE_PATH))

  body.append(
    'map',
    JSON.stringify({
      '1': ['variables.file']
    })
  )

  await got(`http://localhost:${port}`, { body })

  server.close()
})

test('Abort uploads.', async t => {
  const port = await getPort()
  const app = new Koa()

  app.use(apolloUploadKoa()).use(async ctx => {
    const { stream } = await ctx.request.body.variables.files[0]
    const streamPromise = new Promise((resolve, reject) => {
      stream.on('error', reject)
      stream.on('end', resolve)

      // Waste the file stream
      stream.resume()
    })

    // Simulate client aborting.
    ctx.req.socket.destroy()

    const error1 = await t.throws(streamPromise)
    if (error1) t.is(error1.name, 'AbortedFileStreamUploadError')

    const error2 = await t.throws(ctx.request.body.variables.files[1])
    if (error2) t.is(error2.name, 'AbortedUploadPromise')
  })

  const server = app.listen(port)

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

  body.append('1', createReadStream(TEST_FILE_PATH))
  body.append('2', createReadStream(TEST_FILE_PATH))

  try {
    await got(`http://localhost:${port}`, { body })
  } catch (error) {
    // The request was deliberately aborted.
  }

  server.close()
})
