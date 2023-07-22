import { parseValue } from "graphql";
import { GraphQLUpload } from "./GraphQLUpload";
import { Upload } from "./Upload";
import { describe, expect, it } from 'vitest'


describe("GraphQLUpload", () => {
  it("`GraphQLUpload` scalar `parseValue` with a valid value.", () => {
    expect(() => GraphQLUpload.parseValue(new Upload())).not.toThrowError();
  });
  it("`GraphQLUpload` scalar `parseValue` with an invalid value.", () => {
    expect(() => GraphQLUpload.parseValue(true)).toThrow("Upload value invalid.");
  });
  it("`GraphQLUpload` scalar `parseLiteral`.", () => {
    expect(() => GraphQLUpload.parseLiteral(parseValue('""'))).toThrowError("Upload literal unsupported.");
  });
  it("`GraphQLUpload` scalar `serialize`.", () => {
    expect(() => GraphQLUpload.serialize("")).toThrowError("Upload serialization unsupported.");
  });
});