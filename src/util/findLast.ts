export default function findLast<T, P extends (v: T) => boolean>(
  array: readonly T[],
  predicate: P,
): PredResult<P, T> | undefined {
  let i = array.length;

  while (i > 0) {
    const x = array[--i];
    if (predicate(x)) return x as PredResult<P, T>;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PredResult<P, T> = P extends (v: any) => v is infer R ? R : T;
