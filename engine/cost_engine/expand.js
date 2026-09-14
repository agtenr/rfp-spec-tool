// Comparison-price expansion (HLD §5.2). Expands each cost component by periodicity, segment
// and horizon, adds the imposed basket, and records cost_contributions + segment_contributions.
// Every monetary value stays in exact minor units (see .claude/rules/numeric-and-money.md).
// See .claude/rules/award-simulator-domain.md.

import { money, moneyFromAmount, zeroMoney, addMoney, scaleMoney, sumMoney } from '../value_objects/money.js';

// Total applicable user count for a component in a population state.
function applicableCount(component, state) {
  const segments = state.segments || [];
  const applic = component.applicableSegments;
  const isAll = applic === 'ALL';
  return segments.reduce((acc, seg) => {
    const applies = isAll || (Array.isArray(applic) && applic.includes(seg.id));
    return acc + (applies ? seg.count : 0);
  }, 0);
}

// Per-segment breakdown for a per-user component (non-applicable segments still report a zero line).
function segmentBreakdown(component, state, unitAmount) {
  const applic = component.applicableSegments;
  const isAll = applic === 'ALL';
  return (state.segments || []).map((seg) => {
    const applies = isAll || (Array.isArray(applic) && applic.includes(seg.id));
    return { segmentId: seg.id, count: applies ? seg.count : 0 };
  });
}

function isPerUser(periodicity) {
  return periodicity === 'PER_USER' || periodicity === 'PER_USER_PER_PERIOD';
}

export function expandBasket(config) {
  const { currency, calculationPrecision: scale } = config;
  const basket = config.imposedBasket;
  if (!basket) return zeroMoney(currency);
  const rateByCategory = new Map((config.rates || []).map((r) => [r.profileCategory, moneyFromAmount(r.amount, currency, scale)]));
  let total = zeroMoney(currency);
  for (const line of basket.lines || []) {
    const rate = rateByCategory.get(line.profileCategory);
    if (!rate) throw new Error(`basket line references undeclared rate category ${line.profileCategory}`);
    total = addMoney(total, scaleMoney(rate, line.quantity.value));
  }
  if (basket.periodicity === 'PER_PERIOD') total = scaleMoney(total, config.evaluationHorizon);
  return total; // ONCE_OVER_HORIZON => counted once
}

// Expand a participant that carries a cost structure (bid variant, or COST_STRUCTURE competitor).
export function expandCostStructure(participant, state, config) {
  const { currency, calculationPrecision: scale, evaluationHorizon: horizon } = config;
  const costContributions = [];
  const segmentTotals = new Map(); // segmentId -> minor BigInt (across all per-user components)
  for (const seg of state.segments || []) segmentTotals.set(seg.id, 0n);

  for (const comp of participant.costComponentValues || []) {
    const unit = moneyFromAmount(comp.amount, currency, scale);
    let contribution;
    switch (comp.periodicity) {
      case 'ONE_OFF':
        contribution = unit;
        break;
      case 'PER_PERIOD':
        contribution = scaleMoney(unit, horizon);
        break;
      case 'PER_USER':
        contribution = scaleMoney(unit, applicableCount(comp, state));
        break;
      case 'PER_USER_PER_PERIOD':
        contribution = scaleMoney(unit, applicableCount(comp, state) * horizon);
        break;
      default:
        throw new Error(`unknown periodicity ${comp.periodicity} on component ${comp.id}`);
    }
    costContributions.push({ componentId: comp.id, money: contribution });

    if (isPerUser(comp.periodicity)) {
      const periods = comp.periodicity === 'PER_USER_PER_PERIOD' ? horizon : 1;
      for (const { segmentId, count } of segmentBreakdown(comp, state, unit)) {
        const add = scaleMoney(unit, count * periods).minor;
        segmentTotals.set(segmentId, (segmentTotals.get(segmentId) ?? 0n) + add);
      }
    }
  }

  // Imposed basket — a shared cost added once to each expanded participant (§5.2).
  const basket = expandBasket(config);
  if (basket.minor !== 0n || config.imposedBasket) {
    costContributions.push({ componentId: 'imposed_basket', money: basket });
  }

  const comparisonPrice = sumMoney(costContributions.map((c) => c.money), currency);
  const segmentContributions = [...segmentTotals.entries()].map(([segmentId, minor]) => ({ segmentId, money: money(minor, currency) }));
  return { comparisonPrice, costContributions, segmentContributions };
}

// Resolve the comparison price for any field participant.
export function resolveComparisonPrice(participant, kind, state, config) {
  const { currency, calculationPrecision: scale } = config;
  if (kind === 'competitor' && participant.pricingMode === 'DIRECT_PRICE') {
    const price = moneyFromAmount(participant.comparisonPrice, currency, scale);
    return {
      comparisonPrice: price,
      costContributions: [{ componentId: 'direct_price', money: price }],
      segmentContributions: [],
    };
  }
  return expandCostStructure(participant, state, config);
}
