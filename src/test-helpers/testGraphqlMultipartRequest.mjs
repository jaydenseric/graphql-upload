import FormData from 'form-data'
import fetch from 'node-fetch'

/**
 * Sends a test GraphQL multipart request, uploading a single small file.
 * @param {number} port Localhost port to fetch.
 * @returns {Promise<Response>} Fetch response.
 */
export const testGraphqlMultipartRequest = port => {
  const body = new FormData()

  body.append('operations', '{ "variables": { "file": null } }')
  body.append('map', '{ "1": ["variables.file"] }')
  body.append('1', 'a', { filename: 'a.txt' })

  return fetch(`http://localhost:${port}`, { method: 'POST', body })
}
