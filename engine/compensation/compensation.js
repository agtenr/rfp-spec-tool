// Quality compensation between own variant pairs (HLD §5.4). All point values are BigInt scaled
// at displayPrecision (d). See .claude/rules/award-simulator-domain.md.
//
//   For ordered pair (cheaper L, higher-priced H):
//     required_quality_delta = price_score_L − price_score_H
//     assumed_quality_delta  = quality_score_H − quality_score_L
//     compensation_gap       = assumed_quality_delta − required_quality_delta

import { divToScaled } from '../numeric.js';

export function computeCompensation(ownResults, qualityPointsMaxScaledD, displayPrecision, roundingMode) {
  const pairs = [];
  for (let i = 0; i < ownResults.length; i++) {
    for (let j = i + 1; j < ownResults.length; j++) {
      const a = ownResults[i];
      const b = ownResults[j];
      // L = cheaper by comparison price, H = higher-priced.
      const [L, H] = a.comparisonPriceMinor <= b.comparisonPriceMinor ? [a, b] : [b, a];

      if (L.excluded || H.excluded) {
        pairs.push({ lId: L.variantId, hId: H.variantId, status: 'INDETERMINATE_EXCLUSION' });
        continue;
      }

      const required = L.priceScoreScaled - H.priceScoreScaled;
      const assumed = H.qualityScoreScaled - L.qualityScoreScaled;
      const gap = assumed - required;

      let status;
      if (required <= 0n) status = 'NO_COMPENSATION_NEEDED';
      else if (required > qualityPointsMaxScaledD) status = 'NOT_ACHIEVABLE';
      else status = 'COMPUTED';

      // required delta as a proportion of quality_points_max (percent, scaled at d).
      const proportionPct = qualityPointsMaxScaledD > 0n
        ? divToScaled(required * 100n, qualityPointsMaxScaledD, displayPrecision, roundingMode)
        : null;

      pairs.push({
        lId: L.variantId,
        hId: H.variantId,
        requiredScaled: required,
        assumedScaled: assumed,
        gapScaled: gap,
        proportionPctScaled: proportionPct,
        status,
      });
    }
  }
  return pairs;
}
