// Machine-readable reporter (HLD §6.2): one CSV row per ScenarioResult, columns in §3.7 order,
// sorted by population state, then reading set, then descending total score; excluded rows sort
// last with empty rank and total. See .claude/rules/frontend-ui.md.

import { fmtMoney, fmtPoints, fmtRaw } from './format.js';

const COLUMNS = [
  'run_id', 'dossier_id', 'configuration_version', 'engine_version', 'own_variant',
  'competitive_field', 'population_state', 'reading_set', 'comparison_price',
  'cost_contributions', 'segment_contributions', 'reference_price', 'price_score_raw',
  'price_score', 'quality_contributions', 'quality_score', 'exclusion_status', 'total_score',
  'rank', 'score_margin', 'envelope_status', 'validation_gate', 'warnings',
];

export function toCsv(result, config) {
  const { run, scenarioResults } = result;
  const stateOrder = new Map((config.populationStates || []).map((s, i) => [s.id, i]));
  const rows = sortRows(scenarioResults, stateOrder);
  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    const record = {
      run_id: run.runId,
      dossier_id: run.dossierId,
      configuration_version: run.configurationVersion,
      engine_version: run.engineVersion,
      own_variant: r.kind === 'variant' ? r.ref : '',
      competitive_field: r.fieldId,
      population_state: r.populationStateId,
      reading_set: r.readingLabel,
      comparison_price: fmtMoney(r.comparisonPrice, config),
      cost_contributions: r.costContributions.map((c) => `${c.componentId}=${fmtMoney(c.money, config)}`).join('; '),
      segment_contributions: r.segmentContributions.map((s) => `${s.segmentId}=${fmtMoney(s.money, config)}`).join('; '),
      reference_price: fmtMoney({ minor: r.referencePriceMinor, currency: config.currency }, config),
      price_score_raw: fmtRaw(r.priceScoreRawScaled, r.priceScoreRawScale),
      price_score: fmtPoints(r.priceScoreScaled, config),
      quality_contributions: r.qualityContributions.map((q) => `${q.criterionId}=${fmtPoints(q.scaled, config)}`).join('; '),
      quality_score: fmtPoints(r.qualityScoreScaled, config),
      exclusion_status: r.exclusionStatus,
      total_score: fmtPoints(r.totalScaled, config),
      rank: r.rank ?? '',
      score_margin: fmtPoints(r.marginScaled, config),
      envelope_status: r.envelopeStatus,
      validation_gate: run.validationGate,
      warnings: run.warnings.join('; '),
    };
    lines.push(COLUMNS.map((c) => csvEscape(record[c])).join(','));
  }
  return lines.join('\n');
}

// Sort: population state (in config order), then reading set, then total desc; excluded last.
function sortRows(rows, stateOrder) {
  const order = (id) => (stateOrder && stateOrder.has(id) ? stateOrder.get(id) : Number.MAX_SAFE_INTEGER);
  return [...rows].sort((a, b) => {
    if (a.populationStateId !== b.populationStateId) return order(a.populationStateId) - order(b.populationStateId);
    if (a.readingLabel !== b.readingLabel) return a.readingLabel < b.readingLabel ? -1 : 1;
    const at = a.totalScaled;
    const bt = b.totalScaled;
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return at < bt ? 1 : at > bt ? -1 : 0;
  });
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export { COLUMNS };
