import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import BpmnModdle from 'bpmn-moddle';
import { readProcessYaml } from './yaml-reader.mjs';
import { resolveAndValidateProcessModel } from './yaml-validator.mjs';
import { lintProcessModel } from './semantic-linter.mjs';
import { buildReport } from './validation-report.mjs';
import { validateSemanticRoundTrip } from './semantic-roundtrip.mjs';
import { allFlows, allNodes, targetEngines } from './model-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const bpmnlintBin = path.join(packageRoot, 'node_modules/.bin/bpmnlint');
const bpmnlintConfig = path.resolve(__dirname, '../rules/.bpmnlintrc');

export async function validateBpmnFile({ bpmnPath, yamlPath, strict = false }) {
  const xml = await readFile(bpmnPath, 'utf8');
  let model = null;
  let validationContext = null;
  let preflightFindings = [];
  if (yamlPath) {
    const input = await readProcessYaml(yamlPath);
    const resolved = await resolveAndValidateProcessModel(input);
    model = resolved.model;
    validationContext = resolved.context;
    preflightFindings = resolved.findings;
  }
  return validateBpmnXml({ xml, model, schemaFindings: preflightFindings, validationContext, source: { bpmnPath, yamlPath }, strict });
}

export async function validateBpmnXml({ xml, model = null, schemaFindings = [], layoutFindings = [], validationContext = null, source = {}, strict = false }) {
  const findings = [...schemaFindings, ...layoutFindings];
  let definitions = null;
  try {
    const moddle = new BpmnModdle();
    const parsed = await moddle.fromXML(xml);
    definitions = parsed.rootElement;
    for (const warning of parsed.warnings || []) findings.push({ layer: 'artifact-parse', severity: 'warning', code: 'artifact.parse_warning', message: warning.message });
  } catch (error) {
    findings.push({ layer: 'artifact-parse', severity: 'error', code: 'artifact.parse_error', message: error.message });
  }
  if (definitions) findings.push(...structuralFindings(definitions, model));
  findings.push(...await runBpmnLint(xml));
  if (model) {
    if (!findings.some((finding) => finding.layer === 'semantics')) findings.push(...lintProcessModel(model));
    findings.push(...engineFindings(model));
  }
  const sourceIsValid = model && !findings.some((finding) => ['schema', 'references', 'capability', 'semantics'].includes(finding.layer) && finding.severity === 'error');
  const preservationEvaluated = Boolean(definitions && sourceIsValid);
  if (preservationEvaluated) findings.push(...validateSemanticRoundTrip(model, definitions));
  else if (!model) findings.push({ layer: 'round-trip', severity: 'info', code: 'roundtrip.not_evaluated', message: 'source YAML was not supplied; source-to-artifact preservation was not evaluated' });
  else if (!sourceIsValid) findings.push({ layer: 'round-trip', severity: 'info', code: 'roundtrip.source_invalid', message: 'source YAML has validation errors; source-to-artifact preservation was not evaluated' });
  return buildReport({ source, model, findings, strict, validationContext, preservationEvaluated });
}

async function runBpmnLint(xml) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'corp-bpmn-lint-'));
  const file = path.join(tmp, 'process.bpmn');
  try {
    await writeFile(file, xml, 'utf8');
    const result = await runProcess(bpmnlintBin, [file, '--config', bpmnlintConfig]);
    return parseBpmnLintOutput(result.stdout + result.stderr);
  } catch (error) {
    return [{ layer: 'bpmnlint', severity: 'warning', code: 'bpmnlint.unavailable', message: `bpmnlint could not run: ${error.message}` }];
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: packageRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', () => resolve({ stdout, stderr }));
  });
}

function parseBpmnLintOutput(output) {
  const findings = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s{2}(\S+)\s+(error|warning)\s+(.+?)\s{2,}([a-z0-9-]+)\s*$/i);
    if (!match) continue;
    findings.push({ layer: 'bpmnlint', severity: match[2].toLowerCase(), code: `bpmnlint.${match[4]}`, element: match[1], message: match[3].trim() });
  }
  return findings;
}

function structuralFindings(definitions, model) {
  const findings = [];
  const ids = new Set();
  walk(definitions, (element) => {
    if (!element.id) return;
    if (ids.has(element.id)) findings.push({ layer: 'artifact-parse', severity: 'error', code: 'artifact.duplicate_id', element: element.id, message: `duplicate BPMN id ${element.id}` });
    ids.add(element.id);
  });
  const xmlHasDi = (definitions.diagrams || []).length > 0;
  if (!xmlHasDi) findings.push({ layer: 'layout', severity: 'error', code: 'layout.missing_diagram', message: 'BPMN DI diagram is missing' });
  if (model && xmlHasDi) {
    const diRefs = new Set();
    for (const diagram of definitions.diagrams || []) {
      for (const element of diagram.plane?.planeElement || []) {
        const ref = element.bpmnElement;
        if (ref?.id) diRefs.add(ref.id);
        if (element.bounds && (element.bounds.width <= 20 || element.bounds.height <= 20)) findings.push({ layer: 'layout', severity: 'warning', code: 'layout.small_bounds', element: ref?.id, message: `${ref?.id || 'element'} has very small bounds` });
      }
    }
    for (const node of allNodes(model)) if (!diRefs.has(node.id) && node.type !== 'boundaryEvent') findings.push({ layer: 'layout', severity: 'warning', code: 'layout.missing_shape', element: node.id, message: `missing BPMNShape for ${node.id}` });
    for (const flow of [...allFlows(model), ...(model.message_flows || [])]) if (!diRefs.has(flow.id)) findings.push({ layer: 'layout', severity: 'warning', code: 'layout.missing_edge', element: flow.id, message: `missing BPMNEdge for ${flow.id}` });
  }
  return findings;
}

function engineFindings(model) {
  const findings = [];
  for (const { processId, target, nodes } of targetEngines(model)) {
    if (target === 'none') continue;
    for (const node of nodes) {
      if (node.type === 'serviceTask') findings.push({ layer: 'engine', severity: 'warning', code: 'engine.implementation_review', element: node.id, message: `${target} serviceTask ${node.id} in ${processId} requires implementation configuration outside the neutral schema` });
    }
  }
  return findings;
}

function walk(value, visitor, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visitor(value);
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$')) continue;
    if (Array.isArray(child)) child.forEach((item) => walk(item, visitor, seen));
    else if (child && typeof child === 'object') walk(child, visitor, seen);
  }
}
