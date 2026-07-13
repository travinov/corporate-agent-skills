import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { layoutBpmnXml } from '../core/bpmn-layout.mjs';

export async function layoutCommand(bpmnPath, options = {}) {
  const xml = await readFile(bpmnPath, 'utf8');
  const result = await layoutBpmnXml(xml);
  const blocker = result.findings.find((finding) => finding.layer === 'layout' && finding.severity === 'error');
  if (blocker) {
    const error = new Error(`[${blocker.code}] ${blocker.message}`);
    error.exitCode = 3;
    error.findings = result.findings;
    throw error;
  }
  const out = options.out || bpmnPath;
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, result.xml, 'utf8');
  console.log(`Layouted ${out}`);
}
