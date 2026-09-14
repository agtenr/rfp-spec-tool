// Browser controller. Loads a dossier config (fetch or file-picker), runs the engine, and renders
// the two §6 outputs. Holds NO calculation logic — all scoring lives in /engine (frontend-ui.md).

import { runSimulation, buildReport, toCsv } from '../engine/index.js';

const $ = (id) => document.getElementById(id);
let lastResult = null;
let lastConfig = null;

$('run-btn').addEventListener('click', () => runFromUrl($('config-url').value.trim()));
$('config-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) file.text().then((t) => runWithConfig(JSON.parse(t))).catch(showError);
});
$('csv-btn').addEventListener('click', downloadCsv);

async function runFromUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
    await runWithConfig(await res.json());
  } catch (e) {
    showError(e);
  }
}

async function runWithConfig(config) {
  try {
    setStatus('Running…');
    lastConfig = config;
    lastResult = await runSimulation(config);
    render(buildReport(lastResult, config), lastResult);
    $('csv-btn').disabled = lastResult.scenarioResults.length === 0;
    const s = lastResult.run.status;
    setStatus(s === 'OK' ? `<span class="ok">Run OK — ${lastResult.scenarioResults.length} scenario rows.</span>` : `<span class="err">Run ${s}. See warnings below.</span>`);
  } catch (e) {
    showError(e);
  }
}

function downloadCsv() {
  if (!lastResult) return;
  const blob = new Blob([toCsv(lastResult, lastConfig)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `scenario-results-${lastResult.run.runId}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function render(report, result) {
  $('gate-badge').textContent = report.header.validation_gate || 'Gate ?';
  const parts = [];

  // 1. Header / metadata (§6.1).
  parts.push(section('Report metadata', metaBlock(report.header)));

  // 2. Scenario comparison.
  parts.push(section('Scenario comparison', report.scenarioComparison.map((st) => `
    <h3>${esc(st.stateName || st.stateId)}</h3>
    ${table(['Participant', 'Comparison price', 'Price (calculated)', 'Quality (assumed)', 'Exclusion', 'Total', 'Rank', 'Margin'],
      st.rows.map((r) => [r.participant, r.comparisonPrice, r.priceScoreCalculated, r.qualityScoreAssumed, r.exclusionStatus, r.total, r.rank, r.margin]),
      st.rows.map((r) => r.exclusionStatus !== 'OK'))}
  `).join('')));

  // 3. Quality compensation.
  parts.push(section('Quality compensation', report.compensation.map((c) => `
    <h3>${esc(c.stateName || c.stateId)}</h3>
    ${table(['Pair', 'Required Δ', 'Assumed Δ', 'Gap', 'Required % of quality', 'Status'],
      c.pairs.map((p) => [p.pair, p.required ?? '', p.assumed ?? '', p.gap ?? '', p.requiredPctOfQuality, p.status]))}
  `).join('') || '<p class="tag">No own-variant pairs.</p>'));

  // 4. Ambiguity spread.
  parts.push(section('Ambiguity spread', report.ambiguitySpread.length
    ? report.ambiguitySpread.map((a) => `<h3>${esc(a.ambiguityId)}</h3>` + a.variants.map((v) => `
        <p class="tag">Variant ${esc(v.variantId)} — spread ${esc(v.spread)}</p>
        ${table(['Reading', 'State', 'Comparison price', 'Total'], v.perReading.map((x) => [x.reading, x.stateId, x.comparisonPrice, x.total]))}
      `).join('')).join('')
    : '<p class="tag">No registered ambiguities.</p>'));

  // 5. Envelope.
  parts.push(section('Budget envelope', report.envelope.length
    ? table(['State', 'Variant', 'Per-period cost', 'Annual ceiling', 'Headroom', 'Status'],
        report.envelope.map((e) => [e.stateId, e.variantId, e.perPeriodCost, e.annualCeiling, e.headroom, e.status]))
      + `<p class="tag">${esc(report.envelope[0].label)}</p>`
    : '<p class="tag">Not assessed.</p>'));

  // 6. Assumption register.
  parts.push(section('Assumption register', report.assumptionRegister.length
    ? table(['#', 'Assumption', 'Source ambiguity', 'Selected reading', 'Owner'],
        report.assumptionRegister.map((a) => [a.number, a.text, a.sourceAmbiguity, a.selectedReading, a.owner]))
    : '<p class="tag">No numbered assumptions recorded.</p>'));

  // 7. Warnings.
  parts.push(section('Warnings', report.warnings.length
    ? '<ul>' + report.warnings.map((w) => `<li>${esc(w)}</li>`).join('') + '</ul>'
    : '<p class="tag">None.</p>'));

  $('report').innerHTML = parts.join('');
}

function metaBlock(h) {
  const rows = Object.entries(h).map(([k, v]) => `<div><code>${esc(k)}</code>: ${esc(String(v))}</div>`).join('');
  return `<div class="meta">${rows}</div>`;
}

function section(title, inner) {
  return `<section><h2>${esc(title)}</h2>${inner}</section>`;
}

function table(headers, rows, excludedFlags = []) {
  const head = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`;
  const body = rows.map((r, i) => `<tr class="${excludedFlags[i] ? 'excluded' : ''}">${r.map((c) => `<td>${esc(c === null || c === undefined ? '' : c)}</td>`).join('')}</tr>`).join('');
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function setStatus(html) { $('status').innerHTML = html; }
function showError(e) { setStatus(`<div class="err">${esc(e.message || e)}</div>`); }

// Auto-run the golden fixture on load for a first look.
runFromUrl($('config-url').value.trim());
