// @ts-check

import { doesNotThrow, throws } from "node:assert";
import { describe, it } from "node:test";

import { parseValue } from "graphql";

import GraphQLUpload from "./GraphQLUpload.mjs";
import Upload from "./Upload.mjs";

describe(
  "GraphQL scalar `GraphQLUpload`.",
  {
    concurrency: true,
  },
  () => {
    it("Method `parseValue`, value valid.", () => {
      doesNotThrow(() => {
        GraphQLUpload.parseValue(new Upload());
      });
    });

    it("Method `parseValue`, value invalid.", () => {
      throws(
        () => {
          GraphQLUpload.parseValue(true);
        },
        {
          name: "GraphQLError",
          message: "Upload value invalid.",
        },
      );
    });

    it("Method `parseLiteral`.", () => {
      throws(
        () => {
          // The dummy value is irrelevant.
          GraphQLUpload.parseLiteral(parseValue('""'));
        },
        {
          name: "GraphQLError",
          message: "Upload literal unsupported.",
          locations: [{ line: 1, column: 1 }],
        },
      );
    });

    it("Method `serialize`.", () => {
      throws(
        () => {
          // The dummy value is irrelevant.
          GraphQLUpload.serialize("");
        },
        {
          name: "GraphQLError",
          message: "Upload serialization unsupported.",
        },
      );
    });
  },
);
