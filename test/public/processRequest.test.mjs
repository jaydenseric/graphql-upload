import {
  deepStrictEqual,
  notStrictEqual,
  ok,
  rejects,
  strictEqual,
  throws,
} from 'assert';
import { createServer } from 'http';
import FormData from 'form-data';
import { ReadStream } from 'fs-capacitor';
import fetch from 'node-fetch';
import Upload from '../../public/Upload.js';
import processRequest from '../../public/processRequest.js';
import abortingMultipartRequest from '../abortingMultipartRequest.mjs';
import listen from '../listen.mjs';
import streamToString from '../streamToString.mjs';

export default (tests) => {
  tests.add('`processRequest` with no files.', async () => {
    let serverError;

    const operation = { variables: { a: true } };
    const server = createServer(async (request, response) => {
      try {
        deepStrictEqual(await processRequest(request, response), operation);
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append('operations', JSON.stringify(operation));
      body.append('map', '{}');

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add(
    '`processRequest` with a single file and default `createReadStream` options.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          const operation = await processRequest(request, response);

          ok(operation.variables.file instanceof Upload);

          const upload = await operation.variables.file.promise;

          strictEqual(upload.filename, 'a.txt');
          strictEqual(upload.mimetype, 'text/plain');
          strictEqual(upload.encoding, '7bit');

          const stream = upload.createReadStream();

          ok(stream instanceof ReadStream);
          strictEqual(stream._readableState.encoding, null);
          strictEqual(stream.readableHighWaterMark, 16384);
          strictEqual(await streamToString(stream), 'a');
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with a single file and custom `createReadStream` options.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          const operation = await processRequest(request, response);

          ok(operation.variables.file instanceof Upload);

          const upload = await operation.variables.file.promise;

          strictEqual(upload.filename, 'a.txt');
          strictEqual(upload.mimetype, 'text/plain');
          strictEqual(upload.encoding, '7bit');

          const encoding = 'base64';
          const highWaterMark = 100;
          const stream = upload.createReadStream({ encoding, highWaterMark });

          ok(stream instanceof ReadStream);
          strictEqual(stream._readableState.encoding, encoding);
          strictEqual(stream.readableHighWaterMark, highWaterMark);
          strictEqual(
            await streamToString(stream),
            Buffer.from('a').toString(encoding)
          );
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add('`processRequest` with a single file, batched.', async () => {
    let serverError;

    const server = createServer(async (request, response) => {
      try {
        const operations = await processRequest(request, response);

        ok(operations[0].variables.file instanceof Upload);

        const uploadA = await operations[0].variables.file.promise;

        strictEqual(uploadA.filename, 'a.txt');
        strictEqual(uploadA.mimetype, 'text/plain');
        strictEqual(uploadA.encoding, '7bit');

        const streamA = uploadA.createReadStream();

        ok(streamA instanceof ReadStream);
        strictEqual(await streamToString(streamA), 'a');

        ok(operations[1].variables.file instanceof Upload);

        const uploadB = await operations[1].variables.file.promise;

        strictEqual(uploadB.filename, 'b.txt');
        strictEqual(uploadB.mimetype, 'text/plain');
        strictEqual(uploadB.encoding, '7bit');

        const streamB = uploadB.createReadStream();

        ok(streamB instanceof ReadStream);
        strictEqual(await streamToString(streamB), 'b');
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append(
        'operations',
        JSON.stringify([
          { variables: { file: null } },
          { variables: { file: null } },
        ])
      );
      body.append(
        'map',
        JSON.stringify({ 1: ['0.variables.file'], 2: ['1.variables.file'] })
      );
      body.append('1', 'a', { filename: 'a.txt' });
      body.append('2', 'b', { filename: 'b.txt' });

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add('`processRequest` with deduped files.', async () => {
    let serverError;

    const server = createServer(async (request, response) => {
      try {
        const operation = await processRequest(request, response);

        ok(operation.variables.files[0] instanceof Upload);
        ok(operation.variables.files[1] instanceof Upload);
        strictEqual(operation.variables.files[0], operation.variables.files[1]);

        const [upload1, upload2] = await Promise.all([
          operation.variables.files[0].promise,
          operation.variables.files[1].promise,
        ]);

        strictEqual(upload1, upload2);
        strictEqual(upload1.filename, 'a.txt');
        strictEqual(upload1.mimetype, 'text/plain');
        strictEqual(upload1.encoding, '7bit');

        const stream1 = upload1.createReadStream();
        const stream2 = upload2.createReadStream();

        notStrictEqual(stream1, stream2);
        ok(stream1 instanceof ReadStream);
        ok(stream2 instanceof ReadStream);

        const [content1, content2] = await Promise.all([
          streamToString(stream1),
          streamToString(stream2),
        ]);

        strictEqual(content1, 'a');
        strictEqual(content2, 'a');
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append(
        'operations',
        JSON.stringify({ variables: { files: [null, null] } })
      );
      body.append(
        'map',
        JSON.stringify({ 1: ['variables.files.0', 'variables.files.1'] })
      );
      body.append('1', 'a', { filename: 'a.txt' });

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add('`processRequest` with unconsumed uploads.', async () => {
    let serverError;

    const server = createServer(async (request, response) => {
      try {
        const operation = await processRequest(request, response);

        ok(operation.variables.fileB instanceof Upload);

        const uploadB = await operation.variables.fileB.promise;
        const streamB = uploadB.createReadStream();

        await streamToString(streamB);
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append(
        'operations',
        JSON.stringify({ variables: { fileA: null, fileB: null } })
      );
      body.append(
        'map',
        JSON.stringify({ 1: ['variables.fileA'], 2: ['variables.fileB'] })
      );
      body.append('1', 'a', { filename: 'a.txt' });
      body.append('2', 'b', { filename: 'b.txt' });

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add(
    '`processRequest` with an extraneous multipart form field file.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          const operation = await processRequest(request, response);

          ok(operation.variables.file instanceof Upload);

          const upload = await operation.variables.file.promise;

          strictEqual(upload.filename, 'a.txt');
          strictEqual(upload.mimetype, 'text/plain');
          strictEqual(upload.encoding, '7bit');

          const stream = upload.createReadStream();

          ok(stream instanceof ReadStream);
          strictEqual(await streamToString(stream), 'a');
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append('1', 'a', { filename: 'a.txt' });
        body.append('2', 'b', { filename: 'b.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with a missing multipart form field file.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          const operation = await processRequest(request, response);

          ok(operation.variables.file instanceof Upload);
          await rejects(operation.variables.file.promise, {
            name: 'BadRequestError',
            message: 'File missing in the request.',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add('`processRequest` with option `maxFiles`.', async () => {
    let serverError;

    const server = createServer(async (request, response) => {
      try {
        await rejects(processRequest(request, response, { maxFiles: 1 }), {
          name: 'PayloadTooLargeError',
          message: '1 max file uploads exceeded.',
          status: 413,
          expose: true,
        });
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append(
        'operations',
        JSON.stringify({ variables: { files: [null, null] } })
      );
      body.append(
        'map',
        JSON.stringify({
          1: ['variables.files.0'],
          2: ['variables.files.1'],
        })
      );
      body.append('1', 'a', { filename: 'a.txt' });
      body.append('2', 'b', { filename: 'b.txt' });

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add(
    '`processRequest` with option `maxFiles` and an interspersed extraneous file.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          const operation = await processRequest(request, response, {
            maxFiles: 2,
          });

          ok(operation.variables.files[0] instanceof Upload);

          const uploadA = await operation.variables.files[0].promise;

          strictEqual(uploadA.filename, 'a.txt');
          strictEqual(uploadA.mimetype, 'text/plain');
          strictEqual(uploadA.encoding, '7bit');

          const streamA = uploadA.createReadStream();

          ok(streamA instanceof ReadStream);
          strictEqual(await streamToString(streamA), 'a');
          ok(operation.variables.files[1] instanceof Upload);
          await rejects(operation.variables.files[1].promise, {
            name: 'PayloadTooLargeError',
            message: '2 max file uploads exceeded.',
            status: 413,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { files: [null, null] } })
        );
        body.append(
          'map',
          JSON.stringify({
            1: ['variables.files.0'],
            2: ['variables.files.1'],
          })
        );
        body.append('1', 'a', { filename: 'a.txt' });
        body.append('extraneous', 'c', { filename: 'c.txt' });
        body.append('2', 'b', { filename: 'b.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add('`processRequest` with option `maxFileSize`.', async () => {
    let serverError;

    const server = createServer(async (request, response) => {
      try {
        const operation = await processRequest(request, response, {
          maxFileSize: 1,
        });

        ok(operation.variables.files[0] instanceof Upload);

        const { createReadStream } = await operation.variables.files[0].promise;

        await throws(
          () => {
            createReadStream();
          },
          {
            name: 'PayloadTooLargeError',
            message: 'File truncated as it exceeds the 1 byte size limit.',
            status: 413,
            expose: true,
          }
        );

        ok(operation.variables.files[0] instanceof Upload);

        const uploadB = await operation.variables.files[1].promise;

        strictEqual(uploadB.filename, 'b.txt');
        strictEqual(uploadB.mimetype, 'text/plain');
        strictEqual(uploadB.encoding, '7bit');

        const streamB = uploadB.createReadStream();

        ok(streamB instanceof ReadStream);
        strictEqual(await streamToString(streamB), 'b');
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append(
        'operations',
        JSON.stringify({ variables: { files: [null, null] } })
      );
      body.append(
        'map',
        JSON.stringify({
          1: ['variables.files.0'],
          2: ['variables.files.1'],
        })
      );
      body.append('1', 'aa', { filename: 'a.txt' });
      body.append('2', 'b', { filename: 'b.txt' });

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add('`processRequest` with option `maxFieldSize`.', async () => {
    let serverError;

    const server = createServer(async (request, response) => {
      try {
        await rejects(processRequest(request, response, { maxFieldSize: 1 }), {
          name: 'PayloadTooLargeError',
          message:
            'The ‘operations’ multipart field value exceeds the 1 byte size limit.',
          status: 413,
          expose: true,
        });
      } catch (error) {
        serverError = error;
      } finally {
        response.end();
      }
    });

    const { port, close } = await listen(server);

    try {
      const body = new FormData();

      body.append('operations', JSON.stringify({ variables: { file: null } }));
      body.append('map', JSON.stringify({ 1: ['variables.file'] }));
      body.append('1', 'a', { filename: 'a.txt' });

      await fetch(`http://localhost:${port}`, { method: 'POST', body });

      if (serverError) throw serverError;
    } finally {
      close();
    }
  });

  tests.add(
    '`processRequest` with an aborted request and immediate stream creation.',
    async () => {
      let serverError;

      // In other tests a fetch request can be awaited that resolves once the
      // request, tests and response are done. Because this test aborts a
      // request part way through, the server request handler must be manually
      // awaited or else the test will resolve and the process will exit before
      // it’s done.
      let resolveDone;
      const done = new Promise((resolve) => {
        resolveDone = resolve;
      });

      // The request must be aborted after it has been received by the server
      // request handler, or else Node.js won’t run the handler.
      let resolveRequestReceived;
      const requestReceived = new Promise((resolve) => {
        resolveRequestReceived = resolve;
      });

      const server = createServer(async (request, response) => {
        try {
          resolveRequestReceived();

          const operation = await processRequest(request, response);

          const testUploadA = async () => {
            ok(operation.variables.fileA instanceof Upload);

            const upload = await operation.variables.fileA.promise;

            strictEqual(upload.filename, 'a.txt');
            strictEqual(upload.mimetype, 'text/plain');
            strictEqual(upload.encoding, '7bit');

            const stream = upload.createReadStream();

            ok(stream instanceof ReadStream);
            strictEqual(await streamToString(stream), 'a');
          };

          const testUploadB = async () => {
            ok(operation.variables.fileB instanceof Upload);

            const upload = await operation.variables.fileB.promise;

            strictEqual(upload.filename, 'b.txt');
            strictEqual(upload.mimetype, 'text/plain');
            strictEqual(upload.encoding, '7bit');

            const stream = upload.createReadStream();

            ok(stream instanceof ReadStream);
            await rejects(
              new Promise((resolve, reject) => {
                stream.once('error', reject).once('end', resolve).resume();
              }),
              {
                name: 'BadRequestError',
                message:
                  'Request disconnected during file upload stream parsing.',
                status: 499,
                expose: true,
              }
            );
          };

          const testUploadC = async () => {
            ok(operation.variables.fileC instanceof Upload);
            await rejects(operation.variables.fileC.promise, {
              name: 'BadRequestError',
              message:
                'Request disconnected during file upload stream parsing.',
              status: 499,
              expose: true,
            });
          };

          await Promise.all([testUploadA(), testUploadB(), testUploadC()]);
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
          resolveDone();
        }
      });

      const { port, close } = await listen(server);

      try {
        const abortMarker = '⛔';
        const formData = new FormData();

        formData.append(
          'operations',
          JSON.stringify({
            variables: { fileA: null, fileB: null, fileC: null },
          })
        );
        formData.append(
          'map',
          JSON.stringify({
            1: ['variables.fileA'],
            2: ['variables.fileB'],
            3: ['variables.fileC'],
          })
        );
        formData.append('1', 'a', { filename: 'a.txt' });
        formData.append(
          '2',
          // Will arrive in multiple chunks as the TCP max packet size is 64000
          // bytes and the default Node.js fs stream buffer is 65536 bytes.
          `${'b'.repeat(70000)}${abortMarker}${'b'.repeat(10)}`,
          { filename: 'b.txt' }
        );
        formData.append('3', 'c', { filename: 'c.txt' });

        await abortingMultipartRequest(
          `http://localhost:${port}`,
          formData,
          abortMarker,
          requestReceived
        );

        await done;

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with an aborted request and delayed stream creation.',
    async () => {
      let serverError;

      // In other tests a fetch request can be awaited that resolves once the
      // request, tests and response are done. Because this test aborts a
      // request part way through, the server request handler must be manually
      // awaited or else the test will resolve and the process will exit before
      // it’s done.
      let resolveDone;
      const done = new Promise((resolve) => {
        resolveDone = resolve;
      });

      // The request must be aborted after it has been received by the server
      // request handler, or else Node.js won’t run the handler.
      let resolveRequestReceived;
      const requestReceived = new Promise((resolve) => {
        resolveRequestReceived = resolve;
      });

      const server = createServer(async (request, response) => {
        try {
          resolveRequestReceived();

          const operation = await processRequest(request, response);

          // Wait for the request parsing to finish.
          await new Promise((resolve) => {
            request.once('close', resolve);
          });

          const testUploadA = async () => {
            ok(operation.variables.fileA instanceof Upload);

            const upload = await operation.variables.fileA.promise;

            strictEqual(upload.filename, 'a.txt');
            strictEqual(upload.mimetype, 'text/plain');
            strictEqual(upload.encoding, '7bit');

            throws(() => upload.createReadStream(), {
              name: 'BadRequestError',
              message:
                'Request disconnected during file upload stream parsing.',
              status: 499,
              expose: true,
            });
          };

          const testUploadB = async () => {
            ok(operation.variables.fileB instanceof Upload);

            const upload = await operation.variables.fileB.promise;

            strictEqual(upload.filename, 'b.txt');
            strictEqual(upload.mimetype, 'text/plain');
            strictEqual(upload.encoding, '7bit');
            throws(() => upload.createReadStream(), {
              name: 'BadRequestError',
              message:
                'Request disconnected during file upload stream parsing.',
              status: 499,
              expose: true,
            });
          };

          const testUploadC = async () => {
            ok(operation.variables.fileC instanceof Upload);
            await rejects(operation.variables.fileC.promise, {
              name: 'BadRequestError',
              message:
                'Request disconnected during file upload stream parsing.',
              status: 499,
              expose: true,
            });
          };

          await Promise.all([testUploadA(), testUploadB(), testUploadC()]);
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
          resolveDone();
        }
      });

      const { port, close } = await listen(server);

      try {
        const abortMarker = '⛔';
        const formData = new FormData();

        formData.append(
          'operations',
          JSON.stringify({
            variables: { fileA: null, fileB: null, fileC: null },
          })
        );
        formData.append(
          'map',
          JSON.stringify({
            1: ['variables.fileA'],
            2: ['variables.fileB'],
            3: ['variables.fileC'],
          })
        );
        formData.append('1', 'a', { filename: 'a.txt' });
        formData.append(
          '2',
          // Will arrive in multiple chunks as the TCP max packet size is 64000
          // bytes and the default Node.js fs stream buffer is 65536 bytes.
          `${'b'.repeat(70000)}${abortMarker}${'b'.repeat(10)}`,
          { filename: 'b.txt' }
        );
        formData.append('3', 'c', { filename: 'c.txt' });

        await abortingMultipartRequest(
          `http://localhost:${port}`,
          formData,
          abortMarker,
          requestReceived
        );

        await done;

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with multipart form field `map` misordered before `operations`.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Misordered multipart fields; ‘map’ should follow ‘operations’ (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with multipart form field file misordered before `map`.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Misordered multipart fields; files should follow ‘map’ (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('1', 'a', { filename: 'a.txt' });
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with multipart form fields `map` and file missing.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Missing multipart field ‘map’ (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with multipart form fields `operations`, `map` and file missing.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Missing multipart field ‘operations’ (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        await fetch(`http://localhost:${port}`, {
          method: 'POST',
          body: new FormData(),
        });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `operations` JSON and a small file.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid JSON in the ‘operations’ multipart field (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append('operations', '{ x }');
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `operations` JSON and a large file.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid JSON in the ‘operations’ multipart field (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append('operations', '{ x }');
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append(
          '1',
          // Will arrive in multiple chunks as the TCP max packet size is 64000
          // bytes and the default Node.js fs stream buffer is 65536 bytes.
          'a'.repeat(70000),
          { filename: 'a.txt' }
        );

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `operations` type.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid type for the ‘operations’ multipart field (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append('operations', 'null');
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `map` JSON.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid JSON in the ‘map’ multipart field (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', '{ x }');
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `map` type.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid type for the ‘map’ multipart field (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', 'null');
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `map` entry type.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid type for the ‘map’ multipart field entry key ‘1’ array (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', JSON.stringify({ 1: null }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `map` entry array item type.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid type for the ‘map’ multipart field entry key ‘1’ array index ‘0’ value (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append(
          'operations',
          JSON.stringify({ variables: { file: null } })
        );
        body.append('map', JSON.stringify({ 1: [null] }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );

  tests.add(
    '`processRequest` with invalid multipart form field `map` entry array item object path.',
    async () => {
      let serverError;

      const server = createServer(async (request, response) => {
        try {
          await rejects(processRequest(request, response), {
            name: 'BadRequestError',
            message:
              'Invalid object path for the ‘map’ multipart field entry key ‘1’ array index ‘0’ value ‘variables.file’ (https://github.com/jaydenseric/graphql-multipart-request-spec).',
            status: 400,
            expose: true,
          });
        } catch (error) {
          serverError = error;
        } finally {
          response.end();
        }
      });

      const { port, close } = await listen(server);

      try {
        const body = new FormData();

        body.append('operations', JSON.stringify({ variables: '' }));
        body.append('map', JSON.stringify({ 1: ['variables.file'] }));
        body.append('1', 'a', { filename: 'a.txt' });

        await fetch(`http://localhost:${port}`, { method: 'POST', body });

        if (serverError) throw serverError;
      } finally {
        close();
      }
    }
  );
};
