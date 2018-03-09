import { GraphQLScalarType } from 'graphql'

export const createUploadType = ({ name = 'Upload' } = {}) => {
  return new GraphQLScalarType({
    name,
    description:
      'The `' +
      name +
      '` scalar type represents a file upload promise that resolves ' +
      'an object containing `stream`, `filename`, `mimetype` and `encoding`.',
    parseValue: value => value,
    parseLiteral() {
      throw new Error('Upload scalar literal unsupported')
    },
    serialize() {
      throw new Error('Upload scalar serialization unsupported')
    }
  })
}

export const GraphQLUpload = createUploadType()
