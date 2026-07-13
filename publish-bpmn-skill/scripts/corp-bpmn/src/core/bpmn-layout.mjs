import BpmnModdle from 'bpmn-moddle';
import { layoutProcess } from 'bpmn-auto-layout';
import { allNodes } from './model-utils.mjs';
import {
  finiteBounds,
  orthogonalRouteAcrossAnchors,
  routeObstacleScore,
  routeSignature,
  routesCross,
  staggerRoute,
  unionBounds
} from './spatial-geometry.mjs';
import { spatialFindings } from './bpmn-validator.mjs';

const ADVANCED_LAYOUT_WARNING_TYPES = new Set(['transaction']);
const POOL_X = 60;
const POOL_TOP = 60;
const POOL_GUTTER = 80;
const POOL_LABEL_BAND = 50;
const CONTENT_PADDING = 40;
const MIN_POOL_WIDTH = 760;
const MIN_POOL_HEIGHT = 180;
const MESSAGE_BAND_TOP = 8;
const MESSAGE_BAND_HEIGHT = 24;

export async function layoutBpmnXml(xml, model = null) {
  const findings = model ? capabilityWarnings(model) : [];
  try {
    const collaboration = model ? model.schema_version === 2 : await requiresCollaborationLayout(xml);
    const layoutedXml = collaboration ? await layoutCollaboration(xml) : await layoutProcess(xml);
    const moddle = new BpmnModdle();
    const parsed = await moddle.fromXML(layoutedXml);
    findings.push(...spatialFindings(parsed.rootElement));
    return { xml: layoutedXml, findings };
  } catch (error) {
    error.exitCode = 3;
    throw error;
  }
}

export function capabilityWarnings(model = {}) {
  const findings = [];
  for (const node of allNodes(model)) {
    if (ADVANCED_LAYOUT_WARNING_TYPES.has(node.type)) {
      findings.push({ layer: 'layout', severity: 'warning', code: 'layout.advanced_manual_review', element: node.id, message: `${node.type} requires manual layout review` });
    }
  }
  return findings;
}

async function requiresCollaborationLayout(xml) {
  const moddle = new BpmnModdle();
  const { rootElement } = await moddle.fromXML(xml);
  const collaboration = (rootElement.rootElements || []).find((element) => element.$type === 'bpmn:Collaboration');
  if (!collaboration) return false;
  const processCount = (rootElement.rootElements || []).filter((element) => element.$type === 'bpmn:Process').length;
  return processCount > 1 || (collaboration.messageFlows || []).length > 0;
}

