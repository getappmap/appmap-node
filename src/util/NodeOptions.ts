export default class NodeOptions extends Array {
  constructor(value?: string) {
    super();
    if (!value) return;
    if (typeof value !== "string") throw new Error("NODE_OPTIONS must be a string");

    this.push(...parseNodeOptionsEnvVar(value));
  }

  toString(): string {
    return this.map(maybeQuote).join(" ");
  }

  static get [Symbol.species]() {
    return Array;
  }
}

// based on ParseNodeOptionsEnvVar()
// https://github.com/nodejs/node/blob/39f1b899cd536de4d4c9bbf56f24927d8d06999a/src/node_options.cc#L1397
function parseNodeOptionsEnvVar(nodeOptions: string): string[] {
  const result: string[] = [];
  let buffer = "";
  let inString = false;
  for (let i = 0; i < nodeOptions.length; i++) {
    let c = nodeOptions[i];
    if (c === "\\" && inString) {
      if (i + 1 === nodeOptions.length) break;
      c = nodeOptions[++i];
    } else if (c === " " && !inString) {
      result.push(buffer);
      buffer = "";
      continue;
    } else if (c === '"') {
      inString = !inString;
      continue;
    }

    buffer += c;
  }

  result.push(buffer);
  return result;
}

function maybeQuote(value: string): string {
  if (value.includes(" ")) return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  return value;
}
