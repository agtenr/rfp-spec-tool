// §9.4 boundary and failure tests. See .claude/rules/testing.md.

import { test, assert, assertEqual } from './harness.js';
import { runSimulation, validateConfiguration, fmtMoney, fmtPoints } from '../engine/index.js';

const clone = (o) => structuredClone(o);

function makeBase() {
  return {
    dossierId: 'BOUNDARY',
    configurationVersion: '1.0.0',
    sourceMethodologyVersion: 'synthetic',
    currency: 'EUR',
    calculationPrecision: 6,
    displayPrecision: 2,
    roundingMode: 'HALF_UP',
    evaluationHorizon: 2,
    periodUnit: 'YEAR',
    validationGate: 'GATE_1',
    secondReaderSignoff: true,
    methodology: {
      archetypeReference: 'LOWEST_PRICE_RATIO',
      pricePointsMax: '40',
      qualityPointsMax: '60',
      totalPointsMax: '100',
      exclusionRule: { level: 'TOTAL_QUALITY', thresholdValue: '50', thresholdBasis: 'PERCENT_OF_MAX', operator: 'GTE' },
      sourceLayer: 'base',
    },
    qualityCriteria: [{ id: 'q1', name: 'Quality', inputScaleMax: '100', weightedPointsMax: '60', isExclusionCriterion: false, sourceLayer: 'base' }],
    rates: [{ profileCategory: 'dev', amount: '100.00', outsideBusinessHours: false, provenance: 'SIMULATED' }],
    referenceSet: { ownVariantCountsInReferenceSet: true, excludedBidsCountInReferenceSet: false },
    imposedBasket: null,
    populationStates: [{ id: 'S1', name: 'S1', isApplicableToAllPeriods: true, segments: [{ id: 's1', name: 's1', count: 10, entitlementNotes: '' }] }],
    bidVariants: [{
      id: 'V1', name: 'V1',
      costComponentValues: [{ id: 'impl', name: 'Impl', type: 'FIXED', periodicity: 'ONE_OFF', applicableSegments: 'ALL', amount: '1000.00', obligation: 'REQUIRED_BY_SPEC', provenance: 'SIMULATED' }],
      rateSet: [], qualityAssumptions: [{ criterionReference: 'q1', assumedRawScore: '80', owner: 'x' }],
    }],
    competitors: [],
    competitiveField: { id: 'f', name: 'f', entries: [{ participantReference: 'V1', multiplicity: 1, eligibilityStatus: 'ELIGIBLE' }] },
    ambiguities: [], assumptions: [], expectedConsumption: null, budgetEnvelope: null,
  };
}

const rowOf = (result, ref, stateId = 'S1') => result.scenarioResults.find((r) => r.ref === ref && r.populationStateId === stateId);

test('§9.4 single cost component only -> comparison price equals that component', async () => {
  const result = await runSimulation(makeBase());
  assertEqual(fmtMoney(rowOf(result, 'V1').comparisonPrice, makeBase()), '1000.00', 'comparison price');
});

test('§9.4 one-off + recurring -> recurring × horizon; IN-01 holds', async () => {
  const c = makeBase();
  c.bidVariants[0].costComponentValues.push({ id: 'rec', name: 'Rec', type: 'OTHER', periodicity: 'PER_PERIOD', applicableSegments: 'ALL', amount: '100.00', obligation: 'OPTIONAL', provenance: 'SIMULATED' });
  const result = await runSimulation(c);
  const r = rowOf(result, 'V1');
  assertEqual(fmtMoney(r.comparisonPrice, c), '1200.00', '1000 + 100×2');
  const sum = r.costContributions.reduce((acc, x) => acc + x.money.minor, 0n);
  assertEqual(sum, r.comparisonPrice.minor, 'IN-01');
});

test('§9.4 per-user applicable to one segment -> other segments report an explicit zero line', async () => {
  const c = makeBase();
  c.populationStates[0].segments.push({ id: 's2', name: 's2', count: 5, entitlementNotes: '' });
  c.bidVariants[0].costComponentValues.push({ id: 'lic', name: 'Lic', type: 'PER_USER', periodicity: 'PER_USER', applicableSegments: ['s1'], amount: '10.00', obligation: 'OPTIONAL', provenance: 'SIMULATED' });
  const result = await runSimulation(c);
  const seg2 = rowOf(result, 'V1').segmentContributions.find((s) => s.segmentId === 's2');
  assert(seg2 !== undefined, 's2 line present');
  assertEqual(seg2.money.minor, 0n, 's2 is an explicit zero');
});

test('§9.4 basket PER_PERIOD -> basket × horizon', async () => {
  const c = makeBase();
  c.imposedBasket = { periodicity: 'PER_PERIOD', lines: [{ profileCategory: 'dev', quantity: { value: 1, unit: 'HOUR' } }] };
  const result = await runSimulation(c);
  const basket = rowOf(result, 'V1').costContributions.find((x) => x.componentId === 'imposed_basket');
  assertEqual(fmtMoney(basket.money, c), '200.00', '100 × 2 periods');
});

test('§9.4 zero-cost component -> included as a zero line, not omitted', async () => {
  const c = makeBase();
  c.bidVariants[0].costComponentValues.push({ id: 'zero', name: 'Zero', type: 'OTHER', periodicity: 'ONE_OFF', applicableSegments: 'ALL', amount: '0.00', obligation: 'OPTIONAL', provenance: 'SIMULATED' });
  const result = await runSimulation(c);
  const zero = rowOf(result, 'V1').costContributions.find((x) => x.componentId === 'zero');
  assert(zero !== undefined && zero.money.minor === 0n, 'zero line present');
});