async function layoutCollaboration(xml) {
  const moddle = new BpmnModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const collaboration = (definitions.rootElements || []).find((element) => element.$type === 'bpmn:Collaboration');
  if (!collaboration) throw new Error('schema v2 requires a BPMN collaboration for layout');
  const processes = new Map((definitions.rootElements || []).filter((element) => element.$type === 'bpmn:Process').map((process) => [process.id, process]));
  const planeElements = [];
  const boundsByElement = new Map();
  const participantByProcess = new Map();
  const processByNode = new Map();
  const deferredSequence = [];
  const processNodeBounds = new Map();
  let poolY = POOL_TOP;

  for (const participant of collaboration.participants || []) {
    const process = processes.get(participant.processRef?.id);
    if (!process) continue;
    participantByProcess.set(process.id, participant.id);
    for (const element of process.flowElements || []) if (element.$type !== 'bpmn:SequenceFlow') processByNode.set(element.id, process.id);
    const local = await layoutSingleProcess(moddle, definitions, process);
    const poolBounds = {
      x: POOL_X,
      y: poolY,
      width: Math.max(MIN_POOL_WIDTH, POOL_LABEL_BAND + local.content.width + CONTENT_PADDING * 2),
      height: Math.max(MIN_POOL_HEIGHT, local.content.height + CONTENT_PADDING * 2)
    };
    boundsByElement.set(participant.id, poolBounds);
    planeElements.push(shape(moddle, participant, poolBounds, { isHorizontal: true }));
    const dx = poolBounds.x + POOL_LABEL_BAND + CONTENT_PADDING - local.content.x;
    const dy = poolBounds.y + CONTENT_PADDING - local.content.y;
    for (const item of [...local.shapes].sort((first, second) => {
      const laneOrder = Number(second.element.$type === 'bpmn:Lane') - Number(first.element.$type === 'bpmn:Lane');
      return laneOrder || byId(first.element, second.element);
    })) {
      const bounds = translateBounds(item.bounds, dx, dy);
      boundsByElement.set(item.element.id, bounds);
      planeElements.push(shape(moddle, item.element, bounds, item.extra));
    }
    const flowNodeBounds = local.shapes.filter((item) => item.element.$type !== 'bpmn:Lane').map((item) => ({ id: item.element.id, bounds: boundsByElement.get(item.element.id) }));
    processNodeBounds.set(process.id, flowNodeBounds);
    for (const item of local.edges.sort((first, second) => byId(first.element, second.element))) {
      const preferred = item.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      deferredSequence.push({ processId: process.id, element: item.element, preferred });
    }
    poolY += poolBounds.height + POOL_GUTTER;
  }

  const participantBounds = new Map((collaboration.participants || []).map((participant) => [participant.id, boundsByElement.get(participant.id)]));
  const allNodeBounds = [...processByNode].map(([id]) => ({ id, bounds: boundsByElement.get(id) })).filter((item) => item.bounds);
  const routeSpecs = [];
  for (const flow of [...(collaboration.messageFlows || [])].sort(byId)) {
    const source = boundsByElement.get(flow.sourceRef?.id);
    const target = boundsByElement.get(flow.targetRef?.id);
    if (!source || !target) throw new Error(`cannot layout edge '${flow.id}' with missing endpoint bounds`);
    const sourceParticipant = endpointParticipant(flow.sourceRef, processByNode, participantByProcess);
    const targetParticipant = endpointParticipant(flow.targetRef, processByNode, participantByProcess);
    routeSpecs.push({
      kind: 'message',
      element: flow,
      source,
      target,
      obstacles: allNodeBounds.filter((item) => ![flow.sourceRef?.id, flow.targetRef?.id].includes(item.id)).map((item) => item.bounds),
      foreignBounds: [...participantBounds].filter(([id, bounds]) => bounds && ![sourceParticipant, targetParticipant].includes(id)).map(([, bounds]) => bounds),
      margin: 45,
      staggerStep: 16
    });
  }

  for (const item of deferredSequence.sort((first, second) => first.processId.localeCompare(second.processId) || byId(first.element, second.element))) {
    const source = boundsByElement.get(item.element.sourceRef?.id);
    const target = boundsByElement.get(item.element.targetRef?.id);
    routeSpecs.push({
      kind: 'sequence',
      processId: item.processId,
      element: item.element,
      source,
      target,
      obstacles: [
        ...(processNodeBounds.get(item.processId) || []).filter((node) => ![item.element.sourceRef?.id, item.element.targetRef?.id].includes(node.id)).map((node) => node.bounds),
        reservedMessageBand(participantBounds.get(participantByProcess.get(item.processId)))
      ].filter(Boolean),
      foreignBounds: [],
      margin: 35,
      staggerStep: 12
    });
  }

  const routedEdges = [];
  for (const spec of routeSpecs) {
    spec.points = routeSpec(spec, routedEdges);
    routedEdges.push(spec.points);
  }
  refineCrossingRoutes(routeSpecs);
  staggerDuplicateRoutes(routeSpecs);
  refineCrossingRoutes(routeSpecs);
  for (const spec of routeSpecs) planeElements.push(edge(moddle, spec.element, spec.points));

  const plane = moddle.create('bpmndi:BPMNPlane', { id: `${collaboration.id}_plane`, bpmnElement: collaboration, planeElement: planeElements });
  definitions.diagrams = [moddle.create('bpmndi:BPMNDiagram', { id: `${collaboration.id}_diagram`, plane })];
  return (await moddle.toXML(definitions, { format: true })).xml;
}

