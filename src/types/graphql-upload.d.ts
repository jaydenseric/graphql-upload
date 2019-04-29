declare module 'graphql-upload' {
  import { RequestHandler as ExpressRequestHandler } from 'express'
  export const GraphQLUpload: GraphQLScalarType
  export interface UploadOptions {
    maxFieldSize?: number
    maxFileSize?: number
    maxFiles?: number
  }
  export const processRequest: (
    request: IncomingMessage,
    response: ServerResponse,
    uploadOptions?: UploadOptions
  ) => Promise<any>
  export const graphqlUploadExpress: (
    uploadOptions?: UploadOptions
  ) => ExpressRequestHandler
  export const graphqlUploadKoa: <StateT = any, CustomT = {}>(
    uploadOptions?: UploadOptions
  ) => Middleware<StateT, CustomT>
}
