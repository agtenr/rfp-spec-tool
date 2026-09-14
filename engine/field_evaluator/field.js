// Competitive-field evaluator (HLD §4.2 reference set rule, §5.1 steps 4–6). Resolves each
// participant's comparison price, builds the reference set per the eligibility/multiplicity/flag
// rules, and applies the calculation contract to produce price scores.
// See .claude/rules/calculation-contracts.md and .claude/rules/award-simulator-domain.md.

import { resolveComparisonPrice } from '../cost_engine/expand.js';
import { getContract } from '../calculation_contracts/contract.js';
import { parseDecimalToScaled } from '../numeric.js';

export function evaluateField(field, state, config) {
  const scale = config.calculationPrecision;
  const variantById = new Map((config.bidVariants || []).map((v) => [v.id, v]));
  const competitorById = new Map((config.competitors || []).map((c) => [c.id, c]));

  const entries = (field.entries || []).map((entry) => {
    const id = entry.participantReference;
    let participant;
    let kind;
    if (variantById.has(id)) { participant = variantById.get(id); kind = 'variant'; }
    else if (competitorById.has(id)) { participant = competitorById.get(id); kind = 'competitor'; }
    else throw new Error(`field entry references unknown participant ${id}`);
    const priced = resolveComparisonPrice(participant, kind, state, config);
    return { entry, participant, kind, ...priced };
  });

  const ownCounts = pickFlag(field.ownVariantCountsInReferenceSet, config.referenceSet?.ownVariantCountsInReferenceSet, false);
  const exclCounts = pickFlag(field.excludedBidsCountInReferenceSet, config.referenceSet?.excludedBidsCountInReferenceSet, false);

  // Reference set: eligible entries (own only if the flag is set; competitors always), plus
  // excluded entries only if that flag is set; multiplicity m contributes m identical prices.
  const referencePricesMinor = [];
  for (const e of entries) {
    const status = e.entry.eligibilityStatus;
    const mult = e.entry.multiplicity ?? 1;
    let include = false;
    if (status === 'ELIGIBLE') include = e.kind === 'competitor' || ownCounts;
    else if (status === 'EXCLUDED') include = exclCounts;
    if (include) for (let i = 0; i < mult; i++) referencePricesMinor.push(e.comparisonPrice.minor);
  }

  // Scored participants: ELIGIBLE and EXCLUDED retain a price score (diagnostic); INVALID does not.
  const scored = entries.filter((e) => e.entry.eligibilityStatus !== 'INVALID');
  const contract = getContract(config.methodology.archetypeReference);
  const result = contract.evaluate({
    referencePricesMinor,
    participants: scored.map((e) => ({ ref: e.participant.id, priceMinor: e.comparisonPrice.minor })),
    pricePointsMaxNum: parseDecimalToScaled(config.methodology.pricePointsMax, scale),
    pricePointsMaxScale: scale,
    displayPrecision: config.displayPrecision,
    roundingMode: config.roundingMode,
  });

  return { scored, referencePriceMinor: result.referencePriceMinor, scores: result.scores, blocked: result.blocked, warnings: result.warnings };
}

function pickFlag(fieldFlag, configFlag, fallback) {
  if (fieldFlag !== undefined) return fieldFlag;
  if (configFlag !== undefined) return configFlag;
  return fallback;
}
