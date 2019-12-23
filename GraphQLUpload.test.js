const {
  GraphQLString,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLBoolean,
  execute,
  parse
} = require('graphql')
const t = require('tap')
const GraphQLUpload = require('./GraphQLUpload')
const snapshotError = require('./test-helpers/snapshotError')

t.test('Missing entry for upload scalar.', async t => {
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        image: {
          description: 'Uploads an image.',
          type: GraphQLString,
          args: {
            name: {
              description: 'Image name.',
              type: GraphQLString
            }
          },
          async resolve(parent, { image }) {
            t.type(image, Promise, 'Upload must be a Promise')
            try {
              await image
              throw new Error('Upload must throw!')
            } catch (error) {
              t.matchSnapshot(snapshotError(error), 'Middleware throws.')
            }

            return true
          }
        }
      }
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        uploadImage: {
          description: 'Uploads an image.',
          type: GraphQLBoolean,
          args: {
            image: {
              description: 'Image file.',
              type: GraphQLUpload
            }
          },
          async resolve(parent, { image }) {
            t.type(image, Promise, 'Upload must be a Promise')
            try {
              await image
              throw new Error('Upload must throw!')
            } catch (error) {
              t.matchSnapshot(snapshotError(error), 'Middleware throws.')
            }

            return true
          }
        }
      }
    })
  })

  await execute({
    schema,
    document: parse(
      `mutation ($image: Upload!) {
        uploadImage(image: $image)
      }`
    ),
    rootValue: {},
    contextValue: {},
    variableValues: { image: 'this is invalid' }
  })
})
