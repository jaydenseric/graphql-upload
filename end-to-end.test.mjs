// @ts-check

/**
 * @import { GraphQLFieldConfig } from "graphql/type"
 * @import { FileUpload } from "./processRequest.mjs"
 */

import { deepStrictEqual } from "node:assert";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";
import { suite, test } from "node:test";

import { listen } from "async-listen";
import { graphql } from "graphql";
import {
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql/type";

import GraphQLUpload from "./GraphQLUpload.mjs";
import processRequest from "./processRequest.mjs";
import serverClose from "./test-helpers/serverClose.mjs";

suite(
  "End-to-end.",
  {
    concurrency: true,
  },
  () => {
    test("A GraphQL multipart request with a file upload.", async () => {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: "Query",
          fields: {
            inspectFile:
              /**
               * @satisfies {GraphQLFieldConfig<unknown, unknown, {
               *   file: Promise<FileUpload>,
               * }>}
               */
              ({
                description:
                  "Inspects a given file, resolving the file properties as JSON.",
                type: GraphQLString,
                args: {
                  file: {
                    description: "File to inspect.",
                    type: new GraphQLNonNull(GraphQLUpload),
                  },
                },
                async resolve(_parent, { file }) {
                  const { filename, mimetype, encoding, createReadStream } =
                    await file;

                  return JSON.stringify({
                    filename,
                    mimetype,
                    encoding,
                    content: await text(createReadStream()),
                  });
                },
              }),
          },
        }),
      });

      let serverError;

      const server = createServer(async (request, response) => {
        try {
          const operation =
            /**
             * @type {{
             *   query: string,
             *   variables: {
             *     [name: string]: unknown,
             *   },
             * }}
             */
            (await processRequest(request, response));

          const result = await graphql({
            schema,
            source: operation.query,
            variableValues: operation.variables,
          });

          const json = JSON.stringify(result);

          response.end(json);
        } catch (error) {
          serverError = error;
          response.end();
        }
      });

      const url = await listen(server);

      try {
        const fileProperties = {
          filename: "a.txt",
          mimetype: "text/plain",
          encoding: "7bit",
          content: "a",
        };
        const body = new FormData();

        body.append(
          "operations",
          JSON.stringify({
            query: /* GraphQL */ `
              query ($file: Upload!) {
                inspectFile(file: $file)
              }
            `,
            variables: {
              file: null,
            },
          }),
        );
        body.append("map", JSON.stringify({ 1: ["variables.file"] }));
        body.append(
          "1",
          new File([fileProperties.content], fileProperties.filename, {
            type: fileProperties.mimetype,
          }),
        );

        const response = await fetch(url, { method: "POST", body });

        if (serverError) throw serverError;

        deepStrictEqual(await response.json(), {
          data: {
            inspectFile: JSON.stringify(fileProperties),
          },
        });
      } finally {
        await serverClose(server);
      }
    });
  },
);
