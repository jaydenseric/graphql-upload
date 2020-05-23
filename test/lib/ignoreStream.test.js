'use strict';

const { doesNotThrow, strictEqual } = require('assert');
const { Readable } = require('stream');
const ignoreStream = require('../../lib/ignoreStream');

module.exports = (tests) => {
  tests.add('`ignoreStream` ignores errors.', () => {
    doesNotThrow(() => {
      const stream = new Readable();
      ignoreStream(stream);
      stream.emit('error', new Error('Message.'));
    });
  });

  tests.add('`ignoreStream` resumes a paused stream.', () => {
    const stream = new Readable();
    stream.pause();
    ignoreStream(stream);
    strictEqual(stream.isPaused(), false);
  });
};