async function layoutSingleProcess(moddle, definitions, process) {
  const view = moddle.create('bpmn:Definitions', {
    id: `${process.id}_layout_view`,
    targetNamespace: definitions.targetNamespace || 'http://corp.example/bpmn',
    rootElements: [process]
  });
  const serialized = (await moddle.toXML(view, { format: true })).xml;
  const layouted = await layoutProcess(serialized);
  const parsed = await moddle.fromXML(layouted);
  const localDefinitions = parsed.rootElement;
  const localPlane = localDefinitions.diagrams?.[0]?.plane;
  if (!localPlane) throw new Error(`bpmn-auto-layout did not produce DI for process '${process.id}'`);
  const originalById = semanticElements(process);
  const shapes = [];
  const edges = [];
  const geometry = [];
  for (const element of localPlane.planeElement || []) {
    const id = element.bpmnElement?.id;
    const original = originalById.get(id);
    if (element.$type === 'bpmndi:BPMNShape' && original && original !== process) {
      const bounds = finiteBounds(element.bounds);
      if (!bounds) continue;
      shapes.push({ element: original, bounds, extra: { isHorizontal: element.isHorizontal, isExpanded: element.isExpanded } });
      geometry.push(bounds);
    }
    if (element.$type === 'bpmndi:BPMNEdge') {
      const original = originalById.get(id);
      const points = (element.waypoint || []).map((point) => ({ x: Number(point.x), y: Number(point.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (original?.$type === 'bpmn:SequenceFlow' && points.length >= 2) edges.push({ element: original, points });
      for (const point of points) geometry.push({ x: point.x, y: point.y, width: 0.001, height: 0.001 });
    }
  }
  const nodeShapes = new Map(shapes.filter((item) => item.element.$type !== 'bpmn:Lane').map((item) => [item.element.id, item]));
  const existingLaneIds = new Set(shapes.filter((item) => item.element.$type === 'bpmn:Lane').map((item) => item.element.id));
  const nodeUnion = unionBounds([...nodeShapes.values()].map((item) => item.bounds));
  let emptyLaneY = nodeUnion?.y || 0;
  for (const lane of [...originalById.values()].filter((element) => element.$type === 'bpmn:Lane').sort(byId)) {
    if (existingLaneIds.has(lane.id)) continue;
    const assigned = (lane.flowNodeRef || []).map((node) => nodeShapes.get(node.id)?.bounds).filter(Boolean);
    const owned = unionBounds(assigned);
    const bounds = owned
      ? { x: (nodeUnion?.x || owned.x) - 20, y: owned.y - 20, width: (nodeUnion?.width || owned.width) + 40, height: owned.height + 40 }
      : { x: (nodeUnion?.x || 0) - 20, y: emptyLaneY, width: (nodeUnion?.width || 200) + 40, height: 80 };
    emptyLaneY += owned ? 0 : 90;
    shapes.push({ element: lane, bounds, extra: { isHorizontal: true } });
    geometry.push(bounds);
  }
  const content = unionBounds(geometry);
  if (!content || !shapes.length) throw new Error(`bpmn-auto-layout produced no usable shapes for process '${process.id}'`);
  return { shapes, edges, content };
}

function semanticElements(process) {
  const result = new Map([[process.id, process]]);
  for (const element of process.flowElements || []) result.set(element.id, element);
  for (const laneSet of process.laneSets || []) collectLanes(laneSet.lanes || [], result);
  return result;
}

function collectLanes(lanes, result) {
  for (const lane of lanes) {
    result.set(lane.id, lane);
    collectLanes(lane.childLaneSet?.lanes || [], result);
  }
}

function endpointParticipant(endpoint, processByNode, participantByProcess) {
  if (endpoint?.$type === 'bpmn:Participant') return endpoint.id;
  return participantByProcess.get(processByNode.get(endpoint?.id));
}

function routeSpec(spec, existingRoutes) {
  return orthogonalRouteAcrossAnchors(spec.source, spec.target, {
    obstacles: spec.obstacles,
    foreignBounds: spec.foreignBounds,
    existingRoutes,
    margin: spec.margin
  }).points;
}

function reservedMessageBand(poolBounds) {
  if (!poolBounds) return null;
  return {
    x: poolBounds.x,
    y: poolBounds.y + MESSAGE_BAND_TOP,
    width: poolBounds.width,
    height: MESSAGE_BAND_HEIGHT
  };
}

function refineCrossingRoutes(routeSpecs, maxPasses = 4) {
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (const spec of routeSpecs) {
      const otherRoutes = routeSpecs.filter((item) => item !== spec).map((item) => item.points);
      if (!otherRoutes.some((points) => routesCross(spec.points, points))) continue;
      const candidate = routeSpec(spec, otherRoutes);
      const scoringObstacles = [...spec.obstacles, spec.source, spec.target];
      const currentScore = routeObstacleScore(spec.points, scoringObstacles, spec.foreignBounds, otherRoutes);
      const candidateScore = routeObstacleScore(candidate, scoringObstacles, spec.foreignBounds, otherRoutes);
      if (candidateScore < currentScore || (candidateScore === currentScore && routeSignature(candidate, false) < routeSignature(spec.points, false))) {
        spec.points = candidate;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function staggerDuplicateRoutes(routeSpecs) {
  const counts = new Map();
  for (const spec of routeSpecs) {
    const signature = routeSignature(spec.points);
    const scope = spec.kind === 'message' ? 'message' : `sequence:${spec.processId}`;
    const key = `${scope}:${signature}`;
    const index = counts.get(key) || 0;
    counts.set(key, index + 1);
    if (index) {
      const otherRoutes = routeSpecs.filter((item) => item !== spec).map((item) => item.points);
      const candidate = staggerRoute(spec.points, index, spec.staggerStep);
      const scoringObstacles = [...spec.obstacles, spec.source, spec.target];
      const currentScore = routeObstacleScore(spec.points, scoringObstacles, spec.foreignBounds, otherRoutes);
      const candidateScore = routeObstacleScore(candidate, scoringObstacles, spec.foreignBounds, otherRoutes);
      if (candidateScore < currentScore) spec.points = candidate;
      else {
        const rerouted = routeSpec(spec, otherRoutes);
        const reroutedScore = routeObstacleScore(rerouted, scoringObstacles, spec.foreignBounds, otherRoutes);
        if (reroutedScore < currentScore) spec.points = rerouted;
      }
    }
  }
}

function translateBounds(bounds, dx, dy) {
  return { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height };
}

function shape(moddle, element, bounds, extra = {}) {
  return moddle.create('bpmndi:BPMNShape', {
    id: `${element.id}_di`,
    bpmnElement: element,
    bounds: moddle.create('dc:Bounds', bounds),
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined))
  });
}

function edge(moddle, element, points) {
  return moddle.create('bpmndi:BPMNEdge', {
    id: `${element.id}_di`,
    bpmnElement: element,
    waypoint: points.map((point) => moddle.create('dc:Point', point))
  });
}

function byId(first, second) {
  return String(first.id).localeCompare(String(second.id));
}
