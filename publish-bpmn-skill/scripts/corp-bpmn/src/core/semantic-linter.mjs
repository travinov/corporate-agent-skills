import { processScopes } from './model-utils.mjs';

const START_TYPES = new Set(['startEvent']);
const END_TYPES = new Set(['endEvent']);
const GATEWAY_TYPES = new Set(['exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway']);
const USER_TYPES = new Set(['userTask']);
const SERVICE_TYPES = new Set(['serviceTask']);
const MESSAGE_SOURCE_TYPES = new Set(['sendTask', 'intermediateThrowEvent']);
const MESSAGE_TARGET_TYPES = new Set(['receiveTask', 'intermediateCatchEvent']);

export function lintProcessModel(model = {}) {
  const findings = [];
  for (const scope of processScopes(model)) findings.push(...lintScope(scope));
  findings.push(...messageEndpointFindings(model));
  return findings;
}

function messageEndpointFindings(model) {
  if (model.schema_version !== 2) return [];
  const scopes = new Map(processScopes(model).map((scope) => [scope.process.id, scope]));
  const participants = new Map((model.participants || []).map((participant) => [participant.id, participant]));
  const findings = [];
  for (const flow of model.message_flows || []) {
    for (const [field, eligible] of [['from', MESSAGE_SOURCE_TYPES], ['to', MESSAGE_TARGET_TYPES]]) {
      const participant = participants.get(flow[field]);
      if (!participant) continue;
      const concrete = (scopes.get(participant.process_ref)?.nodes || []).some((node) => eligible.has(node.type));
      if (!concrete) continue;
      findings.push({
        layer: 'semantics',
        severity: 'warning',
        code: 'semantic.message_endpoint.participant_ambiguous',
        path: `/message_flows/${escapePointer(flow.id)}/${field}`,
        element: participant.id,
        message: `participant '${participant.id}' hides a concrete ${field === 'from' ? 'sending' : 'receiving'} activity in process '${participant.process_ref}'`
      });
    }
  }
  return findings;
}

function lintScope(scope) {
  const findings = [];
  const nodes = scope.nodes || [];
  const flows = scope.flows || [];
  const outgoing = indexFlows(flows, 'from');
  const incoming = indexFlows(flows, 'to');
  const starts = nodes.filter((node) => START_TYPES.has(node.type));
  const ends = nodes.filter((node) => END_TYPES.has(node.type));

  if (!starts.length) findings.push(error('semantic.missing_start', 'process must have at least one startEvent'));
  if (!ends.length) findings.push(error('semantic.missing_end', 'process must have at least one endEvent'));

  for (const node of nodes) {
    const out = outgoing.get(node.id) || [];
    const inc = incoming.get(node.id) || [];
    if (!START_TYPES.has(node.type) && !inc.length && !node.attachedTo) {
      findings.push(error('semantic.unreachable', `${node.id} has no incoming flow`, node.id));
    }
    if (!END_TYPES.has(node.type) && !out.length && node.type !== 'boundaryEvent') {
      findings.push(error('semantic.dead_end', `${node.id} has no outgoing flow`, node.id));
    }
    if (!GATEWAY_TYPES.has(node.type) && out.length > 1) {
      findings.push(warn('semantic.implicit_split', `${node.id} has multiple outgoing flows but is not a gateway`, node.id));
    }
    if (node.type === 'exclusiveGateway') {
      const gatewayName = (node.name || '').trim();
      if (!hasLetters(gatewayName)) {
        findings.push(warn('semantic.gateway_name', `exclusiveGateway ${node.id} should have a clear decision name`, node.id));
      } else if (isEnglishLabel(gatewayName) && !gatewayName.endsWith('?')) {
        findings.push(warn('semantic.gateway_question', `exclusiveGateway ${node.id} should be named as a question`, node.id));
      }
      if (out.length > 1) {
        const defaultFlow = resolveDefaultFlow(node.default, out);
        for (const flow of out) {
          if (!hasText(flow.label) && !hasText(flow.condition) && flow !== defaultFlow) {
            findings.push(error('semantic.gateway_labels', `exclusiveGateway ${node.id} outgoing flow ${flow.id} must have a label, condition, or valid default semantics`, flow.id));
          }
        }
      }
    }
    if (USER_TYPES.has(node.type) && !node.lane) {
      findings.push(error('semantic.user_task_lane', `userTask ${node.id} must belong to a lane`, node.id));
    }
    if (SERVICE_TYPES.has(node.type) && (scope.process.target_engine || 'none') !== 'none') {
      findings.push(warn('semantic.service_task_implementation', `serviceTask ${node.id} requires engine-profile implementation review`, node.id));
    }
    if (isTask(node.type)) {
      const taskName = (node.name || '').trim();
      if (!hasLetters(taskName)) {
        findings.push(warn('semantic.task_name', `task ${node.id} should have a clear action name`, node.id));
      } else if (isEnglishLabel(taskName) && !startsWithVerb(taskName)) {
        findings.push(warn('semantic.task_verb', `task ${node.id} name should start with a verb`, node.id));
      }
    }
  }

  findings.push(...reachabilityFindings(nodes, starts, ends, outgoing));
  findings.push(...cycleFindings(nodes, ends, outgoing));
  return findings;
}

