'use strict';

const { doesNotThrow, strictEqual } = require('assert');
const ignoreStream = require('../../private/ignoreStream');
const CountReadableStream = require('../CountReadableStream');

module.exports = (tests) => {
  tests.add('`ignoreStream` ignores errors.', () => {
    doesNotThrow(() => {
      const stream = new CountReadableStream();
      ignoreStream(stream);
      stream.emit('error', new Error('Message.'));
    });
  });

  tests.add('`ignoreStream` resumes a paused stream.', () => {
    const stream = new CountReadableStream();
    stream.pause();
    ignoreStream(stream);
    strictEqual(stream.isPaused(), false);
  });
};
