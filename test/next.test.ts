import { integrationTest } from "./helpers";
import testNextApp from "./nextApp";

integrationTest("mapping a Next.js appmap", testNextApp, 60000);
