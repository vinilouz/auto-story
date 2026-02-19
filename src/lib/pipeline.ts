export const pipe = <T, R>(...fns: Array<(arg: any) => any>) =>
  (initialValue: T): Promise<R> =>
    fns.reduce(async (accPromise, fn) => {
      const acc = await accPromise
      return fn(acc)
    }, Promise.resolve(initialValue))