export default function tryOr<T, E = undefined>(fn: () => T, elseReturn?: E): T | E | undefined {
  try {
    return fn();
  } catch (e) {
    return elseReturn;
  }
}
