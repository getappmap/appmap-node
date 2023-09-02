import * as gen from "./generate";
import { record } from "./recorder";
import { transformJest } from "./hooks/jest";
import { ESTree } from "meriyah";

const gAppMap = {
  record,
  transformJest,
} as const;

declare global {
  // eslint-disable-next-line no-var
  var AppMap: typeof gAppMap;
}

global.AppMap = gAppMap;
const AppMap = gen.member(...["global", "AppMap"].map(gen.identifier));

const symbols = Object.fromEntries(
  Object.keys(gAppMap).map((k) => [k, gen.member(AppMap, gen.identifier(k))]),
) as Record<keyof typeof gAppMap, ESTree.MemberExpression>;

export default symbols;
