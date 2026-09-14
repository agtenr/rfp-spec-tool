// Human-readable decision reporter (HLD §6.3). Seven sections in order, carrying the §6.1 metadata
// block. Price is shown CALCULATED, quality ASSUMED, never merged (BR-06). The one-page memo is
// written by the bid manager FROM this report — it is not generated. See frontend-ui.md.

import { fmtMoney, fmtPoints, metadataBlock } from './format.js';
import { ENVELOPE_LABEL } from '../envelope/envelope.js';

export function buildReport(result, config) {
  const { run, scenarioResults, compensations, envelopes } = result;

  // Section 2 — scenario comparison, grouped by population state (baseline reading).
  const states = [...new Set(scenarioResults.map((r) => r.populationStateId))];
  const scenarioComparison = states.map((stateId) => ({
    stateId,
    stateName: scenarioResults.find((r) => r.populationStateId === stateId)?.populationStateName,
    rows: scenarioResults
      .filter((r) => r.populationStateId === stateId && r.readingLabel === 'baseline')
      .map((r) => ({
        participant: r.ref,
        comparisonPrice: fmtMoney(r.comparisonPrice, config),
        priceScoreCalculated: fmtPoints(r.priceScoreScaled, config),
        qualityScoreAssumed: fmtPoints(r.qualityScoreScaled, config),
        exclusionStatus: r.exclusionStatus,
        total: fmtPoints(r.totalScaled, config),
        rank: r.rank ?? '',
        margin: fmtPoints(r.marginScaled, config),
      }))
      .sort((a, b) => (a.rank === '' ? 1 : b.rank === '' ? -1 : a.rank - b.rank)),
  }));

  // Section 3 — quality compensation.
  const compensation = compensations.map((c) => ({
    stateId: c.stateId,
    stateName: c.stateName,
    pairs: c.pairs.map((p) => ({
      pair: `L=${p.lId}, H=${p.hId}`,
      required: fmtPoints(p.requiredScaled, config),
      assumed: fmtPoints(p.assumedScaled, config),
      gap: fmtPoints(p.gapScaled, config),
      requiredPctOfQuality: p.proportionPctScaled != null ? fmtPoints(p.proportionPctScaled, config) + '%' : '',
      status: p.status,
    })),
  }));

  // Section 4 — ambiguity spread (per own variant, comparison price + total per reading).
  const ambiguitySpread = buildAmbiguitySpread(scenarioResults, config);

  // Section 5 — envelope.
  const envelope = envelopes.map((e) => ({
    stateId: e.stateId,
    variantId: e.variantId,
    perPeriodCost: e.perPeriodCost ? fmtMoney(e.perPeriodCost, config) : '',
    annualCeiling: e.annualCeiling ? fmtMoney(e.annualCeiling, config) : '',
    headroom: e.perPeriodCost && e.annualCeiling ? fmtMoney({ minor: e.annualCeiling.minor - e.perPeriodCost.minor, currency: config.currency }, config) : '',
    status: e.status,
    label: ENVELOPE_LABEL,
  }));

  // Section 6 — assumption register (numbered).
  const assumptionRegister = (config.assumptions || []).map((a) => ({
    number: a.number,
    text: a.text,
    sourceAmbiguity: a.sourceAmbiguityReference || '',
    selectedReading: a.selectedReadingReference || '',
    owner: a.owner || '',
  }));

  return {
    header: metadataBlock(run, config),
    scenarioComparison,
    compensation,
    ambiguitySpread,
    envelope,
    assumptionRegister,
    warnings: run.warnings,
  };
}

function buildAmbiguitySpread(scenarioResults, config) {
  const ambIds = [...new Set(scenarioResults.map((r) => r.ambiguityId).filter(Boolean))];
  return ambIds.map((ambiguityId) => {
    const rows = scenarioResults.filter((r) => (r.ambiguityId === ambiguityId || r.readingLabel === 'baseline') && r.kind === 'variant');
    const variants = [...new Set(rows.map((r) => r.ref))];
    return {
      ambiguityId,
      variants: variants.map((variantId) => {
        const perReading = rows.filter((r) => r.ref === variantId).map((r) => ({
          reading: r.readingLabel,
          stateId: r.populationStateId,
          comparisonPrice: fmtMoney(r.comparisonPrice, config),
          total: fmtPoints(r.totalScaled, config),
          totalScaled: r.totalScaled,
        }));
        const totals = perReading.map((x) => x.totalScaled).filter((v) => v !== null);
        const spread = totals.length ? fmtPoints(maxBig(totals) - minBig(totals), config) : '';
        return { variantId, perReading, spread };
      }),
    };
  });
}

// SC-06 — the numbered assumption register is exportable (as CSV).
export function exportAssumptionRegister(config) {
  const header = 'number,text,source_ambiguity,selected_reading,owner';
  const rows = (config.assumptions || []).map((a) =>
    [a.number, a.text, a.sourceAmbiguityReference || '', a.selectedReadingReference || '', a.owner || '']
      .map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)))
      .join(','));
  return [header, ...rows].join('\n');
}

function maxBig(list) { return list.reduce((m, v) => (v > m ? v : m)); }
function minBig(list) { return list.reduce((m, v) => (v < m ? v : m)); }
