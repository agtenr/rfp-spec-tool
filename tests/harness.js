// Tiny zero-dependency assertion harness for the browser test page (tests.html) and Node.
// See .claude/rules/testing.md.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'not equal'} — expected ${JSON.stringify(String(expected))}, got ${JSON.stringify(String(actual))}`);
  }
}

export async function run(logger = console.log) {
  const results = [];
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      results.push({ name: t.name, ok: true });
      logger(`  PASS  ${t.name}`);
    } catch (e) {
      failed++;
      results.push({ name: t.name, ok: false, error: e.message });
      logger(`  FAIL  ${t.name}\n        ${e.message}`);
    }
  }
  logger(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  return { passed, failed, total: tests.length, results };
}

// Load JSON relative to this module — fetch in the browser, fs in Node.
export async function loadJson(relPath) {
  const url = new URL(relPath, import.meta.url);
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to load ${url}: HTTP ${res.status}`);
    return res.json();
  }
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(url, 'utf8'));
}
