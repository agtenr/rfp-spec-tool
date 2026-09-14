// Shared display formatting for reporters. Money is rounded once from the calculation scale to
// displayPrecision (NUM-02/03); points are already at displayPrecision. See numeric-and-money.md.

import { formatMoney } from '../value_objects/money.js';
import { formatScaled } from '../numeric.js';

export function fmtMoney(m, config) {
  return formatMoney(m, config.calculationPrecision, config.displayPrecision, config.roundingMode);
}

export function fmtPoints(scaled, config) {
  if (scaled === null || scaled === undefined) return '';
  return formatScaled(scaled, config.displayPrecision);
}

export function fmtRaw(scaled, rawScale) {
  if (scaled === null || scaled === undefined) return '';
  return formatScaled(scaled, rawScale);
}

// Metadata block required on every output (§6.1).
export function metadataBlock(run, config) {
  return {
    run_id: run.runId,
    dossier_id: run.dossierId,
    configuration_version: run.configurationVersion,
    engine_version: run.engineVersion,
    input_hash: run.inputHash,
    generated_at: new Date().toISOString(),
    validation_gate: run.validationGate,
    confidentiality_classification: config.confidentialityClassification || 'CONFIDENTIAL',
    provenance_note: 'Figures marked DERIVED or SIMULATED are not measured.',
    status: run.status,
  };
}
