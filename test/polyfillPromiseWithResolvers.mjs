// @ts-check

// TODO: Delete this polyfill once all supported Node.js versions implement
// `Promise.withResolvers`.
Promise.withResolvers ??= () => new PromiseWithResolversReturn();

/**
 * A promise with resolvers.
 * @template T
 * @implements {PromiseWithResolvers<T>}
 */
class PromiseWithResolversReturn {
  constructor() {
    /** @type {Promise<T>} */
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
