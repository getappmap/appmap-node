import { parse } from "meriyah";

import config from "../config";
import { identifier } from "../generate";
import { setCustomInspect } from "../parameter";
import { record } from "../recorder";
import { FunctionInfo, stripLocation } from "../registry";

type F = (...args: unknown[]) => unknown;
type FunctionOwner = Record<string, unknown>;

// keep track of proxied functions to avoid double-wrapping
const proxiedFunctions = new WeakSet<F>();

export default function librariesHook(mod: unknown, id: string) {
  // Normalize id for built-in modules in the entry point to avoid both
  // "node:console" and "console", for example, spreading around.
  const moduleId = id.replace(/^node:/, "");
  function wrapFunction(owner: FunctionOwner, key: string, klass?: string) {
    if (config.getPackage(moduleId, true)?.exclude?.includes(key)) return;

    const f = owner[key] as F;
    if (!proxiedFunctions.has(f)) {
      const proxy = createProxy(f, moduleId, klass);
      owner[key] = proxy;
      proxiedFunctions.add(proxy);
    }
  }

  if (typeof mod === "object" && mod !== null) {
    setCustomInspect(mod, () => "[" + moduleId + "]");
    for (const key in mod) {
      const member = (mod as FunctionOwner)[key];
      if (typeof member === "function") {
        wrapFunction(mod as FunctionOwner, key);
        if (member.prototype && typeof member.prototype == "object") {
          // If it's a class declaration we should instrument it's methods.
          // TODO: Clarify if we have to consider inherited methods too?
          //       Up until Object?
          const methodNames = getMethodNames(member.prototype as FunctionOwner);
          for (const methodName of methodNames)
            wrapFunction(member.prototype as FunctionOwner, methodName, member.name);
        }
      }
    }
    return mod;
  }
}

function createProxy(f: F, moduleId: string, klass?: string) {
  const proxy = new Proxy(f, {
    apply(target, thisArg, argArray: Parameters<F>) {
      return record.call(thisArg, target, argArray, getFunctionInfo(f, moduleId, klass), true);
    },
  });
  return proxy;
}

librariesHook.applicable = function (id: string) {
  return config.getPackage(id, true) != undefined;
};

const functionInfos = new Map<string, FunctionInfo>();

function parseParams(f: F) {
  try {
    const program = parse(f.toString());
    if (program.body.length > 0 && "params" in program.body[0])
      return program.body[0].params.map(stripLocation);
  } catch {
    // Can't parse [native code]
  }
}

let functionCount = 0;
function getFunctionInfo(f: F, moduleId: string, klass?: string) {
  const key = `${moduleId}:${f.name}`;

  if (!functionInfos.has(key)) {
    const info: FunctionInfo = {
      async: false,
      generator: false,
      id: f.name,
      params: parseParams(f) ?? Array(f.length).map((i) => identifier(`arg${i}`)),
      location: { path: `${moduleId}`, lineno: ++functionCount },
      klassOrFile: moduleId + (klass ? "." + klass : ""),
      static: false,
    };
    functionInfos.set(key, info);
  }

  return functionInfos.get(key)!;
}

// Based on https://code.fitness/post/2016/01/javascript-enumerate-methods.html
function getMethodNames(functionPrototype: FunctionOwner, recursive?: boolean) {
  function hasMethod(obj: object, name: string) {
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    return !!desc && typeof desc.value === "function";
  }

  const result: string[] = [];
  let proto: unknown = functionPrototype;
  while (proto) {
    Object.getOwnPropertyNames(proto).forEach((name) => {
      if (name !== "constructor") {
        if (hasMethod(proto as FunctionOwner, name)) {
          result.push(name);
        }
      }
    });
    if (!recursive) break;
    proto = Object.getPrototypeOf(proto) as unknown;
  }
  return result;
}
