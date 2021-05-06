import TestDirector from 'test-director';
import testIgnoreStream from './private/ignoreStream.test.mjs';
import testGraphQLUpload from './public/GraphQLUpload.test.mjs';
import testUpload from './public/Upload.test.mjs';
import testGraphqlUploadExpress from './public/graphqlUploadExpress.test.mjs';
import testGraphqlUploadKoa from './public/graphqlUploadKoa.test.mjs';
import testProcessRequest from './public/processRequest.test.mjs';

const tests = new TestDirector();

testIgnoreStream(tests);
testGraphQLUpload(tests);
testGraphqlUploadExpress(tests);
testGraphqlUploadKoa(tests);
testProcessRequest(tests);
testUpload(tests);

tests.run();
