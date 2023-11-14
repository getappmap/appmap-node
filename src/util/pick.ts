export default function pick<T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> {
  const filtered = Object.entries(obj).filter(([k]) => keys.includes(k as K)) as [K, unknown][];
  return Object.fromEntries(filtered) as Pick<T, K>;
}
