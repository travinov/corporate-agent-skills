import { processScopes } from './model-utils.mjs';

const TYPE_FROM_BPMN = new Map([
  ['bpmn:StartEvent', 'startEvent'], ['bpmn:EndEvent', 'endEvent'],
  ['bpmn:IntermediateCatchEvent', 'intermediateCatchEvent'], ['bpmn:IntermediateThrowEvent', 'intermediateThrowEvent'],
  ['bpmn:BoundaryEvent', 'boundaryEvent'], ['bpmn:Task', 'task'], ['bpmn:UserTask', 'userTask'],
  ['bpmn:ServiceTask', 'serviceTask'], ['bpmn:ManualTask', 'manualTask'], ['bpmn:BusinessRuleTask', 'businessRuleTask'],
  ['bpmn:ScriptTask', 'scriptTask'], ['bpmn:SendTask', 'sendTask'], ['bpmn:ReceiveTask', 'receiveTask'],
  ['bpmn:CallActivity', 'callActivity'], ['bpmn:SubProcess', 'subProcess'], ['bpmn:Transaction', 'transaction'],
  ['bpmn:ExclusiveGateway', 'exclusiveGateway'], ['bpmn:ParallelGateway', 'parallelGateway'],
  ['bpmn:InclusiveGateway', 'inclusiveGateway'], ['bpmn:EventBasedGateway', 'eventBasedGateway'],
  ['bpmn:ComplexGateway', 'complexGateway']
]);

const EVENT_FROM_BPMN = new Map([
  ['bpmn:TimerEventDefinition', 'timer'], ['bpmn:MessageEventDefinition', 'message'],
  ['bpmn:ErrorEventDefinition', 'error'], ['bpmn:EscalationEventDefinition', 'escalation'],
  ['bpmn:SignalEventDefinition', 'signal'], ['bpmn:ConditionalEventDefinition', 'conditional'],
  ['bpmn:CompensateEventDefinition', 'compensation'], ['bpmn:LinkEventDefinition', 'link']
]);

export function projectSourceModel(model) {
  const processes = processScopes(model).map((scope) => ({
    id: scope.process.id,
    name: scope.process.name,
    executable: Boolean(scope.process.executable),
    lanes: sortById((scope.lanes || []).map((lane) => ({ id: lane.id, name: lane.name }))),
    nodes: sortById((scope.nodes || []).map((node) => sourceNode(node))),
    flows: sortById((scope.flows || []).map((flow) => sourceFlow(flow)))
  }));
  const defaultProcessId = processes[0]?.id;
  return normalize({
    schema_version: model.schema_version,
    target_namespace: model.schema_version === 2 ? (model.definitions.target_namespace || 'http://corp.example/bpmn') : (model.process.targetNamespace || 'http://corp.example/bpmn'),
    processes: sortById(processes),
    participants: sortById((model.participants || []).map((participant) => ({
      id: participant.id,
      name: participant.name,
      process_ref: model.schema_version === 2 ? participant.process_ref : defaultProcessId
    }))),
    message_flows: sortById((model.message_flows || []).map((flow) => ({ id: flow.id, from: flow.from, to: flow.to, label: optional(flow.label) })))
  });
}

export function projectBpmnDefinitions(definitions, schemaVersion) {
  const processes = (definitions.rootElements || []).filter((element) => element.$type === 'bpmn:Process').map((process) => {
    const laneByNode = new Map();
    for (const laneSet of process.laneSets || []) collectLanes(laneSet.lanes || [], laneByNode);
    const flowElements = process.flowElements || [];
    return {
      id: process.id,
      name: process.name,
      executable: Boolean(process.isExecutable),
      lanes: sortById((process.laneSets || []).flatMap((laneSet) => flattenLanes(laneSet.lanes || [])).map((lane) => ({ id: lane.id, name: lane.name }))),
      nodes: sortById(flowElements.filter((element) => element.$type !== 'bpmn:SequenceFlow').map((node) => parsedNode(node, laneByNode.get(node.id)))),
      flows: sortById(flowElements.filter((element) => element.$type === 'bpmn:SequenceFlow').map(parsedFlow))
    };
  });
  const collaboration = (definitions.rootElements || []).find((element) => element.$type === 'bpmn:Collaboration');
  return normalize({
    schema_version: schemaVersion,
    target_namespace: definitions.targetNamespace || 'http://corp.example/bpmn',
    processes: sortById(processes),
    participants: sortById((collaboration?.participants || []).map((participant) => ({ id: participant.id, name: participant.name, process_ref: participant.processRef?.id }))),
    message_flows: sortById((collaboration?.messageFlows || []).map((flow) => ({ id: flow.id, from: flow.sourceRef?.id, to: flow.targetRef?.id, label: optional(flow.name) })))
  });
}

