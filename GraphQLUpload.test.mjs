// @ts-check

import { doesNotThrow, ok, strictEqual, throws } from "node:assert";
import { suite, test } from "node:test";

import { GraphQLScalarType, parseValue } from "graphql";

import GraphQLUpload from "./GraphQLUpload.mjs";
import Upload from "./Upload.mjs";

suite(
  "GraphQL scalar `GraphQLUpload`.",
  {
    concurrency: true,
  },
  () => {
    test("Is a GraphQL scalar.", () => {
      ok(GraphQLUpload instanceof GraphQLScalarType);
      strictEqual(GraphQLUpload.name, "Upload");
    });

    test("Method `parseValue`, value valid.", () => {
      doesNotThrow(() => {
        GraphQLUpload.parseValue(new Upload());
      });
    });

    test("Method `parseValue`, value invalid.", () => {
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

    test("Method `parseLiteral`.", () => {
      throws(
        () => {
          // The dummy value is irrelevant.
          GraphQLUpload.parseLiteral(parseValue('""'), {});
        },
        {
          name: "GraphQLError",
          message: "Upload literal unsupported.",
          locations: [{ line: 1, column: 1 }],
        },
      );
    });

    test("Method `serialize`.", () => {
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
