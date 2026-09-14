// Calculation-contract interface (HLD §4.1). Every archetype is a self-contained implementation
// of this shape. A new archetype is a NEW implementation, never a branch inside an existing one
// (AR-05). See .claude/rules/calculation-contracts.md.
//
// A contract implementation is an object:
//   {
//     archetypeId: string,
//     evaluate(inputs) -> { referencePriceMinor, scores: [{ ref, priceScoreRawScaled, priceScoreScaled }],
//                           blocked: boolean, warnings: string[] }
//   }
// where inputs = { referencePricesMinor: BigInt[], participants: [{ref, priceMinor}],
//                  pricePointsMaxNum: BigInt, pricePointsMaxScale: int,
//                  displayPrecision: int, roundingMode: string }.

import { LOWEST_PRICE_RATIO } from './lowest_price_ratio.js';

const REGISTRY = new Map([[LOWEST_PRICE_RATIO.archetypeId, LOWEST_PRICE_RATIO]]);

export function getContract(archetypeId) {
  const contract = REGISTRY.get(archetypeId);
  if (!contract) throw new Error(`no calculation contract registered for archetype ${archetypeId}`);
  return contract;
}

export { REGISTRY };
