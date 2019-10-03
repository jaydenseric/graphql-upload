/**
 * Asynchronously starts a server and automatically closes it when the given
 * test tears down.
 * @kind function
 * @name startServer
 * @param {Test} t Tap test.
 * @param {object} app A Koa or Express app.
 * @returns {Promise<number>} The port the server is listening on.
 * @ignore
 */
export const startServer = (t, app) =>
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
