/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
export default function compactObject<T extends object>(x: T): T {
  const result: T = { ...x };
  for (const [k, v] of Object.entries(result))
    if (v === undefined || v === null) delete (result as any)[k];
  return result;
}
