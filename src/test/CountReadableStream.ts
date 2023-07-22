import { Readable, ReadableOptions } from "stream";

/**
 * A count readable stream, for testing purposes.
 * @see [Example counting stream in the Node.js docs](https://nodejs.org/api/stream.html#an-example-counting-stream).
 */
export class CountReadableStream extends Readable {
  _max: number;
  _index: number;
  constructor(options: ReadableOptions) {
    super(options);
    this._max = 1000000;
    this._index = 1;
  }

  _read() {
    const i = this._index++;
    this.push(i > this._max ? null : Buffer.from(String(i), "ascii"));
  }
}
