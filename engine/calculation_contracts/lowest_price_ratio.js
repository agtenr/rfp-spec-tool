// Archetype: LOWEST_PRICE_RATIO (HLD §4.2). PROVISIONAL — a placeholder until the real
// price-scoring arithmetic is transcribed (OQ-A). Replacing it requires a config change and a NEW
// contract implementation, never an edit inside this one (AR-05).
// See .claude/rules/calculation-contracts.md.
//
//   Reference price  p_ref = min(reference set prices)
//   Raw score        raw_i = M × p_ref / p_i
//   Final score      score_i = round(raw_i, displayPrecision, roundingMode)
//   Bounds           0 <= score_i <= M
//   Ties             equal prices -> equal scores (natural: same p_i -> same score)
//   Errors           n = 0 -> BLOCKED "empty reference set"
//                    any p_i <= 0 -> BLOCKED "non-positive comparison price"

import { divToScaled } from '../numeric.js';

const RAW_SCALE = 10; // internal precision for the reported unrounded raw score

export const LOWEST_PRICE_RATIO = {
  archetypeId: 'LOWEST_PRICE_RATIO',

  evaluate({ referencePricesMinor, participants, pricePointsMaxNum, pricePointsMaxScale, displayPrecision, roundingMode }) {
    const warnings = [];

    if (!referencePricesMinor || referencePricesMinor.length === 0) {
      return { referencePriceMinor: null, scores: [], blocked: true, warnings: ['empty reference set'] };
    }
    if (referencePricesMinor.some((p) => p <= 0n) || participants.some((p) => p.priceMinor <= 0n)) {
      return { referencePriceMinor: null, scores: [], blocked: true, warnings: ['non-positive comparison price'] };
    }

    const referencePriceMinor = referencePricesMinor.reduce((min, p) => (p < min ? p : min));
    const mDen = 10n ** BigInt(pricePointsMaxScale);

    const scores = participants.map(({ ref, priceMinor }) => {
      // score = M × p_ref / p_i = (Mnum × p_ref) / (10^Mscale × p_i)
      const num = pricePointsMaxNum * referencePriceMinor;
      const den = mDen * priceMinor;
      const priceScoreRawScaled = divToScaled(num, den, RAW_SCALE, roundingMode);
      const priceScoreScaled = divToScaled(num, den, displayPrecision, roundingMode);
      return { ref, priceScoreRawScaled, rawScale: RAW_SCALE, priceScoreScaled };
    });

    return { referencePriceMinor, scores, blocked: false, warnings };
  },
};
