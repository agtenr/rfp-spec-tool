// Numeric core — exact fixed-decimal arithmetic on BigInt scaled integers.
// Honors NUM-01 (no IEEE-754 for monetary values), NUM-02 (round once, at output) and
// NUM-03 (precision + rounding mode come from configuration, never a code default).
// See .claude/rules/numeric-and-money.md.

const ROUNDING_MODES = new Set(['HALF_UP', 'HALF_EVEN', 'DOWN']);

// Parse a decimal string/number into an integer scaled to `scale` decimal places.
// Throws if the input carries more precision than `scale` — silent truncation is forbidden.
export function parseDecimalToScaled(input, scale) {
  const s = String(input).trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`invalid decimal value: ${JSON.stringify(input)}`);
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2];
  const frac = m[3] || '';
  if (frac.length > scale) {
    throw new Error(`value ${s} has more precision than the configured scale (${scale})`);
  }
  const fracPadded = (frac + '0'.repeat(scale)).slice(0, scale);
  return sign * BigInt(intPart + fracPadded);
}

// Round the quotient of two BigInts to `scale` decimals under the given mode.
// This is where the single output rounding happens for anything computed by division.
export function divToScaled(num, den, scale, mode) {
  assertMode(mode);
  if (den === 0n) throw new Error('division by zero');
  const negative = (num < 0n) !== (den < 0n);
  const a = num < 0n ? -num : num;
  const b = den < 0n ? -den : den;
  const scaled = a * 10n ** BigInt(scale);
  const q = scaled / b;
  const r = scaled % b;
  const rounded = applyRounding(q, r, b, mode);
  return negative ? -rounded : rounded;
}

// Re-express a scaled integer at a different scale, rounding once if precision is reduced.
export function rescale(value, fromScale, toScale, mode) {
  if (toScale === fromScale) return value;
  if (toScale > fromScale) return value * 10n ** BigInt(toScale - fromScale);
  const negative = value < 0n;
  const a = negative ? -value : value;
  const b = 10n ** BigInt(fromScale - toScale);
  const rounded = applyRounding(a / b, a % b, b, mode);
  return negative ? -rounded : rounded;
}

// Format a scaled integer as a fixed-decimal string (no rounding — value is already at `scale`).
export function formatScaled(value, scale) {
  const negative = value < 0n;
  const v = (negative ? -value : value).toString().padStart(scale + 1, '0');
  const intPart = v.slice(0, v.length - scale) || '0';
  const fracPart = scale > 0 ? '.' + v.slice(v.length - scale) : '';
  return (negative ? '-' : '') + intPart + fracPart;
}

function applyRounding(q, r, b, mode) {
  if (r === 0n) return q;
  const twice = r * 2n;
  switch (mode) {
    case 'DOWN':
      return q; // toward zero
    case 'HALF_UP':
      return twice >= b ? q + 1n : q;
    case 'HALF_EVEN':
      if (twice > b) return q + 1n;
      if (twice < b) return q;
      return q % 2n === 0n ? q : q + 1n;
    default:
      throw new Error(`unknown rounding mode: ${mode}`);
  }
}

function assertMode(mode) {
  if (!ROUNDING_MODES.has(mode)) throw new Error(`unknown rounding mode: ${mode}`);
}

export { ROUNDING_MODES };
