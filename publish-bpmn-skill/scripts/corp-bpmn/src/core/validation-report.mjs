import { processScopes } from './model-utils.mjs';

const LAYER_ALIASES = new Map([
  ['bpmn-parse', 'artifact-parse'],
  ['bpmn-structure', 'artifact-parse'],
  ['semantic', 'semantics']
]);

export function buildReport({ source = {}, model = null, findings = [], strict = false, validationContext = null, preservationEvaluated = false }) {
  const normalized = dedupe(findings.map(normalizeFinding));
  const errors = normalized.filter((finding) => finding.severity === 'error');
  const warnings = normalized.filter((finding) => finding.severity === 'warning');
  const infos = normalized.filter((finding) => finding.severity === 'info');
  const resolvedVersion = validationContext?.resolvedVersion ?? model?.schema_version ?? null;
  const declaredVersion = validationContext ? validationContext.declaredVersion : (model?.schema_version ?? null);
  return {
    report_version: 1,
    schema_version: resolvedVersion,
    declared_schema_version: declaredVersion,
    source,
    process: processSummary(model),
    preservation: preservationEvaluated ? 'evaluated' : 'not-evaluated',
    summary: {
      status: errors.length || (strict && warnings.length) ? 'failed' : 'passed',
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
      strict
    },
    findings: normalized
  };
}

export function exitCodeForReport(report, strict = false) {
  const blockers = (report.findings || []).filter((finding) => finding.severity === 'error' || (strict && finding.severity === 'warning'));
  if (!blockers.length) return 0;
  const layers = new Set(blockers.map((finding) => finding.layer));
  if (layers.has('migration')) return 7;
  if (layers.has('generation')) return 2;
  if (layers.has('layout')) return 3;
  if (layers.has('artifact-parse')) return 4;
  if (layers.has('round-trip') || layers.has('bpmnlint') || layers.has('engine')) return 5;
  return 1;
}

function processSummary(model) {
  if (!model) return null;
  const scopes = processScopes(model);
  if (model.schema_version === 1) {
    const process = scopes[0]?.process;
    return process ? { id: process.id, name: process.name, target_engine: process.target_engine || 'none' } : null;
  }
  return scopes.map((scope) => ({ id: scope.process.id, name: scope.process.name, target_engine: scope.process.target_engine || 'none' }));
}

function normalizeFinding(finding) {
  const layer = LAYER_ALIASES.get(finding.layer) || finding.layer || 'unknown';
  return {
    layer,
    severity: finding.severity || 'warning',
    code: finding.code || 'unknown',
    element: finding.element,
    relatedElement: finding.relatedElement,
    path: finding.path,
    message: finding.message || String(finding)
  };
}

function dedupe(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = [finding.layer, finding.severity, finding.code, finding.element || '', finding.relatedElement || '', finding.path || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
