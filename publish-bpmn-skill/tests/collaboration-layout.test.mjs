import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import BpmnModdle from '../scripts/corp-bpmn/node_modules/bpmn-moddle/dist/index.js';
import { layoutProcess } from '../scripts/corp-bpmn/node_modules/bpmn-auto-layout/dist/index.js';
import { readAndValidateYaml, readProcessYaml } from '../scripts/corp-bpmn/src/core/yaml-reader.mjs';
import { validateProcessModel } from '../scripts/corp-bpmn/src/core/yaml-validator.mjs';
import { lintProcessModel } from '../scripts/corp-bpmn/src/core/semantic-linter.mjs';
import { generateBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-generator.mjs';
import { layoutBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-layout.mjs';
import { validateBpmnFile, validateBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-validator.mjs';
import { validateSemanticRoundTrip } from '../scripts/corp-bpmn/src/core/semantic-roundtrip.mjs';
import { buildReport } from '../scripts/corp-bpmn/src/core/validation-report.mjs';
import { buildCommand } from '../scripts/corp-bpmn/src/commands/build.mjs';
import { layoutCommand } from '../scripts/corp-bpmn/src/commands/layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const valid = (name) => path.join(root, 'fixtures/valid', name);
const denseFixture = valid('dense-collaboration-layout.yaml');
const EPSILON = 1.1;

test('dense v2 fixture covers collaboration layout stress families compactly', async () => {
  const model = await readProcessYaml(denseFixture);
  assert.equal(model.schema_version, 2);
  assert.equal(model.processes.length, 2);
  assert.equal(model.processes.flatMap((process) => process.lanes || []).length, 3);
  const nodes = model.processes.flatMap((process) => process.nodes);
  assert.ok(nodes.some((node) => node.type === 'parallelGateway'));
  assert.ok(nodes.some((node) => node.type === 'exclusiveGateway'));
  assert.ok(nodes.some((node) => node.type === 'boundaryEvent' && node.attachedTo && node.eventDefinition));
  assert.ok(model.processes.flatMap((process) => process.flows).some((flow) => flow.condition));
  const routePairs = model.message_flows.map((flow) => `${flow.from}->${flow.to}`);
  assert.ok(routePairs.filter((pair) => pair === 'client-send->service-receive').length === 2, 'fixture needs repeated message endpoints');
  assert.ok(routePairs.includes('service-send->client-receive'), 'fixture needs a reverse response');
  assert.ok(routePairs.includes('exception-send->client-receive'), 'fixture needs an exception message');
  assert.equal((await validateProcessModel(model)).filter((finding) => finding.severity === 'error').length, 0);
});

test('concrete, participant, ambiguous, and ineligible message endpoints retain stable semantics', async () => {
  const dense = await readProcessYaml(denseFixture);
  assert.equal((await validateProcessModel(dense)).filter((finding) => finding.severity === 'error').length, 0);

  const concreteXml = await generateBpmnXml(dense);
  const concreteParsed = await new BpmnModdle().fromXML(concreteXml);
  assert.equal(validateSemanticRoundTrip(dense, concreteParsed.rootElement).length, 0);

  const blackBox = await readProcessYaml(valid('v2-participant-message-flow.yaml'));
  const blackBoxFindings = await validateProcessModel(blackBox);
  assert.ok(!blackBoxFindings.some((finding) => finding.code === 'semantic.message_endpoint.participant_ambiguous'));
  const blackBoxXml = await generateBpmnXml(blackBox);
  const blackBoxParsed = await new BpmnModdle().fromXML(blackBoxXml);
  assert.equal(validateSemanticRoundTrip(blackBox, blackBoxParsed.rootElement).length, 0);

  const ambiguous = structuredClone(dense);
  ambiguous.message_flows.find((flow) => flow.id === 'request-primary').from = 'client';
  const ambiguousFindings = [...await validateProcessModel(ambiguous), ...lintProcessModel(ambiguous)];
  const ambiguity = ambiguousFindings.find((finding) => finding.code === 'semantic.message_endpoint.participant_ambiguous');
  assert.deepEqual(
    ambiguity && { layer: ambiguity.layer, severity: ambiguity.severity, path: ambiguity.path, element: ambiguity.element },
    { layer: 'semantics', severity: 'warning', path: '/message_flows/request-primary/from', element: 'client' }
  );
  assert.equal(buildReport({ findings: ambiguousFindings, strict: false }).summary.status, 'passed');
  assert.equal(buildReport({ findings: ambiguousFindings, strict: true }).summary.status, 'failed');

  const ineligible = structuredClone(dense);
  ineligible.message_flows.find((flow) => flow.id === 'request-primary').from = 'branch-a';
  const ineligibleFindings = await validateProcessModel(ineligible);
  assert.ok(ineligibleFindings.some((finding) =>
    finding.code === 'references.unresolved_message_endpoint'
      && finding.path === '/message_flows/request-primary/from'
      && finding.element === 'request-primary'
  ));
});

test('dense collaboration layout is deterministic, multi-level, contained, anchored, and obstacle-free', async () => {
  const { model } = await readAndValidateYaml(denseFixture);
  const source = await generateBpmnXml(model);
  const first = await layoutBpmnXml(source, model);
  const second = await layoutBpmnXml(source, model);
  assert.equal(first.xml, second.xml);

  const parsed = await parse(first.xml);
  const { definitions, shapes, edges } = parsed;
  const collaboration = definitions.rootElements.find((element) => element.$type === 'bpmn:Collaboration');
  const processes = definitions.rootElements.filter((element) => element.$type === 'bpmn:Process');
  assert.equal(processes.flatMap((process) => process.laneSets || []).flatMap((laneSet) => laneSet.lanes || []).length, 3, 'layout must not invent lanes');

  const service = processes.find((process) => process.id === 'service-process');
  const branchA = shapes.get('branch-a');
  const branchB = shapes.get('branch-b');
  const join = shapes.get('parallel-join');
  assert.notEqual(center(branchA).y, center(branchB).y, 'parallel branches need distinct visual levels');
  assert.ok(join.x > Math.max(branchA.x, branchB.x), 'join must follow both branches');

  const participantByProcess = new Map(collaboration.participants.map((participant) => [participant.processRef.id, participant]));
  for (const process of processes) {
    const pool = shapes.get(participantByProcess.get(process.id).id);
    for (const node of process.flowElements.filter((element) => element.$type !== 'bpmn:SequenceFlow')) {
      assert.ok(contains(pool, shapes.get(node.id)), `${node.id} must stay inside ${participantByProcess.get(process.id).id}`);
    }
    for (const laneSet of process.laneSets || []) {
      for (const lane of laneSet.lanes || []) {
        const laneBounds = shapes.get(lane.id);
        for (const node of lane.flowNodeRef || []) assert.ok(contains(laneBounds, shapes.get(node.id)), `${node.id} must stay inside ${lane.id}`);
      }
    }
  }

  const host = shapes.get('branch-b');
  const boundary = shapes.get('branch-timeout');
  assert.ok(intersects(host, boundary), 'boundary event must remain attached to its host');
  assert.ok(contains(shapes.get('service'), boundary), 'boundary event must remain inside its pool');

  const flowNodes = new Map();
  for (const process of processes) {
    for (const node of process.flowElements.filter((element) => element.$type !== 'bpmn:SequenceFlow')) flowNodes.set(node.id, node);
  }
  for (const [id, edge] of edges) {
    const semantic = edge.bpmnElement;
    const sourceBounds = shapes.get(semantic.sourceRef?.id);
    const targetBounds = shapes.get(semantic.targetRef?.id);
    assert.ok(pointOnBoundary(edge.waypoint[0], sourceBounds), `${id} source must be boundary-anchored`);
    assert.ok(pointOnBoundary(edge.waypoint.at(-1), targetBounds), `${id} target must be boundary-anchored`);
    for (const [obstacleId] of flowNodes) {
      if (obstacleId === semantic.sourceRef?.id || obstacleId === semantic.targetRef?.id) continue;
      assert.ok(!routeIntersectsInterior(edge.waypoint, shapes.get(obstacleId)), `${id} must avoid ${obstacleId}`);
    }
  }

  const primary = edges.get('request-primary').waypoint;
  const repeated = edges.get('request-repeat').waypoint;
  assert.equal(edges.get('request-primary').bpmnElement.sourceRef.id, edges.get('request-repeat').bpmnElement.sourceRef.id);
  assert.equal(edges.get('request-primary').bpmnElement.targetRef.id, edges.get('request-repeat').bpmnElement.targetRef.id);
  assert.notDeepEqual(primary.map(point), repeated.map(point), 'equal endpoints require staggered intermediate corridors');
  assert.deepEqual(
    first.findings.filter((finding) => finding.layer === 'layout'),
    [],
    'the final post-stagger spatial gate must accept the emitted layout'
  );

  const reverse = edges.get('response-message');
  const reverseSource = shapes.get(reverse.bpmnElement.sourceRef.id);
  const reverseTarget = shapes.get(reverse.bpmnElement.targetRef.id);
  assert.ok(center(reverseTarget).x < center(reverseSource).x, 'fixture must exercise reverse horizontal routing');
  assert.ok(near(reverse.waypoint[0].x, reverseSource.x), 'reverse route leaves the source left boundary');
  assert.ok(near(reverse.waypoint.at(-1).x, reverseTarget.x + reverseTarget.width), 'reverse route enters the target right boundary');

  const report = await validateBpmnXml({ xml: first.xml, model, strict: true });
  assert.equal(report.summary.status, 'passed', JSON.stringify(report.findings, null, 2));
  assert.equal(report.findings.filter((finding) => finding.code.startsWith('layout.') && finding.severity === 'error').length, 0);
});

test('artifact-only v1 single-participant collaboration retains bpmn-auto-layout and layout command behavior', async () => {
  const { model } = await readAndValidateYaml(valid('simple-approval.yaml'));
  const source = await generateBpmnXml(model);
  const parsedSource = await new BpmnModdle().fromXML(source);
  const collaboration = parsedSource.rootElement.rootElements.find((element) => element.$type === 'bpmn:Collaboration');
  assert.equal(collaboration?.participants?.length, 1, 'fixture must exercise the legacy single-participant collaboration');

  const expected = await layoutProcess(source);
  const artifactOnly = await layoutBpmnXml(source);
  assert.equal(artifactOnly.xml, expected, 'artifact-only v1 must remain on the bpmn-auto-layout path');

  const tmp = await mkdtemp(path.join(tmpdir(), 'corp-bpmn-v1-layout-'));
  try {
    const input = path.join(tmp, 'source.bpmn');
    const output = path.join(tmp, 'layouted.bpmn');
    await writeFile(input, source, 'utf8');
    await layoutCommand(input, { out: output });
    assert.equal(await readFile(output, 'utf8'), expected);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('an authored lane shape outside its participant is an outside-pool error', async () => {
  const { model } = await readAndValidateYaml(denseFixture);
  const source = await generateBpmnXml(model);
  const { xml } = await layoutBpmnXml(source, model);
  const mutated = await mutateXml(xml, ({ shapes }) => {
    const pool = shapes.get('service');
    const lane = shapes.get('intake-lane');
    lane.x = pool.x - lane.width - 20;
  });
  const report = await validateBpmnXml({ xml: mutated, strict: false });
  const finding = report.findings.find((item) => item.code === 'layout.shape.outside_pool' && item.element === 'intake-lane');
  assert.ok(finding, JSON.stringify(report.findings, null, 2));
  assert.equal(finding.layer, 'layout');
  assert.equal(finding.severity, 'error');
});

test('relatedElement preserves one edge findings for multiple obstacles and crossings', async () => {
  const { model } = await readAndValidateYaml(denseFixture);
  const source = await generateBpmnXml(model);
  const { xml } = await layoutBpmnXml(source, model);

  const obstacleXml = await mutateXml(xml, ({ moddle, shapes, edges }) => {
    const edge = edges.get('request-primary');
    edge.waypoint = [
      edge.waypoint[0],
      moddle.create('dc:Point', center(shapes.get('branch-a'))),
      moddle.create('dc:Point', center(shapes.get('branch-b'))),
      edge.waypoint.at(-1)
    ];
  });
  const obstacleReport = await validateBpmnXml({ xml: obstacleXml, strict: false });
  const obstacleFindings = obstacleReport.findings.filter((finding) =>
    finding.code === 'layout.route.through_shape' && finding.element === 'request-primary'
  );
  const obstacleIds = new Set(obstacleFindings.map((finding) => finding.relatedElement));
  assert.ok(obstacleIds.has('branch-a'), JSON.stringify(obstacleFindings, null, 2));
  assert.ok(obstacleIds.has('branch-b'), JSON.stringify(obstacleFindings, null, 2));
  assert.ok(obstacleIds.size >= 2, 'one edge must retain distinct findings for multiple obstacles');

  const crossingXml = await mutateXml(xml, ({ moddle, shapes, edges }) => {
    const clientPool = shapes.get('client');
    const servicePool = shapes.get('service');
    const x = Number(clientPool.x) + Number(clientPool.width) / 2;
    const y = (Number(clientPool.y) + Number(clientPool.height) + Number(servicePool.y)) / 2;
    const horizontal = edges.get('exception-message');
    const leftVertical = edges.get('request-primary');
    const rightVertical = edges.get('request-repeat');
    horizontal.waypoint = [
      horizontal.waypoint[0],
      moddle.create('dc:Point', { x: x - 120, y }),
      moddle.create('dc:Point', { x: x + 120, y }),
      horizontal.waypoint.at(-1)
    ];
    leftVertical.waypoint = [
      leftVertical.waypoint[0],
      moddle.create('dc:Point', { x: x - 60, y: y - 80 }),
      moddle.create('dc:Point', { x: x - 60, y: y + 80 }),
      leftVertical.waypoint.at(-1)
    ];
    rightVertical.waypoint = [
      rightVertical.waypoint[0],
      moddle.create('dc:Point', { x: x + 60, y: y - 80 }),
      moddle.create('dc:Point', { x: x + 60, y: y + 80 }),
      rightVertical.waypoint.at(-1)
    ];
  });
  const crossingReport = await validateBpmnXml({ xml: crossingXml, strict: false });
  const crossingFindings = crossingReport.findings.filter((finding) =>
    finding.code === 'layout.route.crossing' && finding.element === 'exception-message'
  );
  const crossingIds = new Set(crossingFindings.map((finding) => finding.relatedElement));
  assert.ok(crossingIds.has('request-primary'), JSON.stringify(crossingFindings, null, 2));
  assert.ok(crossingIds.has('request-repeat'), JSON.stringify(crossingFindings, null, 2));
  assert.ok(crossingIds.size >= 2, 'one edge must retain distinct findings for multiple crossings');
});

test('artifact-only and source-aware validation preserve mutated DI spatial finding identity', async () => {
  const { model } = await readAndValidateYaml(denseFixture);
  const source = await generateBpmnXml(model);
  const { xml } = await layoutBpmnXml(source, model);
  const cases = [
    {
      code: 'layout.endpoint.detached', element: 'request-primary',
      mutate: ({ shapes, edges }) => {
        const edge = edges.get('request-primary');
        const bounds = shapes.get(edge.bpmnElement.sourceRef.id);
        edge.waypoint[0].x = bounds.x + bounds.width / 2;
        edge.waypoint[0].y = bounds.y + bounds.height / 2;
      }
    },
    {
      code: 'layout.route.through_shape', element: 'request-primary',
      mutate: ({ moddle, shapes, edges }) => {
        const edge = edges.get('request-primary');
        const obstacle = center(shapes.get('branch-a'));
        edge.waypoint = [edge.waypoint[0], moddle.create('dc:Point', obstacle), edge.waypoint.at(-1)];
      }
    },
    {
      code: 'layout.shape.outside_pool', element: 'branch-a',
      mutate: ({ shapes }) => {
        const pool = shapes.get('service');
        const shape = shapes.get('branch-a');
        shape.x = pool.x - shape.width - 20;
      }
    },
    {
      code: 'layout.shape.outside_lane', element: 'service-receive',
      mutate: ({ shapes }) => {
        const ownLane = shapes.get('intake-lane');
        const pool = shapes.get('service');
        const shape = shapes.get('service-receive');
        shape.x = Math.max(pool.x + 20, ownLane.x + 20);
        shape.y = ownLane.y + ownLane.height + 20;
      }
    },
    {
      code: 'layout.edge.invalid_waypoints', element: 'request-primary',
      mutate: ({ edges }) => { edges.get('request-primary').waypoint = [edges.get('request-primary').waypoint[0]]; }
    }
  ];

  for (const fixtureCase of cases) {
    const mutated = await mutateXml(xml, fixtureCase.mutate);
    const artifactOnly = await validateBpmnXml({ xml: mutated, strict: false });
    const sourceAware = await validateBpmnXml({ xml: mutated, model, strict: false });
    const identities = [];
    for (const report of [artifactOnly, sourceAware]) {
      const finding = report.findings.find((item) => item.code === fixtureCase.code && item.element === fixtureCase.element);
      assert.ok(finding, `${fixtureCase.code}: ${JSON.stringify(report.findings, null, 2)}`);
      assert.equal(finding.layer, 'layout');
      identities.push({ layer: finding.layer, code: finding.code, element: finding.element });
    }
    assert.deepEqual(identities[0], identities[1], fixtureCase.code);
  }
});

test('spatial readability mutations emit stable warning codes and strict mode blocks them', async () => {
  const { model } = await readAndValidateYaml(denseFixture);
  const source = await generateBpmnXml(model);
  const { xml } = await layoutBpmnXml(source, model);
  const cases = [
    {
      code: 'layout.shape.overlap', normalPass: true,
      mutate: ({ shapes }) => copyBounds(shapes.get('branch-b'), shapes.get('branch-a'))
    },
    {
      code: 'layout.route.duplicate', normalPass: true,
      mutate: ({ moddle, edges }) => {
        edges.get('request-repeat').waypoint = edges.get('request-primary').waypoint.map((item) => moddle.create('dc:Point', point(item)));
      }
    },
    {
      code: 'layout.route.crossing', normalPass: true,
      mutate: ({ moddle, edges }) => {
        const first = edges.get('request-primary');
        const second = edges.get('response-message');
        const endpoints = [first.waypoint[0], first.waypoint.at(-1), second.waypoint[0], second.waypoint.at(-1)].map(point);
        const crossing = {
          x: endpoints.reduce((sum, item) => sum + item.x, 0) / endpoints.length,
          y: endpoints.reduce((sum, item) => sum + item.y, 0) / endpoints.length
        };
        first.waypoint = [
          first.waypoint[0],
          moddle.create('dc:Point', { x: crossing.x - 60, y: crossing.y }),
          moddle.create('dc:Point', { x: crossing.x + 60, y: crossing.y }),
          first.waypoint.at(-1)
        ];
        second.waypoint = [
          second.waypoint[0],
          moddle.create('dc:Point', { x: crossing.x, y: crossing.y - 60 }),
          moddle.create('dc:Point', { x: crossing.x, y: crossing.y + 60 }),
          second.waypoint.at(-1)
        ];
      }
    },
    {
      code: 'layout.pool.overlap',
      mutate: ({ shapes }) => copyBounds(shapes.get('service'), shapes.get('client'))
    }
  ];
  for (const fixtureCase of cases) {
    const mutated = await mutateXml(xml, fixtureCase.mutate);
    const normal = await validateBpmnXml({ xml: mutated, model, strict: false });
    const finding = normal.findings.find((item) => item.code === fixtureCase.code);
    assert.ok(finding, fixtureCase.code);
    if (fixtureCase.normalPass) {
      assert.equal(finding.severity, 'warning', fixtureCase.code);
      assert.equal(buildReport({ findings: [finding], strict: false }).summary.status, 'passed', fixtureCase.code);
      assert.equal(buildReport({ findings: [finding], strict: true }).summary.status, 'failed', fixtureCase.code);
    }
    const strict = await validateBpmnXml({ xml: mutated, model, strict: true });
    assert.equal(strict.summary.status, 'failed', fixtureCase.code);
  }
});

test('v1 and dense v2 generation, layout, validation, and build regressions remain deterministic', async () => {
  for (const fixture of [valid('simple-approval.yaml'), denseFixture]) {
    const { model } = await readAndValidateYaml(fixture);
    const firstSource = await generateBpmnXml(model);
    const secondSource = await generateBpmnXml(model);
    assert.equal(firstSource, secondSource, path.basename(fixture));
    const firstLayout = await layoutBpmnXml(firstSource, model);
    const secondLayout = await layoutBpmnXml(secondSource, model);
    assert.equal(firstLayout.xml, secondLayout.xml, path.basename(fixture));
    const report = await validateBpmnXml({ xml: firstLayout.xml, model, strict: true });
    assert.equal(report.summary.status, 'passed', `${path.basename(fixture)}: ${JSON.stringify(report.findings, null, 2)}`);
  }

  const tmp = await mkdtemp(path.join(tmpdir(), 'corp-bpmn-dense-build-'));
  try {
    const yamlPath = path.join(tmp, 'process.yaml');
    await cp(denseFixture, yamlPath);
    const report = await buildCommand(yamlPath, { strict: true });
    assert.equal(report.summary.status, 'passed', JSON.stringify(report.findings, null, 2));
    const rebuilt = await validateBpmnFile({ bpmnPath: path.join(tmp, 'process.bpmn'), yamlPath, strict: true });
    assert.equal(rebuilt.summary.status, 'passed', JSON.stringify(rebuilt.findings, null, 2));
    assert.match(await readFile(path.join(tmp, 'process.bpmn'), 'utf8'), /bpmndi:BPMNDiagram/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

async function parse(xml) {
  const moddle = new BpmnModdle();
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const planeElements = definitions.diagrams?.[0]?.plane?.planeElement || [];
  const shapes = new Map(planeElements.filter((element) => element.bounds).map((element) => [element.bpmnElement.id, element.bounds]));
  const edges = new Map(planeElements.filter((element) => element.waypoint).map((element) => [element.bpmnElement.id, element]));
  return { moddle, definitions, shapes, edges };
}

async function mutateXml(xml, mutate) {
  const parsed = await parse(xml);
  mutate(parsed);
  return (await parsed.moddle.toXML(parsed.definitions, { format: true })).xml;
}

function point(value) {
  return { x: Number(value.x), y: Number(value.y) };
}

function center(bounds) {
  return { x: Number(bounds.x) + Number(bounds.width) / 2, y: Number(bounds.y) + Number(bounds.height) / 2 };
}

function contains(outer, inner) {
  return outer && inner
    && Number(inner.x) >= Number(outer.x) - EPSILON
    && Number(inner.y) >= Number(outer.y) - EPSILON
    && Number(inner.x) + Number(inner.width) <= Number(outer.x) + Number(outer.width) + EPSILON
    && Number(inner.y) + Number(inner.height) <= Number(outer.y) + Number(outer.height) + EPSILON;
}

function intersects(left, right) {
  return left && right
    && Number(left.x) <= Number(right.x) + Number(right.width) + EPSILON
    && Number(right.x) <= Number(left.x) + Number(left.width) + EPSILON
    && Number(left.y) <= Number(right.y) + Number(right.height) + EPSILON
    && Number(right.y) <= Number(left.y) + Number(left.height) + EPSILON;
}

function pointOnBoundary(value, bounds) {
  if (!value || !bounds) return false;
  const p = point(value);
  const left = Number(bounds.x);
  const right = left + Number(bounds.width);
  const top = Number(bounds.y);
  const bottom = top + Number(bounds.height);
  const withinX = p.x >= left - EPSILON && p.x <= right + EPSILON;
  const withinY = p.y >= top - EPSILON && p.y <= bottom + EPSILON;
  return (withinY && (near(p.x, left) || near(p.x, right))) || (withinX && (near(p.y, top) || near(p.y, bottom)));
}

function routeIntersectsInterior(waypoints, bounds) {
  if (!bounds || !waypoints || waypoints.length < 2) return false;
  for (let index = 1; index < waypoints.length; index += 1) {
    if (segmentIntersectsInterior(point(waypoints[index - 1]), point(waypoints[index]), bounds)) return true;
  }
  return false;
}

function segmentIntersectsInterior(start, end, bounds) {
  const minX = Number(bounds.x) + EPSILON;
  const maxX = Number(bounds.x) + Number(bounds.width) - EPSILON;
  const minY = Number(bounds.y) + EPSILON;
  const maxY = Number(bounds.y) + Number(bounds.height) - EPSILON;
  let low = 0;
  let high = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  for (const [p, q] of [[-dx, start.x - minX], [dx, maxX - start.x], [-dy, start.y - minY], [dy, maxY - start.y]]) {
    if (Math.abs(p) < Number.EPSILON) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) low = Math.max(low, ratio);
    else high = Math.min(high, ratio);
    if (low > high) return false;
  }
  return low <= high && high > Number.EPSILON && low < 1 - Number.EPSILON;
}

function near(left, right) {
  return Math.abs(Number(left) - Number(right)) <= EPSILON;
}

function copyBounds(target, source) {
  for (const field of ['x', 'y', 'width', 'height']) target[field] = Number(source[field]);
}
