// This is for testing the fix of this bug: https://github.com/getappmap/appmap-node/issues/45.
// InspectError.message property gets transformed and node:util.inspect() calls it recursively
// leading to "RangeError: Maximum call stack size exceeded" while recording transformed function
// f itself. Recording should be paused while doing inspect().
function f() {
  const e = new InspectError();
  e.stack = ""; // We don't want to include call stack in the appmap
  return e;
}

class InspectError extends Error {
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get message() {
    return "Inspect Error";
  }
}

f();
