// @ts-check

import { doesNotThrow, ok, strictEqual, throws } from "node:assert";
import { suite, test } from "node:test";

import { GraphQLScalarType, parseConstValue } from "graphql";

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

    test("Method `coerceInputValue`, value valid.", () => {
      doesNotThrow(() => {
        GraphQLUpload.coerceInputValue(new Upload());
      });
    });

    test("Method `coerceInputValue`, value invalid.", () => {
      throws(
        () => {
          GraphQLUpload.coerceInputValue(true);
        },
        {
          name: "GraphQLError",
          message: "Upload value invalid.",
        },
      );
    });

    test("Method `coerceInputLiteral`.", () => {
      const { coerceInputLiteral } = GraphQLUpload;

      ok(coerceInputLiteral);
      throws(
        () => {
          // The dummy value is irrelevant.
          coerceInputLiteral(parseConstValue('""'));
        },
        {
          name: "GraphQLError",
          message: "Upload literal unsupported.",
          locations: [{ line: 1, column: 1 }],
        },
      );
    });

    test("Method `coerceOutputValue`.", () => {
      throws(
        () => {
          // The dummy value is irrelevant.
          GraphQLUpload.coerceOutputValue("");
        },
        {
          name: "GraphQLError",
          message: "Upload serialization unsupported.",
        },
      );
    });
  },
);
