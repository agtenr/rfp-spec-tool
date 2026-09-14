// SC-01 — the §9.3 golden worked example reproduces exactly at every specified intermediate step.
// See .claude/rules/testing.md.

import { test, assert, assertEqual, loadJson } from './harness.js';
import { runSimulation, fmtMoney, fmtPoints } from '../engine/index.js';

let cache;
async function golden() {
  if (!cache) {
    const config = await loadJson('../dossiers/golden/config.json');
    cache = { config, result: await runSimulation(config) };
  }
  return cache;
}

function row(result, stateId, ref) {
  return result.scenarioResults.find((r) => r.populationStateId === stateId && r.ref === ref && r.readingLabel === 'baseline');
}

test('§9.3 basket expands to 112,000.00', async () => {
  const { config, result } = await golden();
  const a = row(result, 'INITIAL', 'A');
  const basket = a.costContributions.find((c) => c.componentId === 'imposed_basket');
  assertEqual(fmtMoney(basket.money, config), '112000.00', 'basket total');
});

test('§9.3 comparison prices', async () => {
  const { config, result } = await golden();
  assertEqual(fmtMoney(row(result, 'INITIAL', 'A').comparisonPrice, config), '242000.00', 'A INITIAL');
  assertEqual(fmtMoney(row(result, 'GROWN', 'A').comparisonPrice, config), '242000.00', 'A GROWN');
  assertEqual(fmtMoney(row(result, 'INITIAL', 'B').comparisonPrice, config), '258000.00', 'B INITIAL');
  assertEqual(fmtMoney(row(result, 'GROWN', 'B').comparisonPrice, config), '498000.00', 'B GROWN');
  assertEqual(fmtMoney(row(result, 'INITIAL', 'C').comparisonPrice, config), '230000.00', 'C INITIAL');
});

test('§9.3 B GROWN segment contributions (staff 48,000; students 240,000)', async () => {
  const { config, result } = await golden();
  const b = row(result, 'GROWN', 'B');
  const staff = b.segmentContributions.find((s) => s.segmentId === 'staff');
  const students = b.segmentContributions.find((s) => s.segmentId === 'students');
  assertEqual(fmtMoney(staff.money, config), '48000.00', 'staff');
  assertEqual(fmtMoney(students.money, config), '240000.00', 'students');
});

test('§9.3 price scores (ref price 230,000.00)', async () => {
  const { config, result } = await golden();
  assertEqual(row(result, 'INITIAL', 'A').referencePriceMinor, row(result, 'INITIAL', 'C').comparisonPrice.minor, 'reference price = min = C');
  assertEqual(fmtPoints(row(result, 'INITIAL', 'A').priceScoreScaled, config), '38.02', 'A INITIAL');
  assertEqual(fmtPoints(row(result, 'INITIAL', 'B').priceScoreScaled, config), '35.66', 'B INITIAL');
  assertEqual(fmtPoints(row(result, 'INITIAL', 'C').priceScoreScaled, config), '40.00', 'C INITIAL');
  assertEqual(fmtPoints(row(result, 'GROWN', 'A').priceScoreScaled, config), '38.02', 'A GROWN');
  assertEqual(fmtPoints(row(result, 'GROWN', 'B').priceScoreScaled, config), '18.47', 'B GROWN');
  assertEqual(fmtPoints(row(result, 'GROWN', 'C').priceScoreScaled, config), '40.00', 'C GROWN');
});

test('§9.3 quality scores (A 42.00, B 48.00, C 33.00)', async () => {
  const { config, result } = await golden();
  assertEqual(fmtPoints(row(result, 'INITIAL', 'A').qualityScoreScaled, config), '42.00', 'A');
  assertEqual(fmtPoints(row(result, 'INITIAL', 'B').qualityScoreScaled, config), '48.00', 'B');
  assertEqual(fmtPoints(row(result, 'INITIAL', 'C').qualityScoreScaled, config), '33.00', 'C');
});

test('§9.3 totals and ranks', async () => {
  const { config, result } = await golden();
  // INITIAL: B 83.66 (1), A 80.02 (2), C 73.00 (3)
  assertEqual(fmtPoints(row(result, 'INITIAL', 'B').totalScaled, config), '83.66', 'B total');
  assertEqual(row(result, 'INITIAL', 'B').rank, 1, 'B rank');
  assertEqual(fmtPoints(row(result, 'INITIAL', 'A').totalScaled, config), '80.02', 'A total');
  assertEqual(row(result, 'INITIAL', 'A').rank, 2, 'A rank');
  assertEqual(row(result, 'INITIAL', 'C').rank, 3, 'C rank');
  // GROWN: A 80.02 (1), C 73.00 (2), B 66.47 (3)
  assertEqual(row(result, 'GROWN', 'A').rank, 1, 'A grown rank');
  assertEqual(fmtPoints(row(result, 'GROWN', 'B').totalScaled, config), '66.47', 'B grown total');
  assertEqual(row(result, 'GROWN', 'B').rank, 3, 'B grown rank');
});

test('§9.3 quality compensation (L=A, H=B): INITIAL gap +3.64, GROWN gap −13.55, both COMPUTED', async () => {
  const { config, result } = await golden();
  const comp = (stateId) => result.compensations.find((c) => c.stateId === stateId).pairs[0];
  const init = comp('INITIAL');
  assertEqual(init.status, 'COMPUTED', 'INITIAL status');
  assertEqual(`${init.lId},${init.hId}`, 'A,B', 'pair order (L=A,H=B)');
  assertEqual(fmtPoints(init.requiredScaled, config), '2.36', 'INITIAL required');
  assertEqual(fmtPoints(init.assumedScaled, config), '6.00', 'INITIAL assumed');
  assertEqual(fmtPoints(init.gapScaled, config), '3.64', 'INITIAL gap');
  const grown = comp('GROWN');
  assertEqual(fmtPoints(grown.requiredScaled, config), '19.55', 'GROWN required');
  assertEqual(fmtPoints(grown.gapScaled, config), '-13.55', 'GROWN gap');
  assertEqual(grown.status, 'COMPUTED', 'GROWN status');
});

test('SC-08 every output carries run identity, config version, gate, input hash', async () => {
  const { result } = await golden();
  assert(result.run.runId && result.run.inputHash && result.run.engineVersion, 'run identity present');
  assertEqual(result.run.validationGate, 'GATE_1', 'gate');
  assertEqual(result.run.inputHash.length, 64, 'sha-256 hex length');
});
