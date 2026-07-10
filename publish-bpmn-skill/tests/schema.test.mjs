import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProcessYaml } from '../scripts/corp-bpmn/src/core/yaml-reader.mjs';
import { resolveAndValidateProcessModel, validateProcessModel } from '../scripts/corp-bpmn/src/core/yaml-validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

test('valid simple YAML passes schema and reference validation', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/valid/simple-approval.yaml'));
  const findings = await validateProcessModel(model);
  assert.equal(findings.filter((f) => f.severity === 'error').length, 0);
});

test('advanced boundary event is accepted by schema', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/valid/advanced-boundary.yaml'));
  const findings = await validateProcessModel(model);
  assert.equal(findings.filter((f) => f.severity === 'error').length, 0);
});

test('dangling flow fails reference validation', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/dangling-flow.yaml'));
  const findings = await validateProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'references.unresolved_flow_target' && f.path === '/flows/flow1/to'));
});

test('gateway default accepts a canonical flow id and normalizes an unversioned target reference', async () => {
  for (const fixture of ['exclusive-default-target.yaml', 'exclusive-default-flow.yaml']) {
    const model = await readProcessYaml(path.join(root, 'fixtures/valid', fixture));
    const result = await resolveAndValidateProcessModel(model);
    assert.equal(result.findings.filter((f) => f.severity === 'error').length, 0, fixture);
    assert.equal(result.model.nodes.find((node) => node.id === 'choose-route').default, 'flow-other', fixture);
    if (fixture.includes('target')) assert.ok(result.findings.some((finding) => finding.code === 'schema.legacy_default_target'));
  }
});

test('gateway default rejects a node that is not an outgoing target', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/exclusive-invalid-default.yaml'));
  const findings = await validateProcessModel(model);
  assert.ok(findings.some((f) => f.code === 'references.invalid_default' && f.path === '/nodes/choose-route/default'));
});

test('canonical v1 rejects an outgoing target node as a default reference', async () => {
  const model = await readProcessYaml(path.join(root, 'fixtures/invalid/exclusive-default-target-v1.yaml'));
  const findings = await validateProcessModel(model);
  assert.ok(findings.some((finding) => finding.code === 'references.invalid_default' && finding.path === '/nodes/choose-route/default'));
});
