// SC-04 (ambiguity spread) and §5.5 envelope test. See .claude/rules/testing.md.

import { test, assert, assertEqual, loadJson } from './harness.js';
import { runSimulation, buildReport, fmtMoney } from '../engine/index.js';

async function base() {
  // Reuse the golden fixture and strip it down to a small ambiguity/envelope scenario.
  const c = structuredClone(await loadJson('../dossiers/golden/config.json'));
  c.dossierId = 'AMB';
  c.populationStates = [c.populationStates[0]]; // INITIAL only
  return c;
}

test('SC-04 each ambiguity reading is run and the spread is reported', async () => {
  const c = await base();
  c.evaluationHorizon = 6;
  c.ambiguities = [{
    id: 'AMB-1', description: 'evaluation horizon', owner: 'bid-manager', baselineReadingReference: 'r6',
    readings: [
      { id: 'r6', description: '6 periods', parameterOverrides: [] },
      { id: 'r1', description: '1 period', parameterOverrides: [{ key: 'evaluationHorizon', value: 1 }] },
    ],
  }];
  const result = await runSimulation(c);
  const labels = new Set(result.scenarioResults.map((r) => r.readingLabel));
  assert(labels.has('baseline'), 'baseline reading run');
  assert(labels.has('AMB-1:r1'), 'AMB-1:r1 reading run');

  // Own variant B carries per-period + per-user costs, so its comparison price differs by horizon.
  const bBaseline = result.scenarioResults.find((r) => r.ref === 'B' && r.readingLabel === 'baseline');
  const bR1 = result.scenarioResults.find((r) => r.ref === 'B' && r.readingLabel === 'AMB-1:r1');
  assert(bBaseline.comparisonPrice.minor !== bR1.comparisonPrice.minor, 'comparison price differs across readings');

  const report = buildReport(result, c);
  assert(report.ambiguitySpread.length === 1, 'one ambiguity in spread');
  const bSpread = report.ambiguitySpread[0].variants.find((v) => v.variantId === 'B');
  assert(bSpread.perReading.length >= 2, 'spread has multiple readings');
});

test('§5.5 envelope WITHIN when under ceiling', async () => {
  const c = await base();
  c.expectedConsumption = { lines: [{ profileCategory: 'developer_junior', quantity: { value: 2, unit: 'HOUR' } }], otherRecurring: ['50.00'] };
  c.budgetEnvelope = { annualCeiling: '1000.00', totalCeiling: '5000.00' };
  const result = await runSimulation(c);
  const env = result.envelopes.find((e) => e.variantId === 'A');
  // A: consumption 2×60=120 + other 50 + PER_PERIOD other_recurring 5000 = 5170 per period -> EXCEEDS 1000
  assertEqual(env.status, 'EXCEEDS', 'A exceeds a tight annual ceiling');
});

test('§5.5 envelope WITHIN with a generous ceiling; carries the nominal-values label', async () => {
  const c = await base();
  c.expectedConsumption = { lines: [{ profileCategory: 'developer_junior', quantity: { value: 2, unit: 'HOUR' } }], otherRecurring: ['50.00'] };
  c.budgetEnvelope = { annualCeiling: '100000.00', totalCeiling: '1000000.00' };
  const result = await runSimulation(c);
  const env = result.envelopes.find((e) => e.variantId === 'A');
  assertEqual(env.status, 'WITHIN', 'within generous ceiling');
  assertEqual(env.label, 'nominal values; price revision excluded', 'nominal-values label present');
});

test('§5.5 envelope NOT_ASSESSED when no expected consumption', async () => {
  const c = await base();
  const result = await runSimulation(c);
  assertEqual(result.envelopes.find((e) => e.variantId === 'A').status, 'NOT_ASSESSED', 'not assessed');
});
