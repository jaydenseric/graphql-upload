// @ts-check

// Todo: Delete this polyfill once all supported Node.js versions implement
// `Request.prototype.bytes`.
Request.prototype.bytes ??= async function bytes() {
  return new Uint8Array(await this.arrayBuffer());
};
