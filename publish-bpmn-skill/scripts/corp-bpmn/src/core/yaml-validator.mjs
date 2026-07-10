import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { prepareProcessModel, processScopes } from './model-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPaths = new Map([
  [1, path.resolve(__dirname, '../schemas/process.v1.schema.json')],
  [2, path.resolve(__dirname, '../schemas/process.v2.schema.json')]
]);
const capabilityPath = path.resolve(__dirname, '../capabilities/capability-matrix.json');
const ELIGIBLE_MESSAGE_TYPES = new Set(['sendTask', 'receiveTask', 'intermediateCatchEvent', 'intermediateThrowEvent']);
const CONDITIONAL_SOURCE_TYPES = new Set([
  'task', 'userTask', 'serviceTask', 'manualTask', 'businessRuleTask', 'scriptTask', 'sendTask', 'receiveTask',
  'callActivity', 'subProcess', 'transaction', 'exclusiveGateway', 'inclusiveGateway', 'complexGateway'
]);
let cachedRegistry;
let cachedCapabilities;

export async function validateProcessModel(input) {
  const result = await resolveAndValidateProcessModel(input);
  return result.findings;
}

export async function resolveAndValidateProcessModel(input) {
  const prepared = prepareProcessModel(input);
  const { model, context } = prepared;
  const findings = [...prepared.findings];
  if (!Number.isInteger(context.resolvedVersion)) {
    findings.push(versionError('schema.version_invalid', context.declaredVersion, 'schema_version must be an integer'));
    return { model, context, findings };
  }
  if (!schemaPaths.has(context.resolvedVersion)) {
    findings.push(versionError('schema.version_unsupported', context.declaredVersion, `schema_version ${context.declaredVersion} is not supported`));
    return { model, context, findings };
  }

  const registry = await getSchemaRegistry();
  const validate = registry.get(context.resolvedVersion);
  if (!validate(model)) findings.push(...(validate.errors || []).map(schemaFinding));
  findings.push(...await capabilityFindings(model, context.resolvedVersion));
  findings.push(...referenceFindings(model));
  return { model, context, findings: dedupeFindings(findings) };
}

export async function compileProcessSchemas() {
  return getSchemaRegistry();
}

async function getSchemaRegistry() {
  if (!cachedRegistry) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const entries = await Promise.all([...schemaPaths].map(async ([version, schemaPath]) => {
      const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
      return [version, ajv.compile(schema)];
    }));
    cachedRegistry = new Map(entries);
  }
  return cachedRegistry;
}

async function getCapabilities() {
  if (!cachedCapabilities) cachedCapabilities = JSON.parse(await readFile(capabilityPath, 'utf8'));
  return cachedCapabilities;
}

async function capabilityFindings(model, version) {
  const matrix = await getCapabilities();
  const status = new Map(matrix.capabilities.filter((item) => item.versions.includes(version)).map((item) => [item.id, item.status]));
  const findings = [];
  for (const scope of processScopes(model)) {
    for (const node of scope.nodes || []) {
      const capability = `node.${node.type}`;
      if (!status.has(capability) || status.get(capability) === 'unsupported') {
        findings.push(capabilityError(capability, node.id, `/processes/${escapePointer(scope.process.id || '')}/nodes/${escapePointer(node.id || '')}/type`));
      } else if (status.get(capability) === 'partial') {
        findings.push({ layer: 'capability', severity: 'warning', code: 'capability.partial', element: node.id, path: `/nodes/${escapePointer(node.id || '')}/type`, message: `${capability} requires manual layout or engine review` });
      }
    }
    if ((scope.data || []).length) findings.push(capabilityError('data', scope.process.id, `/processes/${escapePointer(scope.process.id || '')}/data`));
    if ((scope.artifacts || []).length) findings.push(capabilityError('artifacts', scope.process.id, `/processes/${escapePointer(scope.process.id || '')}/artifacts`));
    if (Object.keys(scope.extensions || {}).length) findings.push(capabilityError('extensions', scope.process.id, `/processes/${escapePointer(scope.process.id || '')}/extensions`));
  }
  if (Object.keys(model.extensions || {}).length) findings.push(capabilityError('extensions', undefined, '/extensions'));
  if (version === 1 && (model.participants || []).length > 1) findings.push(capabilityError('collaboration.multi-process', undefined, '/participants'));
  if (version === 1 && (model.message_flows || []).length) findings.push(capabilityError('message-flow', undefined, '/message_flows'));
  return findings;
}

