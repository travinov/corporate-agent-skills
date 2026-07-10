import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAndValidateYaml, readProcessYaml } from '../scripts/corp-bpmn/src/core/yaml-reader.mjs';
import { lintProcessModel } from '../scripts/corp-bpmn/src/core/semantic-linter.mjs';
import { validateProcessModel } from '../scripts/corp-bpmn/src/core/yaml-validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

test('valid rework cycle with exit is not failed as cycle without exit', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/valid/cycle-with-exit.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'semantic.cycle_with_exit'));
  assert.ok(!findings.some((f) => f.code === 'semantic.cycle_without_exit'));
});

test('cycle without exit is an error', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/cycle-without-exit.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'semantic.cycle_without_exit' && f.severity === 'error'));
});

test('missing start is an error', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/missing-start.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'semantic.missing_start'));
});

test('exclusive gateway without outgoing labels is an error', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/exclusive-without-labels.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'semantic.gateway_labels' && f.severity === 'error'));
});

test('exclusive gateway with explicit alternatives does not require a default', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/valid/coffee-three-methods.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(!model.nodes.find((node) => node.id === 'choose-method').default);
  assert.ok(!findings.some((f) => f.code === 'semantic.gateway_labels'));
});

test('valid target and flow default references exempt only the default branch', async () => {
  for (const fixture of ['exclusive-default-target.yaml', 'exclusive-default-flow.yaml']) {
    const { model } = await readAndValidateYaml(path.join(root, 'fixtures/valid', fixture));
    const findings = lintProcessModel(model);
    assert.ok(!findings.some((f) => f.code === 'semantic.gateway_labels'), fixture);
  }
});

test('invalid default does not hide an unlabeled outgoing branch', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/exclusive-invalid-default.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'semantic.gateway_labels' && f.element === 'flow-other' && f.severity === 'error'));
});

test('Russian task and gateway labels do not produce English-only style warnings', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/valid/coffee-three-methods.yaml'));
  const findings = lintProcessModel(model);
  assert.ok(!findings.some((f) => f.code === 'semantic.task_verb'));
  assert.ok(!findings.some((f) => f.code === 'semantic.gateway_question'));
});

test('message flow inside one participant is an error', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/message-flow-inside-pool.yaml'));
  const findings = await validateProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'semantics.message_flow_same_process'));
});
