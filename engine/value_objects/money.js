// Money value object — an integer amount in minor units at a config-driven scale
// (10^calculationPrecision), plus an ISO currency. Never a bare number; never IEEE-754.
// See .claude/rules/numeric-and-money.md.

import { parseDecimalToScaled, formatScaled, rescale } from '../numeric.js';

export function money(minor, currency) {
  if (typeof minor !== 'bigint') throw new Error('Money.minor must be a BigInt');
  if (!currency) throw new Error('Money requires a currency');
  return Object.freeze({ minor, currency });
}

export function zeroMoney(currency) {
  return money(0n, currency);
}

// Build Money from a decimal amount (string/number) at the given calculation scale.
export function moneyFromAmount(amount, currency, scale) {
  return money(parseDecimalToScaled(amount, scale), currency);
}

export function addMoney(a, b) {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function sumMoney(list, currency) {
  return list.reduce((acc, m) => addMoney(acc, m), zeroMoney(currency));
}

// Multiply Money by an integer factor (e.g. a user count or horizon) — stays exact.
export function scaleMoney(m, factor) {
  const f = typeof factor === 'bigint' ? factor : BigInt(factor);
  return money(m.minor * f, m.currency);
}

export function compareMoney(a, b) {
  assertSameCurrency(a, b);
  return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0;
}

export function isNonNegative(m) {
  return m.minor >= 0n;
}

// Format for display: round once from the calculation scale to displayPrecision.
export function formatMoney(m, calculationScale, displayPrecision, roundingMode) {
  const disp = rescale(m.minor, calculationScale, displayPrecision, roundingMode);
  return formatScaled(disp, displayPrecision);
}

function assertSameCurrency(a, b) {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}
