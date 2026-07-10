import BpmnModdle from 'bpmn-moddle';
import { processScopes } from './model-utils.mjs';

const TYPE_MAP = new Map([
  ['startEvent', 'bpmn:StartEvent'],
  ['endEvent', 'bpmn:EndEvent'],
  ['intermediateCatchEvent', 'bpmn:IntermediateCatchEvent'],
  ['intermediateThrowEvent', 'bpmn:IntermediateThrowEvent'],
  ['boundaryEvent', 'bpmn:BoundaryEvent'],
  ['task', 'bpmn:Task'],
  ['userTask', 'bpmn:UserTask'],
  ['serviceTask', 'bpmn:ServiceTask'],
  ['manualTask', 'bpmn:ManualTask'],
  ['businessRuleTask', 'bpmn:BusinessRuleTask'],
  ['scriptTask', 'bpmn:ScriptTask'],
  ['sendTask', 'bpmn:SendTask'],
  ['receiveTask', 'bpmn:ReceiveTask'],
  ['callActivity', 'bpmn:CallActivity'],
  ['subProcess', 'bpmn:SubProcess'],
  ['transaction', 'bpmn:Transaction'],
  ['exclusiveGateway', 'bpmn:ExclusiveGateway'],
  ['parallelGateway', 'bpmn:ParallelGateway'],
  ['inclusiveGateway', 'bpmn:InclusiveGateway'],
  ['eventBasedGateway', 'bpmn:EventBasedGateway'],
  ['complexGateway', 'bpmn:ComplexGateway']
]);

const EVENT_DEFINITION_MAP = new Map([
  ['timer', 'bpmn:TimerEventDefinition'],
  ['message', 'bpmn:MessageEventDefinition'],
  ['error', 'bpmn:ErrorEventDefinition'],
  ['escalation', 'bpmn:EscalationEventDefinition'],
  ['signal', 'bpmn:SignalEventDefinition'],
  ['conditional', 'bpmn:ConditionalEventDefinition'],
  ['compensation', 'bpmn:CompensateEventDefinition'],
  ['link', 'bpmn:LinkEventDefinition']
]);

