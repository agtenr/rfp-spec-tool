// Weighted quality + exclusion (HLD §5.3). Quality points are BigInt scaled at displayPrecision (d).
// quality_score = Σ rounded weighted contributions (so IN-03 holds exactly). Quality is ASSUMED
// (BR-06). See .claude/rules/award-simulator-domain.md.

import { divToScaled, parseDecimalToScaled } from '../numeric.js';

// weighted_contribution = (assumed_raw / input_scale_max) × weighted_points_max
export function evaluateQuality(participant, config) {
  const d = config.displayPrecision;
  const mode = config.roundingMode;
  const p = config.calculationPrecision;
  const criteria = config.qualityCriteria || [];
  const criterionById = new Map(criteria.map((c) => [c.id, c]));
  const assumptionByCriterion = new Map((participant.qualityAssumptions || []).map((a) => [a.criterionReference, a]));

  const qualityContributions = [];
  const perCriterion = [];
  let qualityScoreScaled = 0n;

  for (const crit of criteria) {
    const assumption = assumptionByCriterion.get(crit.id);
    const raw = assumption ? parseDecimalToScaled(assumption.assumedRawScore, p) : 0n;
    const weightedMax = parseDecimalToScaled(crit.weightedPointsMax, p);
    const inputScaleMax = parseDecimalToScaled(crit.inputScaleMax, p);
    // contribution = (raw × weightedMax) / (inputScaleMax) , scaled to d decimals
    const contributionScaled = divToScaled(raw * weightedMax, inputScaleMax * 10n ** BigInt(p), d, mode);
    qualityContributions.push({ criterionId: crit.id, scaled: contributionScaled });
    qualityScoreScaled += contributionScaled;
    perCriterion.push({ criterionId: crit.id, scaled: contributionScaled, criterion: crit });
  }

  const exclusionStatus = evaluateExclusion(qualityScoreScaled, perCriterion, config);
  return { qualityContributions, qualityScoreScaled, perCriterion, exclusionStatus };
}

function evaluateExclusion(qualityScoreScaled, perCriterion, config) {
  const rule = config.methodology.exclusionRule;
  if (!rule) return 'OK';
  const d = config.displayPrecision;
  const mode = config.roundingMode;
  const p = config.calculationPrecision;

  const resolveThreshold = (thresholdValue, basis, maxScaledD) => {
    if (basis === 'PERCENT_OF_MAX') {
      const pct = parseDecimalToScaled(thresholdValue, p); // e.g. 50 -> 50e6
      // maxScaledD already carries scale d; multiply by the fraction pct/(100·10^p) with no extra
      // scaling (scale 0), so the result stays at scale d. threshold(d) = maxScaledD × pct / (100·10^p)
      return divToScaled(maxScaledD * pct, 100n * 10n ** BigInt(p), 0, mode);
    }
    return parseDecimalToScaled(thresholdValue, d); // ABSOLUTE_POINTS
  };

  const passes = (valueScaled, thresholdScaled) =>
    rule.operator === 'GTE' ? valueScaled >= thresholdScaled : valueScaled > thresholdScaled;

  if (rule.level === 'TOTAL_QUALITY') {
    const maxD = parseDecimalToScaled(config.methodology.qualityPointsMax, d);
    const threshold = resolveThreshold(rule.thresholdValue, rule.thresholdBasis, maxD);
    return passes(qualityScoreScaled, threshold) ? 'OK' : 'EXCLUDED_QUALITY';
  }

  const checkCriterion = (pc) => {
    const maxD = parseDecimalToScaled(pc.criterion.weightedPointsMax, d);
    const thresholdValue = pc.criterion.thresholdValue ?? rule.thresholdValue;
    const threshold = resolveThreshold(thresholdValue, rule.thresholdBasis, maxD);
    return passes(pc.scaled, threshold);
  };

  if (rule.level === 'PER_CRITERION') {
    return perCriterion.every(checkCriterion) ? 'OK' : 'EXCLUDED_QUALITY';
  }
  if (rule.level === 'SPECIFIC_CRITERION') {
    const target = perCriterion.find((pc) => pc.criterionId === rule.criterionReference);
    if (!target) return 'OK';
    return checkCriterion(target) ? 'OK' : 'EXCLUDED_QUALITY';
  }
  return 'OK';
}
