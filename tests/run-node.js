// Node entry point for the §9 suite — runs the same tests as tests.html, headless, for CI/dev.
// Usage: node tests/run-node.js  (Node 18+, for BigInt, structuredClone and crypto.subtle).

import './golden.test.js';
import './invariants.test.js';
import './boundary.test.js';
import './ambiguity-envelope.test.js';
import './reporters.test.js';
import { run } from './harness.js';

const { failed } = await run();
process.exit(failed ? 1 : 0);
