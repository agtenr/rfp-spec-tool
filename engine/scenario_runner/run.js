// Scenario runner (HLD §5.1 order of operations). For each ambiguity reading in scope → each
// population state → each participant: expand cost, score, quality/exclusion, total/rank/margin;
// then compensation per variant pair and the envelope test. Emits ScenarioResult rows (§3.7).
// See .claude/rules/award-simulator-domain.md.

import { validateConfiguration } from '../validation/validate.js';
import { evaluateField } from '../field_evaluator/field.js';
import { evaluateQuality } from '../quality_model/quality.js';
import { computeCompensation } from '../compensation/compensation.js';
import { computeEnvelope } from '../envelope/envelope.js';
import { computeInputHash, makeRunId, ENGINE_VERSION } from '../run_identity/identity.js';
import { parseDecimalToScaled } from '../numeric.js';

export async function runSimulation(rawConfig) {
  const validation = validateConfiguration(rawConfig);
  const run = {
    runId: makeRunId(),
    dossierId: rawConfig.dossierId,
    configurationVersion: rawConfig.configurationVersion,
    engineVersion: ENGINE_VERSION,
    inputHash: await computeInputHash(rawConfig),
    startedAt: new Date().toISOString(),
    validationGate: rawConfig.validationGate,
    status: 'OK',
    warnings: [...validation.warnings],
  };

  if (validation.blocked) {
    run.status = 'BLOCKED';
    run.completedAt = new Date().toISOString();
    return { run, scenarioResults: [], compensations: [], envelopes: [], validation };
  }

  const scenarioResults = [];
  const compensations = [];
  const envelopes = [];

  for (const reading of buildReadingSets(rawConfig)) {
    const config = applyReading(rawConfig, reading.overrides);
    const d = config.displayPrecision;
    const qualityMaxScaledD = parseDecimalToScaled(config.methodology.qualityPointsMax, d);
    const field = firstField(config);

    for (const state of config.populationStates || []) {
      const evalResult = evaluateField(field, state, config);
      if (evalResult.blocked) {
        run.status = 'BLOCKED';
        for (const w of evalResult.warnings) if (!run.warnings.includes(w)) run.warnings.push(w);
        continue;
      }
      const scoreByRef = new Map(evalResult.scores.map((s) => [s.ref, s]));

      const rows = evalResult.scored.map((e) => {
        const score = scoreByRef.get(e.participant.id);
        const quality = evaluateQuality(e.participant, config);
        const excluded = quality.exclusionStatus === 'EXCLUDED_QUALITY' || e.entry.eligibilityStatus !== 'ELIGIBLE';
        const totalScaled = excluded ? null : score.priceScoreScaled + quality.qualityScoreScaled;
        return {
          ref: e.participant.id,
          participantName: e.participant.name,
          kind: e.kind,
          eligibilityStatus: e.entry.eligibilityStatus,
          readingLabel: reading.label,
          ambiguityId: reading.ambiguityId,
          readingId: reading.readingId,
          populationStateId: state.id,
          populationStateName: state.name,
          fieldId: field.id,
          comparisonPrice: e.comparisonPrice,
          costContributions: e.costContributions,
          segmentContributions: e.segmentContributions,
          referencePriceMinor: evalResult.referencePriceMinor,
          priceScoreRawScaled: score.priceScoreRawScaled,
          priceScoreRawScale: score.rawScale,
          priceScoreScaled: score.priceScoreScaled,
          qualityContributions: quality.qualityContributions,
          qualityScoreScaled: quality.qualityScoreScaled,
          exclusionStatus: quality.exclusionStatus,
          excluded,
          totalScaled,
          rank: null,
          marginScaled: null,
          envelopeStatus: 'NOT_ASSESSED',
        };
      });

      assignRanks(rows);
      assignMargins(rows);

      // Envelope per own variant in this state.
      for (const row of rows) {
        if (row.kind !== 'variant') continue;
        const variant = (config.bidVariants || []).find((v) => v.id === row.ref);
        const env = computeEnvelope(variant, state, config);
        row.envelopeStatus = env.status;
        envelopes.push({ readingLabel: reading.label, stateId: state.id, stateName: state.name, variantId: row.ref, ...env });
      }

      // Compensation per own variant pair in this state.
      const ownResults = rows
        .filter((r) => r.kind === 'variant')
        .map((r) => ({
          variantId: r.ref,
          comparisonPriceMinor: r.comparisonPrice.minor,
          priceScoreScaled: r.priceScoreScaled,
          qualityScoreScaled: r.qualityScoreScaled,
          excluded: r.excluded,
        }));
      const pairs = computeCompensation(ownResults, qualityMaxScaledD, d, config.roundingMode);
      compensations.push({ readingLabel: reading.label, stateId: state.id, stateName: state.name, pairs });

      scenarioResults.push(...rows);
    }
  }

  run.completedAt = new Date().toISOString();
  return { run, scenarioResults, compensations, envelopes, validation };
}

function firstField(config) {
  if (Array.isArray(config.competitiveFields)) return config.competitiveFields[0];
  if (config.competitiveField) return config.competitiveField;
  throw new Error('config has no competitive field');
}

// One-at-a-time ambiguity execution (§1.3.11, DF-03): baseline plus one reading varied at a time.
function buildReadingSets(config) {
  const sets = [{ label: 'baseline', overrides: [], ambiguityId: null, readingId: 'baseline' }];
  for (const amb of config.ambiguities || []) {
    for (const reading of amb.readings || []) {
      if (reading.id === amb.baselineReadingReference) continue;
      sets.push({
        label: `${amb.id}:${reading.id}`,
        overrides: reading.parameterOverrides || [],
        ambiguityId: amb.id,
        readingId: reading.id,
      });
    }
  }
  return sets;
}

function applyReading(config, overrides) {
  if (!overrides || overrides.length === 0) return config;
  const clone = structuredClone(config);
  for (const o of overrides) setDotted(clone, o.key, o.value);
  return clone;
}

function setDotted(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}

function assignRanks(rows) {
  const ranked = rows.filter((r) => !r.excluded).sort((a, b) => cmp(b.totalScaled, a.totalScaled));
  let rank = 0;
  let prev = null;
  let seen = 0;
  for (const r of ranked) {
    seen++;
    if (prev === null || r.totalScaled !== prev) { rank = seen; prev = r.totalScaled; }
    r.rank = rank;
  }
}

function assignMargins(rows) {
  for (const r of rows) {
    if (r.excluded) { r.marginScaled = null; continue; }
    const others = rows.filter((o) => !o.excluded && o.ref !== r.ref).map((o) => o.totalScaled);
    r.marginScaled = others.length ? r.totalScaled - others.reduce((m, v) => (v > m ? v : m)) : null;
  }
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
