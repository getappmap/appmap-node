interface LazyOpt<T> {
  (): T | undefined;
  then<U>(fn: (x: T) => U | undefined): LazyOpt<U>;
}

export default function lazyOpt<T>(fn: () => T | undefined): LazyOpt<T> {
  let evaluated = false;
  let value: T | undefined;
  const opt: LazyOpt<T> = () => {
    if (evaluated) return value;
    value = fn();
    evaluated = true;
    return value;
  };
  opt.then = <U>(fn: (x: T) => U | undefined) => lazyOpt(() => opt() && fn(opt()!));
  return opt;
}
