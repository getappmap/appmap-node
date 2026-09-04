import { integrationTest } from "./helpers";
import testNextApp from "./nextApp";

// Next.js 16 requires Node.js >= 20.9.0
const nodeSupported = (() => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 20 || (major === 20 && minor >= 9);
})();

// Turbopack (the default bundler in Next.js 16) respects webpack loaders configured
// via next.config turbopack.rules, which we inject in src/hooks/next.ts.
integrationTest.if(nodeSupported)("mapping a Next.js 16 appmap", testNextApp, 60000);
