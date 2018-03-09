import path from 'path'
import fs from 'fs'
import test from 'ava'
import Koa from 'koa'
import getPort from 'get-port'
import fetch from 'node-fetch'
import FormData from 'form-data'
import {
  apolloUploadKoa,
  MaxFileSizeUploadError,
  MaxFilesUploadError,
  MapBeforeOperationsUploadError,
  FilesBeforeMapUploadError,
  FileMissingUploadError
} from '.'

// GraphQL multipart request spec:
// https://github.com/jaydenseric/graphql-multipart-request-spec

const TEST_FILE_PATH = path.join(__dirname, 'package.json')

async function startServer(middlewares) {
  const port = await getPort()
  const app = new Koa()

  middlewares.forEach(middleware => app.use(middleware))

  const server = await new Promise((resolve, reject) => {
    app.listen(port, function(error) {
      if (error) reject(error)
      else resolve(this)
    })
  })

  return { port, server }
}

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
  const { port, server } = await startServer([
    apolloUploadKoa(),
    async (ctx, next) => {
      checkUpload(t, await ctx.request.body.variables.file)
      ctx.status = 204
      await next()
    }
  ])

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

  server.close()
})

test('Deduped files.', async t => {
  const { port, server } = await startServer([
    apolloUploadKoa(),
    async (ctx, next) => {
      const files = await Promise.all(ctx.request.body.variables.files)
      files.forEach(file => checkUpload(t, file))
      ctx.status = 204
      await next()
    }
  ])

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

  body.append('1', fs.createReadStream(TEST_FILE_PATH))

  await fetch(`http://localhost:${port}`, { method: 'POST', body })

  server.close()
})

test('Missing file.', async t => {
  const { port, server } = await startServer([
    apolloUploadKoa(),
    async (ctx, next) => {
      await t.throws(ctx.request.body.variables.file, {
        instanceOf: FileMissingUploadError
      })
      ctx.status = 204
      await next()
    }
  ])

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

  await fetch(`http://localhost:${port}`, { method: 'POST', body })

  server.close()
})

test('Extraneous file.', async t => {
  const { port, server } = await startServer([
    apolloUploadKoa(),
    async (ctx, next) => {
      checkUpload(t, await ctx.request.body.variables.file)
      ctx.status = 204
      await next()
    }
  ])

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
  body.append('2', fs.createReadStream(TEST_FILE_PATH))

  await fetch(`http://localhost:${port}`, { method: 'POST', body })

  server.close()
})

test('Exceed max files.', async t => {
  const { port, server } = await startServer([
    async (ctx, next) => {
      await t.throws(next, { instanceOf: MaxFilesUploadError })
      ctx.status = 204
    },
    apolloUploadKoa({ maxFiles: 1 })
  ])

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
  body.append('2', fs.createReadStream(TEST_FILE_PATH))

  await fetch(`http://localhost:${port}`, { method: 'POST', body })

  server.close()
})

test('Exceed max files with extraneous files intersperced.', async t => {
  const { port, server } = await startServer([
    apolloUploadKoa({ maxFiles: 2 }),
    async (ctx, next) => {
      checkUpload(t, await ctx.request.body.variables.files[0])

      await t.throws(ctx.request.body.variables.files[1], {
        instanceOf: MaxFilesUploadError
      })

      ctx.status = 204

      await next()
    }
  ])

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

  server.close()
})

// eslint-disable-next-line ava/no-skip-test
test.failing.skip('Exceed max file size.', async t => {
  const { port, server } = await startServer([
    apolloUploadKoa({ maxFileSize: 10 }),
    async (ctx, next) => {
      const { stream } = await ctx.request.body.variables.file

      const streamResult = new Promise((resolve, reject) => {
        stream.on('end', resolve)
        stream.on('error', reject)
      })

      // Resume and discard the stream. Otherwise busboy hangs, there is no
      // response and the connection eventually resets.
      stream.resume()

      await t.throws(streamResult, { instanceOf: MaxFileSizeUploadError })

      ctx.status = 204

      await next()
    }
  ])

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

  server.close()
})

test('Misorder “map” before “operations”.', async t => {
  const { port, server } = await startServer([
    async (ctx, next) => {
      await t.throws(next, { instanceOf: MapBeforeOperationsUploadError })
      ctx.status = 204
    },
    apolloUploadKoa()
  ])

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

  await fetch(`http://localhost:${port}`, { method: 'POST', body })

  server.close()
})

test('Misorder files before “map”.', async t => {
  const { port, server } = await startServer([
    async (ctx, next) => {
      await t.throws(next, { instanceOf: FilesBeforeMapUploadError })
      ctx.status = 204
    },
    apolloUploadKoa()
  ])

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

  await fetch(`http://localhost:${port}`, { method: 'POST', body })

  server.close()
})
