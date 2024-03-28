import type { ESTree } from "meriyah";

import config from "../config";
import { record } from "../recorder";
import { FunctionInfo } from "../registry";
import { setCustomInspect } from "../parameter";

type F = (...args: unknown[]) => unknown;
type FunctionOwner = Record<string, unknown>;

// keep track of proxied functions to avoid double-wrapping
const proxiedFunctions = new WeakSet<F>();

export default function librariesHook(mod: unknown, id: string) {
  function wrapFunction(owner: FunctionOwner, key: string) {
    if (config.getPackage(id, true)?.exclude?.includes(key)) return;

    const f = owner[key] as F;
    if (!proxiedFunctions.has(f)) {
      const proxy = createProxy(f, id);
      owner[key] = proxy;
      proxiedFunctions.add(f);
    }
  }

  if (typeof mod === "object" && mod !== null) {
    setCustomInspect(mod, () => "[" + id + "]");
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
            wrapFunction(member.prototype as FunctionOwner, methodName);
        }
      }
    }
    return mod;
  }
}

function createProxy(f: F, moduleId: string) {
  const proxy = new Proxy(f, {
    apply(target, thisArg, argArray: Parameters<F>) {
      return record.call(thisArg, target, argArray, getFunctionInfo(moduleId, f), true);
    },
  });
  return proxy;
}

librariesHook.applicable = function (id: string) {
  return config.packages.matchLibrary(id) != undefined;
};

const functionInfos = new Map<string, FunctionInfo>();

let functionCount = 0;
function getFunctionInfo(moduleId: string, f: F) {
  const key = `${moduleId}:${f.name}`;

  if (!functionInfos.has(key)) {
    const params = Array(f.length).map((i) => {
      return { type: "Identifier", name: `arg${i}` } as ESTree.Identifier;
    });
    const info: FunctionInfo = {
      async: true,
      generator: false,
      id: f.name,
      params: params,
      location: { path: `${moduleId}`, lineno: ++functionCount },
      klassOrFile: moduleId,
      static: true,
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