function referenceFindings(model) {
  const findings = [];
  const ids = new Map();
  const scopes = processScopes(model);
  if (model.schema_version === 2 && model.definitions?.id) collectId(ids, model.definitions.id, 'definitions', '/definitions/id', findings);
  for (const scope of scopes) collectId(ids, scope.process?.id, 'process', processPath(model, scope, 'id'), findings);
  for (const participant of model.participants || []) collectId(ids, participant.id, 'participant', `/participants/${escapePointer(participant.id || '')}`, findings);
  for (const scope of scopes) {
    for (const lane of scope.lanes || []) collectId(ids, lane.id, 'lane', processPath(model, scope, `lanes/${escapePointer(lane.id || '')}`), findings);
    for (const node of scope.nodes || []) collectId(ids, node.id, 'node', processPath(model, scope, `nodes/${escapePointer(node.id || '')}`), findings);
    for (const flow of scope.flows || []) collectId(ids, flow.id, 'sequenceFlow', processPath(model, scope, `flows/${escapePointer(flow.id || '')}`), findings);
  }
  for (const flow of model.message_flows || []) collectId(ids, flow.id, 'messageFlow', `/message_flows/${escapePointer(flow.id || '')}`, findings);

  if (model.schema_version === 1) validateV1References(model, scopes[0], findings);
  if (model.schema_version === 2) validateV2References(model, scopes, findings);
  return findings;
}

function validateV1References(model, scope, findings) {
  if (!scope) return;
  const participants = new Set((model.participants || []).map((participant) => participant.id));
  const lanes = new Set((scope.lanes || []).map((lane) => lane.id));
  validateScopeReferences(scope, { participants, allowParticipant: true }, findings, '/nodes', '/flows');
}

function validateV2References(model, scopes, findings) {
  const processById = new Map(scopes.map((scope) => [scope.process.id, scope]));
  const participantByProcess = new Map();
  for (const participant of model.participants || []) {
    if (!processById.has(participant.process_ref)) {
      findings.push(refError('references.unresolved_process', `/participants/${escapePointer(participant.id || '')}/process_ref`, participant.id, `process '${participant.process_ref}' does not exist`));
    }
    if (participantByProcess.has(participant.process_ref)) {
      findings.push(refError('semantics.shared_process_owner', `/participants/${escapePointer(participant.id || '')}/process_ref`, participant.id, `process '${participant.process_ref}' is already owned by participant '${participantByProcess.get(participant.process_ref)}'`));
    } else {
      participantByProcess.set(participant.process_ref, participant.id);
    }
  }
  const nodeOwner = new Map();
  const nodeById = new Map();
  for (const scope of scopes) {
    validateScopeReferences(scope, { participants: new Set(), allowParticipant: false }, findings, `/processes/${escapePointer(scope.process.id || '')}/nodes`, `/processes/${escapePointer(scope.process.id || '')}/flows`);
    for (const node of scope.nodes || []) {
      nodeOwner.set(node.id, scope.process.id);
      nodeById.set(node.id, node);
    }
  }
  const participantById = new Map((model.participants || []).map((participant) => [participant.id, participant]));
  for (const flow of model.message_flows || []) {
    const source = resolveMessageEndpoint(flow.from, participantById, nodeOwner, nodeById);
    const target = resolveMessageEndpoint(flow.to, participantById, nodeOwner, nodeById);
    if (!source) findings.push(refError('references.unresolved_message_endpoint', `/message_flows/${escapePointer(flow.id || '')}/from`, flow.id, `message source '${flow.from}' does not exist or is not eligible`));
    if (!target) findings.push(refError('references.unresolved_message_endpoint', `/message_flows/${escapePointer(flow.id || '')}/to`, flow.id, `message target '${flow.to}' does not exist or is not eligible`));
    if (source && target && source.processId === target.processId) {
      findings.push(refError('semantics.message_flow_same_process', `/message_flows/${escapePointer(flow.id || '')}`, flow.id, `message flow '${flow.id}' stays inside process '${source.processId}'`));
    }
  }
}

