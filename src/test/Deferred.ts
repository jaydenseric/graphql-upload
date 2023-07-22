/**
 * A deferred promise that can be externally resolved or rejected.
 * @template [Resolves=void] What the promise resolves.
 */
export class Deferred {
  promise: Promise<any>;
  resolve: ((value: any) => void) | undefined;
  reject: ((reason?: any) => void) | undefined;

  constructor() {
    /** The promise. */
    this.promise = (
      new Promise((resolve, reject) => {
        /** Resolves the promise. */
        this.resolve = resolve;

        /** Rejects the promise. */
        this.reject = reject;
      })
    );
  }
}
