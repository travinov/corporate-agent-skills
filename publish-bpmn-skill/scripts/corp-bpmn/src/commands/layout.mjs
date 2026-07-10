import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { layoutBpmnXml } from '../core/bpmn-layout.mjs';

export async function layoutCommand(bpmnPath, options = {}) {
  const xml = await readFile(bpmnPath, 'utf8');
  const result = await layoutBpmnXml(xml);
  const out = options.out || bpmnPath;
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, result.xml, 'utf8');
  console.log(`Layouted ${out}`);
}