export async function generateBpmnXml(model) {
  const moddle = new BpmnModdle();
  const scopes = processScopes(model);
  const processById = new Map();
  const nodeById = new Map();
  const rootElements = [];

  for (const scope of scopes) {
    const process = moddle.create('bpmn:Process', {
      id: scope.process.id,
      name: scope.process.name,
      isExecutable: Boolean(scope.process.executable)
    });
    processById.set(scope.process.id, process);
    rootElements.push(process);

    const localNodes = new Map();
    const localFlows = new Map();
    for (const nodeModel of scope.nodes || []) {
      const node = createNode(moddle, nodeModel);
      localNodes.set(nodeModel.id, node);
      nodeById.set(nodeModel.id, node);
    }
    for (const nodeModel of scope.nodes || []) {
      if (!nodeModel.attachedTo) continue;
      const attached = localNodes.get(nodeModel.attachedTo);
      if (!attached) throw generationError('generation.unresolved_attachment', nodeModel.id, `attached activity '${nodeModel.attachedTo}' was not resolved`);
      localNodes.get(nodeModel.id).attachedToRef = attached;
    }
    for (const flowModel of scope.flows || []) {
      const source = localNodes.get(flowModel.from);
      const target = localNodes.get(flowModel.to);
      if (!source || !target) throw generationError('generation.unresolved_sequence_flow', flowModel.id, `sequence flow '${flowModel.id}' has unresolved endpoints`);
      const attrs = { id: flowModel.id, name: flowModel.label, sourceRef: source, targetRef: target };
      if (flowModel.condition?.body) {
        attrs.conditionExpression = moddle.create('bpmn:FormalExpression', {
          body: flowModel.condition.body,
          language: flowModel.condition.language
        });
      }
      const flow = moddle.create('bpmn:SequenceFlow', attrs);
      localFlows.set(flowModel.id, flow);
      source.outgoing = [...(source.outgoing || []), flow];
      target.incoming = [...(target.incoming || []), flow];
    }
    for (const nodeModel of scope.nodes || []) {
      if (!nodeModel.default) continue;
      const flow = localFlows.get(nodeModel.default);
      if (!flow || flow.sourceRef?.id !== nodeModel.id) throw generationError('generation.invalid_default', nodeModel.id, `default '${nodeModel.default}' is not outgoing from '${nodeModel.id}'`);
      localNodes.get(nodeModel.id).default = flow;
    }
    process.flowElements = [...localNodes.values(), ...localFlows.values()];
    const laneSet = buildLaneSet(moddle, scope, localNodes);
    if (laneSet) process.laneSets = [laneSet];
  }

  const participants = model.participants || [];
  if (participants.length || (model.message_flows || []).length) {
    const collaborationId = model.schema_version === 2 ? `${model.definitions.id}_collaboration` : `${scopes[0].process.id}_collaboration`;
    const collaboration = moddle.create('bpmn:Collaboration', { id: collaborationId });
    const participantById = new Map();
    collaboration.participants = participants.map((participantModel) => {
      const processId = model.schema_version === 2 ? participantModel.process_ref : scopes[0].process.id;
      const processRef = processById.get(processId);
      if (!processRef) throw generationError('generation.unresolved_process_ref', participantModel.id, `participant process '${processId}' was not resolved`);
      const participant = moddle.create('bpmn:Participant', { id: participantModel.id, name: participantModel.name, processRef });
      participantById.set(participantModel.id, participant);
      return participant;
    });
    collaboration.messageFlows = (model.message_flows || []).map((flowModel) => {
      const sourceRef = nodeById.get(flowModel.from) || participantById.get(flowModel.from);
      const targetRef = nodeById.get(flowModel.to) || participantById.get(flowModel.to);
      if (!sourceRef || !targetRef) throw generationError('generation.unresolved_message_flow', flowModel.id, `message flow '${flowModel.id}' has unresolved endpoints`);
      return moddle.create('bpmn:MessageFlow', { id: flowModel.id, name: flowModel.label, sourceRef, targetRef });
    });
    rootElements.push(collaboration);
  }

  const definitionsId = model.schema_version === 2 ? model.definitions.id : `${scopes[0].process.id}_definitions`;
  const definitions = moddle.create('bpmn:Definitions', {
    id: definitionsId,
    name: model.schema_version === 2 ? model.definitions.name : undefined,
    targetNamespace: model.schema_version === 2
      ? (model.definitions.target_namespace || 'http://corp.example/bpmn')
      : (scopes[0].process.targetNamespace || 'http://corp.example/bpmn'),
    rootElements
  });
  const { xml } = await moddle.toXML(definitions, { format: true });
  return xml;
}

function createNode(moddle, nodeModel) {
  const type = TYPE_MAP.get(nodeModel.type);
  if (!type) throw generationError('capability.unsupported', nodeModel.id, `node type '${nodeModel.type}' is not supported`);
  const node = moddle.create(type, { id: nodeModel.id, name: nodeModel.name });
  if (nodeModel.eventDefinition) {
    const definitionType = EVENT_DEFINITION_MAP.get(nodeModel.eventDefinition);
    if (!definitionType) throw generationError('capability.unsupported', nodeModel.id, `event definition '${nodeModel.eventDefinition}' is not supported`);
    node.eventDefinitions = [moddle.create(definitionType, { id: `${nodeModel.id}_${nodeModel.eventDefinition}` })];
  }
  if (nodeModel.documentation) node.documentation = [moddle.create('bpmn:Documentation', { text: nodeModel.documentation })];
  return node;
}

function buildLaneSet(moddle, scope, nodes) {
  if (!(scope.lanes || []).length) return null;
  return moddle.create('bpmn:LaneSet', {
    id: `${scope.process.id}_laneSet`,
    lanes: scope.lanes.map((laneModel) => moddle.create('bpmn:Lane', {
      id: laneModel.id,
      name: laneModel.name,
      flowNodeRef: (scope.nodes || []).filter((node) => node.lane === laneModel.id).map((node) => nodes.get(node.id))
    }))
  });
}

function generationError(code, element, message) {
  const error = new Error(message);
  error.code = code;
  error.element = element;
  error.exitCode = 2;
  return error;
}
