import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readAndValidateYaml, readProcessYaml } from '../scripts/corp-bpmn/src/core/yaml-reader.mjs';
import { generateBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-generator.mjs';
import { layoutBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-layout.mjs';
import { validateBpmnXml } from '../scripts/corp-bpmn/src/core/bpmn-validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const requireFromCli = createRequire(new URL('../scripts/corp-bpmn/package.json', import.meta.url));
const BpmnModdle = requireFromCli('bpmn-moddle');

test('generated BPMN parses with bpmn-moddle', async () => {
  const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid/simple-approval.yaml'));
  const xml = await generateBpmnXml(model);
  assert.match(xml, /bpmn:process/);
  const report = await validateBpmnXml({ xml, model });
  assert.equal(report.findings.filter((f) => f.layer === 'bpmn-parse' && f.severity === 'error').length, 0);
});

test('layout adds BPMN DI', async () => {
  const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid/simple-approval.yaml'));
  const xml = await generateBpmnXml(model);
  const layout = await layoutBpmnXml(xml, model);
  assert.match(layout.xml, /bpmndi:BPMNDiagram/);
  assert.match(layout.xml, /bpmndi:BPMNShape/);
});

test('advanced elements produce capability warnings when applicable', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/valid/advanced-boundary.yaml'));
  const xml = await generateBpmnXml(model);
  const layout = await layoutBpmnXml(xml, model);
  assert.ok(Array.isArray(layout.findings));
});

test('collaboration with message flow generates BPMN XML', async () => {
  const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid/collaboration-message-flow.yaml'));
  const xml = await generateBpmnXml(model);
  assert.match(xml, /bpmn:collaboration/i);
  assert.match(xml, /bpmn:messageFlow/i);
  const report = await validateBpmnXml({ xml, model });
  assert.equal(report.findings.filter((f) => f.layer === 'bpmn-parse' && f.severity === 'error').length, 0);
});

test('subprocess generates BPMN XML', async () => {
  const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid/subprocess.yaml'));
  const xml = await generateBpmnXml(model);
  assert.match(xml, /bpmn:subProcess/);
});

test('gateway default target and flow references generate the same BPMN default flow', async () => {
  for (const fixture of ['exclusive-default-target.yaml', 'exclusive-default-flow.yaml']) {
    const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid', fixture));
    const xml = await generateBpmnXml(model);
    assert.match(xml, /<bpmn:exclusiveGateway[^>]*id="choose-route"[^>]*default="flow-other"/i, fixture);
  }
});

test('sequence flow condition survives generation and BPMN parse-back', async () => {
  const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid/coffee-three-methods.yaml'));
  const xml = await generateBpmnXml(model);
  const moddle = new BpmnModdle();
  const { rootElement } = await moddle.fromXML(xml);
  const process = rootElement.rootElements.find((element) => element.$type === 'bpmn:Process');
  const flow = process.flowElements.find((element) => element.$type === 'bpmn:SequenceFlow' && element.id === 'flow-choice-espresso');
  assert.equal(flow.conditionExpression?.$type, 'bpmn:FormalExpression');
  assert.equal(flow.conditionExpression?.body, 'method == "espresso"');
});
