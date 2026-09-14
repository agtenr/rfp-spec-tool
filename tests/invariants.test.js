// §9.2 invariant tests IN-01…07, plus IN-06 determinism. See .claude/rules/testing.md.

import { test, assert, assertEqual, loadJson } from './harness.js';
import { runSimulation } from '../engine/index.js';

async function golden() {
  return loadJson('../dossiers/golden/config.json');
}

function perUserComponentIds(config, variantId) {
  const v = config.bidVariants.find((x) => x.id === variantId);
  return new Set((v?.costComponentValues || []).filter((c) => c.periodicity === 'PER_USER' || c.periodicity === 'PER_USER_PER_PERIOD').map((c) => c.id));
}

test('IN-01 Σ cost_contributions = comparison_price', async () => {
  const { scenarioResults } = await runSimulation(await golden());
  for (const r of scenarioResults) {
    const sum = r.costContributions.reduce((acc, c) => acc + c.money.minor, 0n);
    assertEqual(sum, r.comparisonPrice.minor, `IN-01 ${r.ref}/${r.populationStateId}`);
  }
});

test('IN-02 Σ segment_contributions = total of per-user components', async () => {
  const config = await golden();
  const { scenarioResults } = await runSimulation(config);
  for (const r of scenarioResults.filter((x) => x.kind === 'variant')) {
    const perUser = perUserComponentIds(config, r.ref);
    const perUserTotal = r.costContributions.filter((c) => perUser.has(c.componentId)).reduce((acc, c) => acc + c.money.minor, 0n);
    const segTotal = r.segmentContributions.reduce((acc, s) => acc + s.money.minor, 0n);
    assertEqual(segTotal, perUserTotal, `IN-02 ${r.ref}/${r.populationStateId}`);
  }
});

test('IN-03 Σ quality_contributions = quality_score', async () => {
  const { scenarioResults } = await runSimulation(await golden());
  for (const r of scenarioResults) {
    const sum = r.qualityContributions.reduce((acc, q) => acc + q.scaled, 0n);
    assertEqual(sum, r.qualityScoreScaled, `IN-03 ${r.ref}/${r.populationStateId}`);
  }
});

test('IN-04 price_score + quality_score = total_score (non-excluded)', async () => {
  const { scenarioResults } = await runSimulation(await golden());
  for (const r of scenarioResults.filter((x) => !x.excluded)) {
    assertEqual(r.priceScoreScaled + r.qualityScoreScaled, r.totalScaled, `IN-04 ${r.ref}/${r.populationStateId}`);
  }
});

test('IN-05 monotone: a higher comparison price never yields a higher price score', async () => {
  const { scenarioResults } = await runSimulation(await golden());
  const byState = new Map();
  for (const r of scenarioResults) {
    if (!byState.has(r.populationStateId)) byState.set(r.populationStateId, []);
    byState.get(r.populationStateId).push(r);
  }
  for (const rows of byState.values()) {
    const sorted = [...rows].sort((a, b) => (a.comparisonPrice.minor < b.comparisonPrice.minor ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      assert(sorted[i].priceScoreScaled <= sorted[i - 1].priceScoreScaled, 'IN-05 monotonicity');
    }
  }
});

test('IN-06 identical inputs -> identical outputs and same input_hash', async () => {
  const config = await golden();
  const a = await runSimulation(config);
  const b = await runSimulation(config);
  assertEqual(a.run.inputHash, b.run.inputHash, 'same input_hash');
  const project = (res) => res.scenarioResults.map((r) => `${r.populationStateId}/${r.ref}:${r.priceScoreScaled}/${r.qualityScoreScaled}/${r.totalScaled}/${r.rank}`).join('|');
  assertEqual(project(a), project(b), 'identical results');
});

test('IN-07 0 <= price_score <= price_points_max', async () => {
  const { scenarioResults } = await runSimulation(await golden());
  const maxScaled = 40n * 100n; // 40 at displayPrecision 2
  for (const r of scenarioResults) {
    assert(r.priceScoreScaled >= 0n && r.priceScoreScaled <= maxScaled, `IN-07 ${r.ref}/${r.populationStateId}`);
  }
});
