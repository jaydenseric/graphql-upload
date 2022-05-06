// @ts-check

/**
 * A deferred promise that can be externally resolved or rejected.
 * @template [Resolves=void] What the promise resolves.
 */
export default class Deferred {
  constructor() {
    /** The promise. */
    this.promise = /** @type {Promise<Resolves>} */ (
      new Promise((resolve, reject) => {
        /** Resolves the promise. */
        this.resolve = resolve;

        /** Rejects the promise. */
        this.reject = reject;
      })
    );
  }
}
