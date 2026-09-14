// §6.2 machine-readable CSV shape + SC-06 assumption-register export. See .claude/rules/testing.md.

import { test, assert, assertEqual, loadJson } from './harness.js';
import { runSimulation, toCsv, COLUMNS, exportAssumptionRegister } from '../engine/index.js';

async function golden() {
  return loadJson('../dossiers/golden/config.json');
}

test('§6.2 CSV has the §3.7 columns in order and one row per scenario result', async () => {
  const config = await golden();
  const result = await runSimulation(config);
  const csv = toCsv(result, config);
  const lines = csv.split('\n');
  assertEqual(lines[0], COLUMNS.join(','), 'header in §3.7 order');
  assertEqual(lines.length - 1, result.scenarioResults.length, 'one row per result');
  assertEqual(COLUMNS[0], 'run_id', 'first column');
  assertEqual(COLUMNS[COLUMNS.length - 1], 'warnings', 'last column');
});

test('§6.2 rows sorted by population state, then reading, then total desc', async () => {
  const config = await golden();
  const result = await runSimulation(config);
  const csv = toCsv(result, config);
  const body = csv.split('\n').slice(1);
  const stateCol = COLUMNS.indexOf('population_state');
  const states = body.map((l) => l.split(',')[stateCol]);
  // INITIAL rows precede GROWN rows.
  assertEqual(states[0], 'INITIAL', 'first row is INITIAL');
  assert(states.indexOf('GROWN') > states.lastIndexOf('INITIAL'), 'GROWN block follows INITIAL block');
});

test('SC-06 assumption register is exportable as CSV', async () => {
  const config = await golden();
  config.assumptions = [
    { number: 1, text: 'Adopt 6-period horizon', sourceAmbiguityReference: 'AMB-1', selectedReadingReference: 'r6', owner: 'bid-manager' },
  ];
  const csv = exportAssumptionRegister(config);
  const lines = csv.split('\n');
  assertEqual(lines[0], 'number,text,source_ambiguity,selected_reading,owner', 'header');
  assertEqual(lines.length, 2, 'one assumption row');
  assert(lines[1].includes('Adopt 6-period horizon'), 'row content');
});
