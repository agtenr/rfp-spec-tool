// Quantity value object — a value plus a unit; never a bare number.
// See .claude/rules/numeric-and-money.md (§3.1 of the HLD).

const UNITS = new Set(['HOUR', 'USER', 'ITEM', 'PERIOD']);
const PERIOD_BASES = new Set(['PER_PERIOD', 'ONCE']);

export function quantity(value, unit, periodBasis = null) {
  if (!UNITS.has(unit)) throw new Error(`invalid Quantity unit: ${unit}`);
  if (periodBasis !== null && !PERIOD_BASES.has(periodBasis)) {
    throw new Error(`invalid Quantity period_basis: ${periodBasis}`);
  }
  if (!Number.isInteger(value)) {
    // Basket line quantities and segment counts are whole units; fractional support is out of scope.
    throw new Error(`Quantity.value must be an integer, got ${value}`);
  }
  return Object.freeze({ value, unit, periodBasis });
}

export { UNITS, PERIOD_BASES };
