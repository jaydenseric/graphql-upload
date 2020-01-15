'use strict'

const { TestDirector } = require('test-director')

const tests = new TestDirector()

require('./lib/graphqlUploadExpress.test')(tests)
require('./lib/graphqlUploadKoa.test')(tests)
require('./lib/processRequest.test')(tests)

tests.run()
