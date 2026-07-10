import BpmnModdle from 'bpmn-moddle';
import { layoutProcess } from 'bpmn-auto-layout';
import { allNodes } from './model-utils.mjs';

const ADVANCED_LAYOUT_WARNING_TYPES = new Set(['transaction']);

export async function layoutBpmnXml(xml, model = null) {
  const findings = model ? capabilityWarnings(model) : [];
  try {
    if (model?.schema_version === 2) return { xml: await layoutCollaboration(xml), findings };
    return { xml: await layoutProcess(xml), findings };
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

async function layoutCollaboration(xml) {
  const moddle = new BpmnModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const collaboration = (definitions.rootElements || []).find((element) => element.$type === 'bpmn:Collaboration');
  if (!collaboration) throw new Error('schema v2 requires a BPMN collaboration for layout');
  const planeElements = [];
  const boundsByElement = new Map();
  const processes = new Map((definitions.rootElements || []).filter((element) => element.$type === 'bpmn:Process').map((process) => [process.id, process]));

  for (let poolIndex = 0; poolIndex < (collaboration.participants || []).length; poolIndex += 1) {
    const participant = collaboration.participants[poolIndex];
    const process = processes.get(participant.processRef?.id);
    if (!process) continue;
    const nodes = (process.flowElements || []).filter((element) => element.$type !== 'bpmn:SequenceFlow');
    const poolBounds = { x: 60, y: 60 + poolIndex * 240, width: Math.max(760, 180 + nodes.length * 150), height: 180 };
    boundsByElement.set(participant.id, poolBounds);
    planeElements.push(shape(moddle, participant, poolBounds, { isHorizontal: true }));
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const size = nodeSize(node.$type);
      let nodeBounds = { x: 130 + index * 150, y: poolBounds.y + Math.round((poolBounds.height - size.height) / 2), ...size };
      if (node.$type === 'bpmn:BoundaryEvent' && node.attachedToRef && boundsByElement.has(node.attachedToRef.id)) {
        const host = boundsByElement.get(node.attachedToRef.id);
        nodeBounds = { x: host.x + host.width - 18, y: host.y + host.height - 18, width: 36, height: 36 };
      }
      boundsByElement.set(node.id, nodeBounds);
      planeElements.push(shape(moddle, node, nodeBounds));
    }
  }

  for (const process of processes.values()) {
    for (const flow of (process.flowElements || []).filter((element) => element.$type === 'bpmn:SequenceFlow')) {
      planeElements.push(edge(moddle, flow, boundsByElement.get(flow.sourceRef?.id), boundsByElement.get(flow.targetRef?.id)));
    }
  }
  for (const flow of collaboration.messageFlows || []) {
    planeElements.push(edge(moddle, flow, boundsByElement.get(flow.sourceRef?.id), boundsByElement.get(flow.targetRef?.id), true));
  }

  const plane = moddle.create('bpmndi:BPMNPlane', { id: `${collaboration.id}_plane`, bpmnElement: collaboration, planeElement: planeElements });
  definitions.diagrams = [moddle.create('bpmndi:BPMNDiagram', { id: `${collaboration.id}_diagram`, plane })];
  const { xml: layouted } = await moddle.toXML(definitions, { format: true });
  return layouted;
}

function shape(moddle, element, bounds, extra = {}) {
  return moddle.create('bpmndi:BPMNShape', {
    id: `${element.id}_di`,
    bpmnElement: element,
    bounds: moddle.create('dc:Bounds', bounds),
    ...extra
  });
}

function edge(moddle, element, source, target, message = false) {
  if (!source || !target) throw new Error(`cannot layout edge '${element.id}' with missing endpoint bounds`);
  const sourcePoint = message ? center(source) : { x: source.x + source.width, y: source.y + source.height / 2 };
  const targetPoint = message ? center(target) : { x: target.x, y: target.y + target.height / 2 };
  const middleX = Math.round((sourcePoint.x + targetPoint.x) / 2);
  const waypoints = sourcePoint.y === targetPoint.y
    ? [sourcePoint, targetPoint]
    : [sourcePoint, { x: middleX, y: sourcePoint.y }, { x: middleX, y: targetPoint.y }, targetPoint];
  return moddle.create('bpmndi:BPMNEdge', {
    id: `${element.id}_di`,
    bpmnElement: element,
    waypoint: waypoints.map((point) => moddle.create('dc:Point', point))
  });
}

function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function nodeSize(type) {
  if (type.endsWith('Event')) return { width: 36, height: 36 };
  if (type.endsWith('Gateway')) return { width: 50, height: 50 };
  return { width: 100, height: 80 };
}
