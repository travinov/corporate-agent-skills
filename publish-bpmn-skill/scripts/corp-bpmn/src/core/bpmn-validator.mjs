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
import {
  boundsOverlap, containsBounds, finiteBounds, pointOnBoundary,
  routeIntersectsBounds, routeSignature, routesCross
} from './spatial-geometry.mjs';

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
  if (definitions) {
    findings.push(...structuralFindings(definitions, model));
    findings.push(...spatialFindings(definitions));
  }
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

export function spatialFindings(definitions) {
  const findings = [];
  const shapes = new Map();
  const edges = [];
  for (const diagram of definitions.diagrams || []) {
    for (const di of diagram.plane?.planeElement || []) {
      const element = di.bpmnElement;
      if (di.$type === 'bpmndi:BPMNShape' && element?.id) {
        const bounds = finiteBounds(di.bounds);
        if (!bounds) findings.push(layoutError('layout.shape.invalid_bounds', element.id, `${element.id} has invalid numeric bounds`));
        else shapes.set(element.id, { element, bounds });
      }
      if (di.$type === 'bpmndi:BPMNEdge' && element?.id) edges.push({ element, waypoints: (di.waypoint || []).map((point) => ({ x: Number(point.x), y: Number(point.y) })) });
    }
  }

  const participants = [...shapes.values()].filter((item) => item.element.$type === 'bpmn:Participant');
  const lanes = [...shapes.values()].filter((item) => item.element.$type === 'bpmn:Lane');
  const nodes = [...shapes.values()].filter((item) => isFlowNode(item.element));
  const participantByProcess = new Map(participants.map((item) => [item.element.processRef?.id, item]));
  const laneByNode = new Map();
  for (const lane of lanes) for (const node of lane.element.flowNodeRef || []) laneByNode.set(node.id, lane);

  for (const lane of lanes) {
    const participant = participantByProcess.get(owningProcess(lane.element)?.id);
    if (participant && !containsBounds(participant.bounds, lane.bounds)) {
      findings.push(layoutError('layout.shape.outside_pool', lane.element.id, `${lane.element.id} lies outside participant ${participant.element.id}`));
    }
  }

  for (const node of nodes) {
    const process = owningProcess(node.element);
    const participant = participantByProcess.get(process?.id);
    if (participant && !containsBounds(participant.bounds, node.bounds)) {
      findings.push(layoutError('layout.shape.outside_pool', node.element.id, `${node.element.id} lies outside participant ${participant.element.id}`));
    }
    const lane = laneByNode.get(node.element.id);
    if (lane && !containsBounds(lane.bounds, node.bounds)) {
      findings.push(layoutError('layout.shape.outside_lane', node.element.id, `${node.element.id} lies outside lane ${lane.element.id}`));
    }
  }
  for (let first = 0; first < participants.length; first += 1) for (let second = first + 1; second < participants.length; second += 1) {
    if (boundsOverlap(participants[first].bounds, participants[second].bounds)) findings.push(layoutError('layout.pool.overlap', participants[first].element.id, `participants ${participants[first].element.id} and ${participants[second].element.id} overlap`));
  }
  for (let first = 0; first < nodes.length; first += 1) for (let second = first + 1; second < nodes.length; second += 1) {
    if (boundaryAttachmentPair(nodes[first].element, nodes[second].element)) continue;
    if (boundsOverlap(nodes[first].bounds, nodes[second].bounds)) findings.push(layoutWarning('layout.shape.overlap', nodes[first].element.id, `${nodes[first].element.id} overlaps ${nodes[second].element.id}`));
  }

  const validEdges = [];
  const signatures = new Map();
  for (const edge of edges) {
    if (edge.waypoints.length < 2 || edge.waypoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      findings.push(layoutError('layout.edge.invalid_waypoints', edge.element.id, `${edge.element.id} requires at least two finite numeric waypoints`));
      continue;
    }
    const sourceId = edge.element.sourceRef?.id; const targetId = edge.element.targetRef?.id;
    const source = shapes.get(sourceId); const target = shapes.get(targetId);
    if (source && !pointOnBoundary(edge.waypoints[0], source.bounds)) findings.push(layoutError('layout.endpoint.detached', edge.element.id, `${edge.element.id} source waypoint is detached from ${sourceId}`));
    if (target && !pointOnBoundary(edge.waypoints.at(-1), target.bounds)) findings.push(layoutError('layout.endpoint.detached', edge.element.id, `${edge.element.id} target waypoint is detached from ${targetId}`));
    for (const obstacle of nodes) {
      if ([sourceId, targetId].includes(obstacle.element.id)) continue;
      if (routeIntersectsBounds(edge.waypoints, obstacle.bounds)) findings.push(layoutError('layout.route.through_shape', edge.element.id, `${edge.element.id} passes through ${obstacle.element.id}`, obstacle.element.id));
    }
    const signature = routeSignature(edge.waypoints);
    if (signatures.has(signature)) findings.push(layoutWarning('layout.route.duplicate', edge.element.id, `${edge.element.id} duplicates route ${signatures.get(signature)}`, signatures.get(signature)));
    else signatures.set(signature, edge.element.id);
    validEdges.push(edge);
  }
  for (let first = 0; first < validEdges.length; first += 1) for (let second = first + 1; second < validEdges.length; second += 1) {
    const left = validEdges[first]; const right = validEdges[second];
    const leftEnds = new Set([left.element.sourceRef?.id, left.element.targetRef?.id]);
    if ([right.element.sourceRef?.id, right.element.targetRef?.id].some((id) => leftEnds.has(id))) continue;
    if (routesCross(left.waypoints, right.waypoints)) findings.push(layoutWarning('layout.route.crossing', left.element.id, `${left.element.id} crosses ${right.element.id}`, right.element.id));
  }
  return findings;
}

function isFlowNode(element) {
  return element?.$type?.startsWith('bpmn:') && !['bpmn:Participant', 'bpmn:Lane', 'bpmn:Process', 'bpmn:Collaboration', 'bpmn:SequenceFlow', 'bpmn:MessageFlow'].includes(element.$type);
}

function owningProcess(element) {
  let current = element;
  while (current && current.$type !== 'bpmn:Process') current = current.$parent;
  return current;
}

function boundaryAttachmentPair(first, second) {
  return first.attachedToRef?.id === second.id || second.attachedToRef?.id === first.id;
}

function layoutError(code, element, message, relatedElement) {
  return { layer: 'layout', severity: 'error', code, element, relatedElement, message };
}

function layoutWarning(code, element, message, relatedElement) {
  return { layer: 'layout', severity: 'warning', code, element, relatedElement, message };
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
