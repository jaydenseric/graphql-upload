'use strict'

/**
 * Starts a Node.js HTTP server.
 * @kind function
 * @name listen
 * @param {object} server Node.js HTTP server.
 * @returns {Promise<{port: number, close: Function}>} Resolves the port the server is listening on, and a server close function.
 * @ignore
 */
module.exports = function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(function(error) {
      if (error) reject(error)
      else
        resolve({
          port: this.address().port,
          close: () => this.close()
        })
    })
  })
}