export function compareSemanticProjections(expected, actual) {
  const findings = [];
  compareValue(expected, actual, '', findings, undefined);
  return findings;
}

export function validateSemanticRoundTrip(model, definitions) {
  return compareSemanticProjections(projectSourceModel(model), projectBpmnDefinitions(definitions, model.schema_version));
}

function sourceNode(node) {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    lane: optional(node.lane),
    event_definition: optional(node.eventDefinition),
    attached_to: optional(node.attachedTo),
    default: optional(node.default),
    documentation: optional(node.documentation)
  };
}

function sourceFlow(flow) {
  return {
    id: flow.id,
    from: flow.from,
    to: flow.to,
    label: optional(flow.label),
    condition: flow.condition ? { body: flow.condition.body, language: optional(flow.condition.language) } : undefined
  };
}

function parsedNode(node, lane) {
  return {
    id: node.id,
    type: TYPE_FROM_BPMN.get(node.$type) || node.$type,
    name: node.name,
    lane: optional(lane),
    event_definition: optional(EVENT_FROM_BPMN.get(node.eventDefinitions?.[0]?.$type)),
    attached_to: optional(node.attachedToRef?.id),
    default: optional(node.default?.id),
    documentation: optional(node.documentation?.[0]?.text)
  };
}

function parsedFlow(flow) {
  return {
    id: flow.id,
    from: flow.sourceRef?.id,
    to: flow.targetRef?.id,
    label: optional(flow.name),
    condition: flow.conditionExpression ? { body: flow.conditionExpression.body, language: optional(flow.conditionExpression.language) } : undefined
  };
}

function collectLanes(lanes, laneByNode) {
  for (const lane of lanes) {
    for (const node of lane.flowNodeRef || []) laneByNode.set(node.id, lane.id);
    collectLanes(lane.childLaneSet?.lanes || [], laneByNode);
  }
}

function flattenLanes(lanes) {
  return lanes.flatMap((lane) => [lane, ...flattenLanes(lane.childLaneSet?.lanes || [])]);
}

function compareValue(expected, actual, path, findings, element) {
  if (expected === actual) return;
  if (expected === undefined || actual === undefined) {
    findings.push(roundTripFinding(expected === undefined ? 'unexpected' : 'missing', path, expected, actual, element));
    return;
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const childElement = expected[index]?.id || actual[index]?.id || element;
      compareValue(expected[index], actual[index], `${path}/${index}`, findings, childElement);
    }
    return;
  }
  if (isObject(expected) && isObject(actual)) {
    const childElement = expected.id || actual.id || element;
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) compareValue(expected[key], actual[key], `${path}/${escapePointer(key)}`, findings, childElement);
    return;
  }
  findings.push(roundTripFinding('value_mismatch', path, expected, actual, element));
}

function roundTripFinding(kind, path, expected, actual, element) {
  let code = `roundtrip.${kind}`;
  if (path.includes('/condition')) code = kind === 'missing' ? 'roundtrip.condition_missing' : `roundtrip.condition_${kind}`;
  if (path.includes('/participants/') && path.endsWith('/process_ref')) code = 'roundtrip.process_ownership';
  return { layer: 'round-trip', severity: 'error', code, path: path || '/', element, message: `semantic mismatch at ${path || '/'}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}` };
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) result[key] = normalize(value[key]);
  }
  return result;
}

function sortById(items) {
  return [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function optional(value) {
  return value === undefined || value === null || value === '' ? undefined : value;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}
