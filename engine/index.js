// Public engine API. Generic and reusable across dossiers; contains NO dossier data and NO DOM
// (AR-02, engine-architecture.md).

export { runSimulation } from './scenario_runner/run.js';
export { validateConfiguration } from './validation/validate.js';
export { toCsv, COLUMNS } from './reporters/machine.js';
export { buildReport, exportAssumptionRegister } from './reporters/human.js';
export { metadataBlock, fmtMoney, fmtPoints } from './reporters/format.js';
export { ENGINE_VERSION } from './run_identity/identity.js';
export { ENVELOPE_LABEL } from './envelope/envelope.js';
export * as money from './value_objects/money.js';
export * as numeric from './numeric.js';
