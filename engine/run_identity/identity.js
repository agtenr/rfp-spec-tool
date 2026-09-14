// Run identity + input hashing (HLD §3.2, SC-08, IN-06). input_hash is SHA-256 (Web Crypto)
// over a canonical JSON of the inputs, so identical inputs produce an identical hash and identical
// results. Requires a secure context / localhost (the `serve` skill provides http).
// See .claude/rules/award-simulator-domain.md.

export const ENGINE_VERSION = '0.1.0-gate1';

// Deterministic JSON with object keys sorted recursively.
export function canonicalJSON(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeys(value[k]);
        return acc;
      }, {});
  }
  return value;
}

export async function computeInputHash(config) {
  const bytes = new TextEncoder().encode(canonicalJSON(config));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function makeRunId() {
  const rand = (globalThis.crypto?.getRandomValues)
    ? [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 10);
  return `run-${Date.now().toString(36)}-${rand}`;
}
