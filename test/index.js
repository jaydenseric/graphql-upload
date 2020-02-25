'use strict'

const { TestDirector } = require('test-director')

const tests = new TestDirector()

require('./lib/GraphQLUpload.test')(tests)
require('./lib/graphqlUploadExpress.test')(tests)
require('./lib/graphqlUploadKoa.test')(tests)
require('./lib/ignoreStream.test')(tests)
require('./lib/processRequest.test')(tests)
require('./lib/Upload.test')(tests)
require('./lib/processRequestLambda.test')(tests)

tests.run()
