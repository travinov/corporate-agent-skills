import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import BpmnModdle from '../scripts/corp-bpmn/node_modules/bpmn-moddle/dist/index.js';
import { readAndValidateYaml, readProcessYaml } from '../scripts/corp-bpmn/src/core/yaml-reader.mjs';
import { resolveAndValidateProcessModel, validateProcessModel } from '../scripts/corp-bpmn/src/core/yaml-validator.mjs';
import { generateBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-generator.mjs';
import { layoutBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-layout.mjs';
import { validateBpmnFile, validateBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-validator.mjs';
import { projectBpmnDefinitions, projectSourceModel, validateSemanticRoundTrip } from '../scripts/corp-bpmn/src/core/semantic-roundtrip.mjs';
import { migrateCommand } from '../scripts/corp-bpmn/src/commands/migrate.mjs';
import { initCommand } from '../scripts/corp-bpmn/src/commands/init.mjs';
import { buildCommand } from '../scripts/corp-bpmn/src/commands/build.mjs';
import { runSelfCheck } from '../scripts/corp-bpmn/src/core/self-check.mjs';
import { buildReport } from '../scripts/corp-bpmn/src/core/validation-report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const valid = (name) => path.join(root, 'fixtures/valid', name);
const invalid = (name) => path.join(root, 'fixtures/invalid', name);

test('self-check compiles both strict schemas and verifies capability evidence', async () => {
  const result = await runSelfCheck();
  assert.deepEqual(result, { schemas: 2, capabilities: 34, requiredFiles: 6 });
});

test('traceability groups cover every scenario-bearing OpenSpec capability', async () => {
  const traceability = JSON.parse(await readFile(path.join(root, 'traceability.json'), 'utf8'));
  const specsRoot = path.resolve(root, '../../openspec/changes/preserve-bpmn-skill-semantics/specs');
  const expectedCapabilities = ['bpmn-architect-skill', 'bpmn-collaboration-v2', 'bpmn-semantic-roundtrip', 'bpmn-validation-reporting', 'corp-bpmn-cli', 'process-yaml-model'];
  let capabilities = expectedCapabilities;
  try {
    capabilities = await readdir(specsRoot);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const groups = new Map(traceability.scenario_coverage.map((group) => [group.capability, group]));
  for (const capability of capabilities) {
    try {
      const spec = await readFile(path.join(specsRoot, capability, 'spec.md'), 'utf8');
      const scenarios = [...spec.matchAll(/^#### Scenario: (.+)$/gm)].map((match) => match[1]);
      assert.ok(scenarios.length > 0, capability);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const group = groups.get(capability);
    assert.equal(group?.scenarios, 'all', capability);
    assert.ok(group.tests.length > 0, capability);
    for (const testFile of group.tests) await readFile(path.join(root, testFile), 'utf8');
  }
  assert.deepEqual([...groups.keys()].sort(), expectedCapabilities.sort());
});

test('version dispatcher distinguishes explicit, implicit, malformed, and unsupported versions', async () => {
  const base = minimalV1();
  assert.equal((await resolveAndValidateProcessModel(base)).context.resolvedVersion, 1);
  const implicit = structuredClone(base);
  delete implicit.schema_version;
  const implicitResult = await resolveAndValidateProcessModel(implicit);
  assert.ok(implicitResult.findings.some((finding) => finding.code === 'schema.version_implicit'));
  const malformed = await resolveAndValidateProcessModel({ ...base, schema_version: '1' });
  assert.ok(malformed.findings.some((finding) => finding.code === 'schema.version_invalid'));
  const unsupported = await resolveAndValidateProcessModel({ ...base, schema_version: 3 });
  assert.ok(unsupported.findings.some((finding) => finding.code === 'schema.version_unsupported'));
});

test('strict schema rejects unknown fields and canonical string conditions', async () => {
  const unknown = await validateProcessModel(await readProcessYaml(invalid('unknown-property.yaml')));
  assert.ok(unknown.some((finding) => finding.code === 'schema.additional_property' && finding.path.endsWith('/actor')));
  const condition = await validateProcessModel(await readProcessYaml(invalid('condition-string-v1.yaml')));
  assert.ok(condition.some((finding) => finding.code.startsWith('schema.') && finding.path.includes('/condition')));
});

test('schema findings retain required-property identity and strict reports fail warnings', async () => {
  const missing = minimalV1();
  delete missing.process.name;
  const findings = await validateProcessModel(missing);
  assert.ok(findings.some((finding) => finding.code === 'schema.required' && finding.path === '/process/name'));
  const report = buildReport({ findings: [{ layer: 'capability', severity: 'warning', code: 'capability.partial', message: 'review' }], strict: true });
  assert.equal(report.summary.status, 'failed');
});

test('unsupported recognized BPMN type fails with capability code and no generator fallback', async () => {
  const model = await readProcessYaml(invalid('unsupported-node.yaml'));
  const findings = await validateProcessModel(model);
  assert.ok(findings.some((finding) => finding.code === 'capability.unsupported' && finding.element === 'choreography'));
  await assert.rejects(() => generateBpmnXml(model), (error) => error.code === 'capability.unsupported');
});

test('all advertised supported node variants satisfy their strict schema shape', async () => {
  const nodeTypes = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'task', 'userTask', 'serviceTask', 'manualTask', 'businessRuleTask', 'scriptTask', 'sendTask', 'receiveTask', 'callActivity', 'subProcess', 'transaction', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'];
  for (const type of nodeTypes) {
    const model = minimalV1();
    model.nodes.push({ id: `candidate_${type}`, type, name: `Candidate ${type}` });
    const findings = await validateProcessModel(model);
    assert.equal(findings.filter((finding) => finding.layer === 'schema' && finding.severity === 'error').length, 0, type);
  }
});

test('all supported node and event-definition variants generate and round-trip', async () => {
  const nodeTypes = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'task', 'userTask', 'serviceTask', 'manualTask', 'businessRuleTask', 'scriptTask', 'sendTask', 'receiveTask', 'callActivity', 'subProcess', 'transaction', 'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'];
  for (const type of nodeTypes) {
    const model = minimalV1();
    model.nodes.push({ id: `candidate_${type}`, type, name: `Candidate ${type}` });
    const xml = await generateBpmnXml(model);
    const parsed = await new BpmnModdle().fromXML(xml);
    assert.equal(validateSemanticRoundTrip(model, parsed.rootElement).length, 0, type);
  }
  const definitions = new Map([
    ['timer', 'intermediateCatchEvent'], ['message', 'intermediateCatchEvent'], ['error', 'boundaryEvent'],
    ['escalation', 'boundaryEvent'], ['signal', 'intermediateCatchEvent'], ['conditional', 'intermediateCatchEvent'],
    ['compensation', 'boundaryEvent'], ['link', 'intermediateCatchEvent']
  ]);
  for (const [eventDefinition, type] of definitions) {
    const model = minimalV1();
    model.nodes.splice(1, 0, { id: 'host', type: 'task', name: 'Process host' });
    model.nodes.push({ id: `event_${eventDefinition}`, type, name: `Event ${eventDefinition}`, eventDefinition, ...(type === 'boundaryEvent' ? { attachedTo: 'host' } : {}) });
    const xml = await generateBpmnXml(model);
    const parsed = await new BpmnModdle().fromXML(xml);
    assert.equal(validateSemanticRoundTrip(model, parsed.rootElement).length, 0, eventDefinition);
  }
});

test('unsupported data, artifacts, extensions, and multi-participant v1 fail with capability findings', async () => {
  for (const [field, value] of [['data', [{ id: 'data1', type: 'dataObject' }]], ['artifacts', [{ id: 'artifact1', type: 'textAnnotation' }]], ['extensions', { vendor: true }]]) {
    const model = minimalV1();
    model[field] = value;
    const findings = await validateProcessModel(model);
    assert.ok(findings.some((finding) => finding.code === 'capability.unsupported' && finding.path.includes(field)), field);
  }
  const multiple = await validateProcessModel(await readProcessYaml(invalid('v1-multi-participant.yaml')));
  assert.ok(multiple.some((finding) => finding.code === 'capability.unsupported' && finding.path === '/participants'));
});

test('event definitions and boundary attachments are rejected on incompatible shapes', async () => {
  const eventOnTask = minimalV1();
  eventOnTask.nodes.push({ id: 'invalid-event', type: 'task', name: 'Process event', eventDefinition: 'timer' });
  assert.ok((await validateProcessModel(eventOnTask)).some((finding) => finding.layer === 'schema' && finding.path.includes('eventDefinition')));
  const boundaryOnGateway = minimalV1();
  boundaryOnGateway.nodes.push({ id: 'gateway', type: 'exclusiveGateway', name: 'Valid?' }, { id: 'boundary', type: 'boundaryEvent', name: 'Timeout', attachedTo: 'gateway', eventDefinition: 'timer' });
  assert.ok((await validateProcessModel(boundaryOnGateway)).some((finding) => finding.code === 'semantics.invalid_boundary_attachment'));
});

test('definitions-wide duplicates and process-scoped cross references fail closed', async () => {
  const duplicate = minimalV1();
  duplicate.nodes[0].id = duplicate.process.id;
  const duplicateFindings = await validateProcessModel(duplicate);
  assert.ok(duplicateFindings.some((finding) => finding.code === 'references.duplicate_id'));
  const cross = await validateProcessModel(await readProcessYaml(invalid('v2-cross-process-sequence.yaml')));
  assert.ok(cross.some((finding) => finding.code === 'references.unresolved_flow_target' && finding.element === 'invalid-cross-flow'));
});

test('v2 node and participant message flows preserve distinct process ownership', async () => {
  for (const fixture of ['collaboration-message-flow.yaml', 'v2-participant-message-flow.yaml']) {
    const { model } = await readAndValidateYaml(valid(fixture));
    const xml = await generateBpmnXml(model);
    const parsed = await new BpmnModdle().fromXML(xml);
    const processes = parsed.rootElement.rootElements.filter((element) => element.$type === 'bpmn:Process');
    const collaboration = parsed.rootElement.rootElements.find((element) => element.$type === 'bpmn:Collaboration');
    assert.equal(processes.length, 2, fixture);
    assert.equal(new Set(collaboration.participants.map((participant) => participant.processRef.id)).size, 2, fixture);
    assert.equal(validateSemanticRoundTrip(model, parsed.rootElement).length, 0, fixture);
  }
});

test('v2 rejects missing or shared participant process ownership', async () => {
  const model = await readProcessYaml(valid('collaboration-message-flow.yaml'));
  model.participants[1].process_ref = 'missing-process';
  const missing = await validateProcessModel(model);
  assert.ok(missing.some((finding) => finding.code === 'references.unresolved_process'));
  model.participants[1].process_ref = model.participants[0].process_ref;
  const shared = await validateProcessModel(model);
  assert.ok(shared.some((finding) => finding.code === 'semantics.shared_process_owner'));
});

test('round-trip reports semantic loss even when altered XML remains parseable', async () => {
  const { model } = await readAndValidateYaml(valid('coffee-three-methods.yaml'));
  const xml = await generateBpmnXml(model);
  const moddle = new BpmnModdle();
  const parsed = await moddle.fromXML(xml);
  const process = parsed.rootElement.rootElements.find((element) => element.$type === 'bpmn:Process');
  process.flowElements.find((element) => element.id === 'flow-choice-espresso').conditionExpression = undefined;
  const { xml: altered } = await moddle.toXML(parsed.rootElement, { format: true });
  const reparsed = await moddle.fromXML(altered);
  const findings = validateSemanticRoundTrip(model, reparsed.rootElement);
  assert.ok(findings.some((finding) => finding.code === 'roundtrip.condition_missing'));
});

test('round-trip detects loss across every protected semantic family', async () => {
  const model = minimalV1();
  model.nodes = [
    { id: 'start', type: 'startEvent', name: 'Start' },
    { id: 'work', type: 'task', name: 'Process work', documentation: 'Keep this' },
    { id: 'timeout', type: 'boundaryEvent', name: 'Timeout', attachedTo: 'work', eventDefinition: 'timer' },
    { id: 'decision', type: 'exclusiveGateway', name: 'Approved?', default: 'fallback' },
    { id: 'end', type: 'endEvent', name: 'End' }
  ];
  model.flows = [
    { id: 'f1', from: 'start', to: 'work' }, { id: 'f2', from: 'work', to: 'decision' },
    { id: 'conditional', from: 'decision', to: 'end', condition: { body: 'approved', language: 'FEEL' } },
    { id: 'fallback', from: 'decision', to: 'end' }
  ];
  const xml = await generateBpmnXml(model);
  const mutations = [
    (definitions) => { findElement(definitions, 'conditional').conditionExpression = undefined; },
    (definitions) => { findElement(definitions, 'decision').default = undefined; },
    (definitions) => { findElement(definitions, 'timeout').attachedToRef = undefined; },
    (definitions) => { findElement(definitions, 'timeout').eventDefinitions = []; },
    (definitions) => { findElement(definitions, 'work').documentation = []; }
  ];
  for (const mutate of mutations) {
    const parsed = await new BpmnModdle().fromXML(xml);
    mutate(parsed.rootElement);
    assert.ok(validateSemanticRoundTrip(model, parsed.rootElement).length > 0);
  }
  const collaborationModel = (await readAndValidateYaml(valid('collaboration-message-flow.yaml'))).model;
  const collaborationXml = await generateBpmnXml(collaborationModel);
  for (const mutate of [
    (definitions) => {
      const collaboration = definitions.rootElements.find((element) => element.$type === 'bpmn:Collaboration');
      collaboration.participants[1].processRef = collaboration.participants[0].processRef;
    },
    (definitions) => {
      const collaboration = definitions.rootElements.find((element) => element.$type === 'bpmn:Collaboration');
      collaboration.messageFlows[0].targetRef = collaboration.messageFlows[0].sourceRef;
    }
  ]) {
    const parsed = await new BpmnModdle().fromXML(collaborationXml);
    mutate(parsed.rootElement);
    assert.ok(validateSemanticRoundTrip(collaborationModel, parsed.rootElement).length > 0);
  }
});

test('condition language, default flow, boundary attachment, and documentation round-trip', async () => {
  const model = minimalV1();
  model.nodes = [
    { id: 'start', type: 'startEvent', name: 'Start' },
    { id: 'work', type: 'task', name: 'Process work', documentation: 'Protected documentation' },
    { id: 'timeout', type: 'boundaryEvent', name: 'Timeout', attachedTo: 'work', eventDefinition: 'timer' },
    { id: 'decision', type: 'exclusiveGateway', name: 'Approved?', default: 'fallback' },
    { id: 'end', type: 'endEvent', name: 'End' }
  ];
  model.flows = [
    { id: 'f1', from: 'start', to: 'work' },
    { id: 'f2', from: 'work', to: 'decision' },
    { id: 'conditional', from: 'decision', to: 'end', condition: { body: 'approved', language: 'FEEL' } },
    { id: 'fallback', from: 'decision', to: 'end' }
  ];
  const resolved = await resolveAndValidateProcessModel(model);
  assert.equal(resolved.findings.filter((finding) => finding.severity === 'error').length, 0);
  const xml = await generateBpmnXml(model);
  const parsed = await new BpmnModdle().fromXML(xml);
  assert.equal(validateSemanticRoundTrip(model, parsed.rootElement).length, 0);
});

test('report contract separates report/schema versions and artifact-only preservation', async () => {
  const { model, schemaFindings, validationContext } = await readAndValidateYaml(valid('simple-approval.yaml'));
  const raw = await generateBpmnXml(model);
  const layout = await layoutBpmnXml(raw, model);
  const report = await validateBpmnXml({ xml: layout.xml, model, schemaFindings, validationContext });
  assert.equal(report.report_version, 1);
  assert.equal(report.schema_version, 1);
  assert.equal(report.preservation, 'evaluated');
  const artifactOnly = await validateBpmnXml({ xml: layout.xml });
  assert.equal(artifactOnly.preservation, 'not-evaluated');
  assert.ok(artifactOnly.findings.some((finding) => finding.code === 'roundtrip.not_evaluated'));
  const invalidSource = structuredClone(model);
  invalidSource.nodes = invalidSource.nodes.filter((node) => node.type !== 'startEvent');
  invalidSource.flows = invalidSource.flows.filter((flow) => flow.from !== 'start');
  const invalidReport = await validateBpmnXml({ xml: layout.xml, model: invalidSource });
  assert.equal(invalidReport.preservation, 'not-evaluated');
  assert.ok(invalidReport.findings.some((finding) => finding.code === 'roundtrip.source_invalid'));
});

test('v1 migration is non-destructive, v2-valid, and ambiguity fails with migration code', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'corp-bpmn-migration-'));
  try {
    const source = path.join(tmp, 'source.yaml');
    const target = path.join(tmp, 'target.yaml');
    const sourceText = await readFile(valid('simple-approval.yaml'), 'utf8');
    await writeFile(source, sourceText, 'utf8');
    await migrateCommand(source, { toVersion: '2', out: target });
    assert.equal(await readFile(source, 'utf8'), sourceText);
    const migrated = await readAndValidateYaml(target);
    assert.equal(migrated.model.schema_version, 2);
    const xml = await generateBpmnXml(migrated.model);
    const parsed = await new BpmnModdle().fromXML(xml);
    assert.equal(validateSemanticRoundTrip(migrated.model, parsed.rootElement).length, 0);
    const ambiguous = path.join(tmp, 'ambiguous.yaml');
    await writeFile(ambiguous, await readFile(invalid('v1-multi-participant.yaml'), 'utf8'), 'utf8');
    await assert.rejects(() => migrateCommand(ambiguous, { toVersion: '2', out: path.join(tmp, 'never.yaml') }), (error) => error.code === 'migration.ambiguous_process_ownership');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('v1 and v2 starters build strict with complete deterministic DI', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'corp-bpmn-starters-'));
  try {
    for (const version of [1, 2]) {
      const dir = path.join(tmp, `v${version}`);
      await initCommand(dir, { schemaVersion: String(version) });
      const report = await buildCommand(path.join(dir, 'process.yaml'), { strict: true });
      assert.equal(report.summary.status, 'passed', `v${version}`);
      assert.equal(report.preservation, 'evaluated', `v${version}`);
      const validated = await validateBpmnFile({ bpmnPath: path.join(dir, 'process.bpmn'), yamlPath: path.join(dir, 'process.yaml'), strict: true });
      assert.equal(validated.summary.status, 'passed', `v${version}`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('generation and semantic projections are deterministic', async () => {
  for (const fixture of ['simple-approval.yaml', 'collaboration-message-flow.yaml']) {
    const { model } = await readAndValidateYaml(valid(fixture));
    const first = await generateBpmnXml(model);
    const second = await generateBpmnXml(model);
    assert.equal(first, second, fixture);
    const firstParsed = await new BpmnModdle().fromXML(first);
    assert.deepEqual(projectBpmnDefinitions(firstParsed.rootElement, model.schema_version), projectSourceModel(model), fixture);
    const firstLayout = await layoutBpmnXml(first, model);
    const secondLayout = await layoutBpmnXml(second, model);
    assert.equal(firstLayout.xml, secondLayout.xml, fixture);
    const firstReport = await validateBpmnXml({ xml: firstLayout.xml, model });
    const secondReport = await validateBpmnXml({ xml: secondLayout.xml, model });
    assert.deepEqual(firstReport, secondReport, fixture);
  }
});

function minimalV1() {
  return {
    schema_version: 1,
    process: { id: 'minimal-process', name: 'Minimal Process', executable: false, target_engine: 'none' },
    participants: [], lanes: [],
    nodes: [{ id: 'start', type: 'startEvent', name: 'Start' }, { id: 'end', type: 'endEvent', name: 'End' }],
    flows: [{ id: 'flow1', from: 'start', to: 'end' }],
    message_flows: [], data: [], artifacts: [], extensions: {}, documentation: {}
  };
}

function findElement(definitions, id) {
  for (const process of definitions.rootElements.filter((element) => element.$type === 'bpmn:Process')) {
    const found = process.flowElements.find((element) => element.id === id);
    if (found) return found;
  }
  throw new Error(`element '${id}' not found`);
}
