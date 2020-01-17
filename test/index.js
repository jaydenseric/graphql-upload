'use strict'

const { TestDirector } = require('test-director')

const tests = new TestDirector()

require('./lib/graphqlUploadExpress.test')(tests)
require('./lib/graphqlUploadKoa.test')(tests)
require('./lib/ignoreStream.test')(tests)
require('./lib/processRequest.test')(tests)
require('./lib/Upload.test')(tests)

tests.run()
