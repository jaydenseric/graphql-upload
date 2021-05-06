import { Readable } from 'stream';

/**
 * A count readable stream, for testing purposes.
 * @kind class
 * @name CountReadableStream
 * @see [Example counting stream in the Node.js docs](https://nodejs.org/api/stream.html#stream_an_example_counting_stream).
 * @ignore
 */
export default class CountReadableStream extends Readable {
  constructor(options) {
    super(options);
    this._max = 1000000;
    this._index = 1;
  }

  _read() {
    const i = this._index++;
    this.push(i > this._max ? null : Buffer.from(String(i), 'ascii'));
  }
}