function validateScopeReferences(scope, options, findings, nodeBase, flowBase) {
  const nodes = new Map((scope.nodes || []).map((node) => [node.id, node]));
  const lanes = new Set((scope.lanes || []).map((lane) => lane.id));
  const flows = new Map((scope.flows || []).map((flow) => [flow.id, flow]));
  for (const node of scope.nodes || []) {
    const base = `${nodeBase}/${escapePointer(node.id || '')}`;
    if (node.lane && !lanes.has(node.lane)) findings.push(refError('references.unresolved_lane', `${base}/lane`, node.id, `lane '${node.lane}' does not exist in process '${scope.process.id}'`));
    if (options.allowParticipant && node.participant && !options.participants.has(node.participant)) findings.push(refError('references.unresolved_participant', `${base}/participant`, node.id, `participant '${node.participant}' does not exist`));
    if (node.attachedTo) {
      const target = nodes.get(node.attachedTo);
      if (!target) findings.push(refError('references.unresolved_attachment', `${base}/attachedTo`, node.id, `attached activity '${node.attachedTo}' does not exist in process '${scope.process.id}'`));
      else if (!isActivity(target.type)) findings.push(refError('semantics.invalid_boundary_attachment', `${base}/attachedTo`, node.id, `boundary event '${node.id}' cannot attach to ${target.type}`));
    }
    if (node.default) {
      const flow = flows.get(node.default);
      if (!flow || flow.from !== node.id) findings.push(refError('references.invalid_default', `${base}/default`, node.id, `default '${node.default}' must be an outgoing sequence-flow id`));
    }
  }
  for (const flow of scope.flows || []) {
    const base = `${flowBase}/${escapePointer(flow.id || '')}`;
    const source = nodes.get(flow.from);
    if (!source) findings.push(refError('references.unresolved_flow_source', `${base}/from`, flow.id, `source '${flow.from}' does not exist in process '${scope.process.id}'`));
    if (!nodes.has(flow.to)) findings.push(refError('references.unresolved_flow_target', `${base}/to`, flow.id, `target '${flow.to}' does not exist in process '${scope.process.id}'`));
    if (flow.condition && source && !CONDITIONAL_SOURCE_TYPES.has(source.type)) findings.push(refError('semantics.invalid_condition_source', `${base}/condition`, flow.id, `${source.type} '${source.id}' cannot own a conditional sequence flow`));
  }
}

function resolveMessageEndpoint(id, participantById, nodeOwner, nodeById) {
  const participant = participantById.get(id);
  if (participant) return { kind: 'participant', processId: participant.process_ref };
  const node = nodeById.get(id);
  if (node && ELIGIBLE_MESSAGE_TYPES.has(node.type)) return { kind: 'node', processId: nodeOwner.get(id) };
  return null;
}

function isActivity(type) {
  return /Task$/.test(type) || ['task', 'callActivity', 'subProcess', 'transaction'].includes(type);
}

function schemaFinding(error) {
  const code = error.keyword === 'additionalProperties' ? 'schema.additional_property'
    : error.keyword === 'required' ? 'schema.required'
      : error.keyword === 'enum' || error.keyword === 'const' || error.keyword === 'false schema' ? 'schema.variant'
        : `schema.${error.keyword}`;
  let pointer = error.instancePath || '/';
  if (error.keyword === 'required') pointer = `${pointer === '/' ? '' : pointer}/${escapePointer(error.params.missingProperty)}` || '/';
  if (error.keyword === 'additionalProperties') pointer = `${pointer === '/' ? '' : pointer}/${escapePointer(error.params.additionalProperty)}` || '/';
  return { layer: 'schema', severity: 'error', code, path: pointer, message: `${pointer} ${error.message}` };
}

function versionError(code, version, message) {
  return { layer: 'schema', severity: 'error', code, path: '/schema_version', message: `${message}; received ${JSON.stringify(version)}` };
}

function capabilityError(capability, element, path) {
  return { layer: 'capability', severity: 'error', code: 'capability.unsupported', element, path, message: `${capability} is not supported end to end by this skill release` };
}

function collectId(ids, id, kind, pathValue, findings) {
  if (!id) return;
  if (ids.has(id)) findings.push(refError('references.duplicate_id', pathValue, id, `id '${id}' is already used by ${ids.get(id).kind} at ${ids.get(id).path}`));
  else ids.set(id, { kind, path: pathValue });
}

function refError(code, pathValue, element, message) {
  return { layer: code.startsWith('semantics.') ? 'semantics' : 'references', severity: 'error', code, path: pathValue, element, message };
}

function processPath(model, scope, suffix) {
  return model.schema_version === 2 ? `/processes/${escapePointer(scope.process.id || '')}/${suffix}` : `/${suffix}`;
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = [finding.layer, finding.severity, finding.code, finding.path || '', finding.element || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
