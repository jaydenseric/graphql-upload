'use strict';

const { TestDirector } = require('test-director');

const tests = new TestDirector();

require('./private/ignoreStream.test')(tests);
require('./public/GraphQLUpload.test')(tests);
require('./public/graphqlUploadExpress.test')(tests);
require('./public/graphqlUploadKoa.test')(tests);
require('./public/processRequest.test')(tests);
require('./public/Upload.test')(tests);

tests.run();