function indexFlows(flows, key) {
  const index = new Map();
  for (const flow of flows) {
    const value = flow[key];
    index.set(value, [...(index.get(value) || []), flow]);
  }
  return index;
}

function reachabilityFindings(nodes, starts, ends, outgoing) {
  const findings = [];
  const reachable = new Set();
  const queue = starts.map((node) => node.id);
  while (queue.length) {
    const id = queue.shift();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const flow of outgoing.get(id) || []) queue.push(flow.to);
  }
  for (const node of nodes) {
    if (!reachable.has(node.id) && node.type !== 'boundaryEvent') {
      findings.push(error('semantic.unreachable_from_start', `${node.id} is not reachable from any startEvent`, node.id));
    }
  }
  const canReachEnd = new Set();
  for (const node of nodes) {
    if (pathToEnd(node.id, new Set(), ends, outgoing)) canReachEnd.add(node.id);
  }
  for (const node of nodes) {
    if (!END_TYPES.has(node.type) && !canReachEnd.has(node.id)) {
      findings.push(error('semantic.no_path_to_end', `${node.id} cannot reach any endEvent`, node.id));
    }
  }
  return findings;
}

function pathToEnd(id, seen, ends, outgoing) {
  if (ends.some((node) => node.id === id)) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  return (outgoing.get(id) || []).some((flow) => pathToEnd(flow.to, new Set(seen), ends, outgoing));
}

function cycleFindings(nodes, ends, outgoing) {
  const findings = [];
  const visited = new Set();
  const stack = new Set();
  const cycles = new Set();
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) dfs(node.id);
  for (const cycleStart of cycles) {
    if (pathToEnd(cycleStart, new Set(), ends, outgoing)) {
      findings.push(info('semantic.cycle_with_exit', `cycle involving ${cycleStart} has a reachable exit`, cycleStart));
    } else {
      findings.push(error('semantic.cycle_without_exit', `cycle involving ${cycleStart} has no reachable exit`, cycleStart));
    }
  }
  return findings;

  function dfs(id) {
    if (!nodeIds.has(id)) return;
    if (stack.has(id)) {
      cycles.add(id);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    for (const flow of outgoing.get(id) || []) dfs(flow.to);
    stack.delete(id);
  }
}

function isTask(type) {
  return /Task$/.test(type) || type === 'task' || type === 'callActivity';
}

function startsWithVerb(name) {
  return /^(approve|analyze|archive|build|calculate|check|collect|create|decide|deliver|do|generate|notify|prepare|process|receive|reject|request|review|send|submit|update|validate|verify)\b/i.test(name.trim());
}

function resolveDefaultFlow(defaultRef, outgoingFlows) {
  if (!defaultRef) return undefined;
  const matches = outgoingFlows.filter((flow) => flow.id === defaultRef);
  return matches.length === 1 ? matches[0] : undefined;
}

function hasText(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return typeof value?.body === 'string' && value.body.trim().length > 0;
}

function hasLetters(value) {
  return /\p{L}/u.test(value);
}

function isEnglishLabel(value) {
  const letters = value.match(/\p{L}/gu) || [];
  return letters.length > 0 && letters.every((letter) => /[A-Za-z]/.test(letter));
}

function error(code, message, element) {
  return { layer: 'semantics', severity: 'error', code, element, message };
}

function warn(code, message, element) {
  return { layer: 'semantics', severity: 'warning', code, element, message };
}

function info(code, message, element) {
  return { layer: 'semantics', severity: 'info', code, element, message };
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}
