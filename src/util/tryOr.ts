export default function tryOr<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
}
