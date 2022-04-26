import TestDirector from "test-director";

import test_ignoreStream from "./private/ignoreStream.test.mjs";
import test_GraphQLUpload from "./public/GraphQLUpload.test.mjs";
import test_graphqlUploadExpress from "./public/graphqlUploadExpress.test.mjs";
import test_graphqlUploadKoa from "./public/graphqlUploadKoa.test.mjs";
import test_processRequest from "./public/processRequest.test.mjs";
import test_Upload from "./public/Upload.test.mjs";

const tests = new TestDirector();

test_ignoreStream(tests);
test_GraphQLUpload(tests);
test_graphqlUploadExpress(tests);
test_graphqlUploadKoa(tests);
test_processRequest(tests);
test_Upload(tests);

tests.run();
