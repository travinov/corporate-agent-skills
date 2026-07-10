import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildCommand } from '../scripts/corp-bpmn/src/commands/build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('build command writes BPMN, report, and documentation', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'corp-bpmn-'));
  const target = path.join(tmp, 'credit-approval');
  await cp(path.join(root, 'examples/credit-approval'), target, { recursive: true });
  const originalExit = process.exit;
  try {
    process.exit = (code) => {
      throw new Error(`unexpected exit ${code}`);
    };
    await buildCommand(path.join(target, 'process.yaml'));
    const bpmn = await readFile(path.join(target, 'process.bpmn'), 'utf8');
    const report = JSON.parse(await readFile(path.join(target, 'validation-report.json'), 'utf8'));
    const md = await readFile(path.join(target, 'process.md'), 'utf8');
    assert.match(bpmn, /bpmndi:BPMNDiagram/);
    assert.equal(report.summary.status, 'passed');
    assert.match(md, /Corporate Credit Approval/);
  } finally {
    process.exit = originalExit;
    await rm(tmp, { recursive: true, force: true });
  }
});
