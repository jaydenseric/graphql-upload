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
    app.listen(undefined, 'localhost', function(error) {
      if (error) reject(error)
      else {
        t.tearDown(() => this.close())
        resolve(this.address().port)
      }
    })
  })
