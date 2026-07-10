import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readAndValidateYaml } from '../core/yaml-reader.mjs';
import { generateBpmnXml } from '../core/bpmn-generator.mjs';

export async function generateCommand(yamlPath, options) {
  const { model } = await readAndValidateYaml(yamlPath);
  const xml = await generateBpmnXml(model);
  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, xml, 'utf8');
  console.log(`Generated ${options.out}`);
}
