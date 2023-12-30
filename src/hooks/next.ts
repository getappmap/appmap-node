import assert from "node:assert";
import { pathToFileURL } from "node:url";

import { ancestor as walk } from "acorn-walk";
import { ESTree } from "meriyah";

import { assignment, call_, identifier, literal, member, memberId } from "../generate";
import genericTransform from "../transform";

// TODO: We need to patch babel as well for older or babel configured projects.
// Probable place is: ...node_modules/next/dist/compiled/babel/bundle.js.
export function shouldInstrument(url: URL): boolean {
  return url.href.endsWith("node_modules/next/dist/build/webpack/loaders/next-swc-loader.js");
}

export function shouldIgnore(url: URL): boolean {
  return url.href.includes("/.next/");
}

export function transform(program: ESTree.Program): ESTree.Program {
  walk(program, {
    FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
      if (fun.id?.name === "loaderTransform") {
        const funReturn = fun.body?.body.findLast(() => true);
        assert(funReturn);
        assert(funReturn.type == "ReturnStatement");
        /* funReturn is this return statement below in loaderTransform. 
           We insert the new statement marked with +.
        --
            return swcSpan.traceAsyncFn(() =>
              transform(source as any, programmaticOptions).then((output) => {
                if (output.eliminatedPackages && this.eliminatedPackages) {
                  for (const pkg of JSON.parse(output.eliminatedPackages)) {
                    this.eliminatedPackages.add(pkg)
                  }
                }
              + output.code = require(.../next.js).transformCode(output.code, programmaticOptions.code);
                return [output.code, output.map ? JSON.parse(output.map) : undefined]
              })
            )
        --
        */
        assert(funReturn.argument?.type == "CallExpression"); // swcSpan.traceAsyncFn(...
        assert(funReturn.argument.arguments[0].type == "ArrowFunctionExpression");
        assert(funReturn.argument.arguments[0].body.type == "CallExpression"); // transform(source...
        assert(funReturn.argument.arguments[0].body.arguments[0].type == "ArrowFunctionExpression"); // (output) =>...
        assert(funReturn.argument.arguments[0].body.arguments[0].body.type == "BlockStatement");
        const innerStatements = funReturn.argument.arguments[0].body.arguments[0].body.body; // [if..., return...]

        const transformCodeStatement = assignment(
          memberId("output", "code"),
          call_(
            member(
              call_(identifier("require"), literal(__filename)),
              identifier(transformCode.name),
            ),
            memberId("output", "code"),
            memberId("programmaticOptions", "filename"),
          ),
        );
        // insert it just before return
        innerStatements.splice(innerStatements.length - 2, 0, transformCodeStatement);
      }
    },
  });
  return program;
}

export function transformCode(code: string, path: string): string {
  const url = pathToFileURL(path);
  const transformedCode = genericTransform(code, url);
  return transformedCode;
}
