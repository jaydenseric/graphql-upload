// @ts-check

import { doesNotThrow, throws } from "assert";
import { parseValue } from "graphql";

import GraphQLUpload from "./GraphQLUpload.js";
import Upload from "./Upload.js";

/**
 * Adds `GraphQLUpload` tests.
 * @param {import("test-director").default} tests Test director.
 */
export default (tests) => {
  tests.add("`GraphQLUpload` scalar `parseValue` with a valid value.", () => {
    doesNotThrow(() => {
      GraphQLUpload.parseValue(new Upload());
    });
  });

  tests.add(
    "`GraphQLUpload` scalar `parseValue` with an invalid value.",
    () => {
      throws(
        () => {
          GraphQLUpload.parseValue(true);
        },
        {
          name: "GraphQLError",
          message: "Upload value invalid.",
        }
      );
    }
  );

  tests.add("`GraphQLUpload` scalar `parseLiteral`.", () => {
    throws(
      () => {
        // The dummy value is irrelevant.
        GraphQLUpload.parseLiteral(parseValue('""'));
      },
      {
        name: "GraphQLError",
        message: "Upload literal unsupported.",
        locations: [{ line: 1, column: 1 }],
      }
    );
  });

  tests.add("`GraphQLUpload` scalar `serialize`.", () => {
    throws(
      () => {
        // The dummy value is irrelevant.
        GraphQLUpload.serialize("");
      },
      {
        name: "GraphQLError",
        message: "Upload serialization unsupported.",
      }
    );
  });
};
