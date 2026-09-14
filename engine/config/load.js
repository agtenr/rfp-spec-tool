// Dossier configuration loader. The engine never embeds a dossier value (AR-02); a dossier
// is supplied at runtime. In the browser, load from a served file over http (fetch); ES modules
// + fetch require an http origin, not file:// — see the `serve` skill.
// See .claude/rules/engine-architecture.md and .claude/rules/frontend-ui.md.
//
// Config JSON uses camelCase keys mapping 1:1 to the HLD §3 snake_case data contract
// (e.g. calculationPrecision ↔ calculation_precision, pricePointsMax ↔ price_points_max).

export async function fetchDossier(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load dossier config from ${url}: HTTP ${res.status}`);
  return res.json();
}

// Accept an already-parsed config object (used by tests and by the app after fetch).
// Returns the config unchanged — validation and Money construction happen downstream so that
// a config that fails validation is still inspectable.
export function loadDossier(config) {
  if (!config || typeof config !== 'object') throw new Error('dossier config must be an object');
  return config;
}
