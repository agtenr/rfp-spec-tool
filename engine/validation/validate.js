// Configuration validation gate (HLD §8, VA-01…16). All checks run before any scenario executes.
// BLOCK errors prevent the run; WARN entries allow it and are reproduced in every output.
// VA-14 (engine-purity scan) is enforced out-of-band by the `engine-scan` skill, not here.
// See .claude/rules/configuration-validation.md.

import { parseDecimalToScaled } from '../numeric.js';

export function validateConfiguration(config) {
  const errors = []; // BLOCK
  const warnings = []; // WARN
  const block = (id, msg) => errors.push(`${id}: ${msg}`);
  const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

  const scale = config.calculationPrecision;
  const m = config.methodology || {};

  // VA-03 — required numeric configuration present.
  for (const key of ['evaluationHorizon', 'periodUnit', 'calculationPrecision', 'displayPrecision', 'roundingMode']) {
    if (config[key] === undefined || config[key] === null) block('VA-03', `missing ${key}`);
  }

  // Parse helper that records VA-07 violations.
  const dec = (val, where) => {
    try {
      const v = parseDecimalToScaled(val, scale ?? 6);
      if (v < 0n) block('VA-07', `negative monetary/numeric value at ${where}: ${val}`);
      return v;
    } catch (e) {
      block('VA-07', `unparseable value at ${where}: ${val}`);
      return 0n;
    }
  };

  // VA-01 — price + quality = total.
  if (m.pricePointsMax != null && m.qualityPointsMax != null && m.totalPointsMax != null) {
    const p = dec(m.pricePointsMax, 'pricePointsMax');
    const q = dec(m.qualityPointsMax, 'qualityPointsMax');
    const t = dec(m.totalPointsMax, 'totalPointsMax');
    if (p + q !== t) block('VA-01', `pricePointsMax + qualityPointsMax (${m.pricePointsMax}+${m.qualityPointsMax}) != totalPointsMax (${m.totalPointsMax})`);
  } else {
    block('VA-01', 'methodology point maxima incomplete');
  }

  // VA-02 — quality criteria weighted maxima sum to qualityPointsMax.
  const criteria = config.qualityCriteria || [];
  if (m.qualityPointsMax != null) {
    const sum = criteria.reduce((acc, c) => acc + dec(c.weightedPointsMax, `criterion ${c.id}`), 0n);
    if (sum !== dec(m.qualityPointsMax, 'qualityPointsMax')) {
      block('VA-02', `quality criteria weighted maxima sum to ${sum} scaled units, not qualityPointsMax`);
    }
  }

  // Build the set of all segment ids across all population states (for VA-05).
  const states = config.populationStates || [];
  const allSegmentIds = new Set();
  for (const st of states) for (const seg of st.segments || []) allSegmentIds.add(seg.id);

  // VA-04 / VA-05 — cost components on every scored participant.
  const participants = [...(config.bidVariants || []), ...(config.competitors || [])];
  for (const p of participants) {
    for (const comp of p.costComponentValues || []) {
      if (!comp.type || !comp.periodicity || !comp.provenance) {
        block('VA-04', `cost component ${comp.id} on ${p.id} missing type/periodicity/provenance`);
      }
      if (comp.amount != null) dec(comp.amount, `component ${comp.id} on ${p.id}`);
      if (comp.periodicity === 'PER_USER' || comp.periodicity === 'PER_USER_PER_PERIOD') {
        const applic = comp.applicableSegments;
        if (applic !== 'ALL' && Array.isArray(applic)) {
          for (const sid of applic) {
            if (!allSegmentIds.has(sid)) block('VA-05', `component ${comp.id} on ${p.id} references unknown segment ${sid}`);
          }
        } else if (applic !== 'ALL') {
          block('VA-05', `component ${comp.id} on ${p.id} has no applicableSegments (use ALL or a list)`);
        }
      }
    }
  }

  // VA-06 — basket lines map to a declared rate category.
  const rateCategories = new Set((config.rates || []).map((r) => r.profileCategory));
  const basket = config.imposedBasket;
  if (basket) {
    for (const line of basket.lines || []) {
      if (!rateCategories.has(line.profileCategory)) {
        block('VA-06', `basket line references undeclared rate category ${line.profileCategory}`);
      }
    }
  }

  // VA-08 — every quality assumption within its criterion's input scale.
  const criterionById = new Map(criteria.map((c) => [c.id, c]));
  for (const p of participants) {
    for (const qa of p.qualityAssumptions || []) {
      const crit = criterionById.get(qa.criterionReference);
      if (!crit) { block('VA-08', `quality assumption on ${p.id} references unknown criterion ${qa.criterionReference}`); continue; }
      const raw = dec(qa.assumedRawScore, `assumption on ${p.id}`);
      const scaleMax = dec(crit.inputScaleMax, `criterion ${crit.id}`);
      if (raw > scaleMax) block('VA-08', `assumption ${qa.assumedRawScore} on ${p.id} exceeds input scale ${crit.inputScaleMax}`);
    }
  }

  // VA-09 — every competitive field has at least one eligible entry.
  for (const field of asFields(config)) {
    const eligible = (field.entries || []).filter((e) => e.eligibilityStatus === 'ELIGIBLE');
    if (eligible.length === 0) block('VA-09', `competitive field ${field.id} has no eligible entry`);
  }

  // VA-10 — identifiers unique within their entity type.
  checkUnique('bidVariants', config.bidVariants, block);
  checkUnique('competitors', config.competitors, block);
  checkUnique('qualityCriteria', config.qualityCriteria, block);
  checkUnique('populationStates', config.populationStates, block);

  // VA-11 — every ambiguity has >=2 readings, a baseline and an owner (WARN).
  for (const amb of config.ambiguities || []) {
    if ((amb.readings || []).length < 2 || !amb.baselineReadingReference || !amb.owner) {
      warn('VA-11', `ambiguity ${amb.id} incomplete (needs >=2 readings, a baseline and an owner); ambiguity report marked incomplete`);
    }
  }

  // VA-12 — a single reading must not override the same parameter twice.
  for (const amb of config.ambiguities || []) {
    for (const reading of amb.readings || []) {
      const keys = (reading.parameterOverrides || []).map((o) => o.key);
      if (new Set(keys).size !== keys.length) block('VA-12', `reading ${reading.id} has conflicting parameter overrides`);
    }
  }

  // VA-13 — every REQUIRED_BY_SPEC component present & priced in every bid variant.
  const requiredIds = new Set();
  for (const v of config.bidVariants || []) {
    for (const comp of v.costComponentValues || []) {
      if (comp.obligation === 'REQUIRED_BY_SPEC') requiredIds.add(comp.id);
    }
  }
  for (const v of config.bidVariants || []) {
    const present = new Set((v.costComponentValues || []).map((c) => c.id));
    for (const rid of requiredIds) {
      if (!present.has(rid)) block('VA-13', `variant ${v.id} is missing REQUIRED_BY_SPEC component ${rid}`);
    }
  }

  // VA-15 — source methodology version present (staleness is a WARN; we cannot verify a date here).
  if (!config.sourceMethodologyVersion) warn('VA-15', 'sourceMethodologyVersion absent — output may be stale');

  // VA-16 — second-reader sign-off (WARN until present; required for Gate 2).
  if (!config.secondReaderSignoff) warn('VA-16', 'no second-reader sign-off recorded (required for Gate 2)');

  return { errors, warnings, blocked: errors.length > 0 };
}

function asFields(config) {
  if (Array.isArray(config.competitiveFields)) return config.competitiveFields;
  if (config.competitiveField) return [config.competitiveField];
  return [];
}

function checkUnique(label, list, block) {
  const seen = new Set();
  for (const item of list || []) {
    if (seen.has(item.id)) block('VA-10', `duplicate id ${item.id} in ${label}`);
    seen.add(item.id);
  }
}
