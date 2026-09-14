// Budget-envelope deliverability test (HLD §5.5). Uses ExpectedConsumption, NEVER the imposed
// basket (BR-10). Separate from the score (BR-09). Every envelope output carries the label
// "nominal values; price revision excluded". See .claude/rules/award-simulator-domain.md.

import { money, moneyFromAmount, zeroMoney, addMoney, scaleMoney, sumMoney, compareMoney } from '../value_objects/money.js';

export const ENVELOPE_LABEL = 'nominal values; price revision excluded';

// per_period_cost = Σ(expected consumption qty × rate)
//                 + Σ(other_recurring)
//                 + Σ(PER_PERIOD and PER_USER_PER_PERIOD components at this population state)
export function computeEnvelope(variant, state, config) {
  const consumption = config.expectedConsumption;
  if (!consumption) return { status: 'NOT_ASSESSED', label: ENVELOPE_LABEL };

  const { currency, calculationPrecision: scale, evaluationHorizon: horizon } = config;
  const rateByCategory = new Map((config.rates || []).map((r) => [r.profileCategory, moneyFromAmount(r.amount, currency, scale)]));

  let perPeriod = zeroMoney(currency);
  for (const line of consumption.lines || []) {
    const rate = rateByCategory.get(line.profileCategory);
    if (!rate) throw new Error(`expected-consumption line references undeclared rate category ${line.profileCategory}`);
    perPeriod = addMoney(perPeriod, scaleMoney(rate, line.quantity.value));
  }
  for (const other of consumption.otherRecurring || []) {
    perPeriod = addMoney(perPeriod, moneyFromAmount(other, currency, scale));
  }
  for (const comp of variant.costComponentValues || []) {
    if (comp.periodicity === 'PER_PERIOD') {
      perPeriod = addMoney(perPeriod, moneyFromAmount(comp.amount, currency, scale));
    } else if (comp.periodicity === 'PER_USER_PER_PERIOD') {
      const count = countUsers(comp, state);
      perPeriod = addMoney(perPeriod, scaleMoney(moneyFromAmount(comp.amount, currency, scale), count));
    }
  }

  const totalOverHorizon = scaleMoney(perPeriod, horizon);
  const env = config.budgetEnvelope || {};
  const annualCeiling = env.annualCeiling != null ? moneyFromAmount(env.annualCeiling, currency, scale) : null;
  const totalCeiling = env.totalCeiling != null ? moneyFromAmount(env.totalCeiling, currency, scale) : null;

  const withinAnnual = annualCeiling ? compareMoney(perPeriod, annualCeiling) <= 0 : true;
  const withinTotal = totalCeiling ? compareMoney(totalOverHorizon, totalCeiling) <= 0 : true;
  const status = withinAnnual && withinTotal ? 'WITHIN' : 'EXCEEDS';

  return { status, perPeriodCost: perPeriod, totalOverHorizon, annualCeiling, totalCeiling, label: ENVELOPE_LABEL };
}

function countUsers(component, state) {
  const applic = component.applicableSegments;
  const isAll = applic === 'ALL';
  return (state.segments || []).reduce((acc, seg) => {
    const applies = isAll || (Array.isArray(applic) && applic.includes(seg.id));
    return acc + (applies ? seg.count : 0);
  }, 0);
}