test('§9.4 quality exactly at threshold under GTE -> passes', async () => {
  const c = makeBase();
  c.bidVariants[0].qualityAssumptions = [{ criterionReference: 'q1', assumedRawScore: '50', owner: 'x' }]; // 50/100×60 = 30 == threshold
  const result = await runSimulation(c);
  assertEqual(rowOf(result, 'V1').exclusionStatus, 'OK', 'at threshold passes under GTE');
});

test('§9.4 quality just below threshold -> EXCLUDED_QUALITY, no rank, no total', async () => {
  const c = makeBase();
  c.bidVariants[0].qualityAssumptions = [{ criterionReference: 'q1', assumedRawScore: '49', owner: 'x' }]; // 29.40 < 30
  const result = await runSimulation(c);
  const r = rowOf(result, 'V1');
  assertEqual(r.exclusionStatus, 'EXCLUDED_QUALITY', 'excluded');
  assertEqual(r.rank, null, 'no rank');
  assertEqual(r.totalScaled, null, 'no total');
});

test('§9.4 two equal comparison prices -> equal scores, shared rank, next rank skipped', async () => {
  const c = makeBase();
  c.bidVariants.push({ id: 'V2', name: 'V2', costComponentValues: clone(c.bidVariants[0].costComponentValues), rateSet: [], qualityAssumptions: [{ criterionReference: 'q1', assumedRawScore: '80', owner: 'x' }] });
  c.bidVariants.push({ id: 'V3', name: 'V3', costComponentValues: [{ id: 'impl', name: 'Impl', type: 'FIXED', periodicity: 'ONE_OFF', applicableSegments: 'ALL', amount: '2000.00', obligation: 'REQUIRED_BY_SPEC', provenance: 'SIMULATED' }], rateSet: [], qualityAssumptions: [{ criterionReference: 'q1', assumedRawScore: '80', owner: 'x' }] });
  c.competitiveField.entries.push({ participantReference: 'V2', multiplicity: 1, eligibilityStatus: 'ELIGIBLE' });
  c.competitiveField.entries.push({ participantReference: 'V3', multiplicity: 1, eligibilityStatus: 'ELIGIBLE' });
  const result = await runSimulation(c);
  assertEqual(rowOf(result, 'V1').priceScoreScaled, rowOf(result, 'V2').priceScoreScaled, 'equal scores');
  assertEqual(rowOf(result, 'V1').rank, 1, 'V1 rank 1');
  assertEqual(rowOf(result, 'V2').rank, 1, 'V2 shares rank 1');
  assertEqual(rowOf(result, 'V3').rank, 3, 'next rank skipped -> 3');
});

test('§9.4 empty reference set -> run BLOCKED, warning raised', async () => {
  const c = makeBase();
  c.referenceSet.ownVariantCountsInReferenceSet = false; // no competitors, own not counted -> empty ref set
  c.competitiveField.ownVariantCountsInReferenceSet = false;
  const result = await runSimulation(c);
  assertEqual(result.run.status, 'BLOCKED', 'blocked');
  assert(result.run.warnings.includes('empty reference set'), 'warning raised');
});

test('§9.4 non-positive comparison price -> run BLOCKED, warning raised', async () => {
  const c = makeBase();
  c.competitors.push({ id: 'Z', name: 'Zero-price', pricingMode: 'DIRECT_PRICE', comparisonPrice: '0.00', qualityAssumptions: [{ criterionReference: 'q1', assumedRawScore: '80', owner: 'x' }] });
  c.competitiveField.entries.push({ participantReference: 'Z', multiplicity: 1, eligibilityStatus: 'ELIGIBLE' });
  const result = await runSimulation(c);
  assertEqual(result.run.status, 'BLOCKED', 'blocked');
  assert(result.run.warnings.includes('non-positive comparison price'), 'warning raised');
});

test('§9.4 missing periodicity -> VA-04 BLOCK', async () => {
  const c = makeBase();
  delete c.bidVariants[0].costComponentValues[0].periodicity;
  const v = validateConfiguration(c);
  assert(v.errors.some((e) => e.startsWith('VA-04')), 'VA-04 raised');
});

test('§9.4 unknown segment on per-user component -> VA-05 BLOCK', async () => {
  const c = makeBase();
  c.bidVariants[0].costComponentValues.push({ id: 'lic', name: 'Lic', type: 'PER_USER', periodicity: 'PER_USER', applicableSegments: ['nope'], amount: '10.00', obligation: 'OPTIONAL', provenance: 'SIMULATED' });
  const v = validateConfiguration(c);
  assert(v.errors.some((e) => e.startsWith('VA-05')), 'VA-05 raised');
});

test('§9.4 quality assumption above input scale -> VA-08 BLOCK', async () => {
  const c = makeBase();
  c.bidVariants[0].qualityAssumptions = [{ criterionReference: 'q1', assumedRawScore: '150', owner: 'x' }];
  const v = validateConfiguration(c);
  assert(v.errors.some((e) => e.startsWith('VA-08')), 'VA-08 raised');
});

test('§9.4 weightings not summing to maximum -> VA-02 BLOCK', async () => {
  const c = makeBase();
  c.qualityCriteria[0].weightedPointsMax = '50'; // != qualityPointsMax 60
  const v = validateConfiguration(c);
  assert(v.errors.some((e) => e.startsWith('VA-02')), 'VA-02 raised');
});
