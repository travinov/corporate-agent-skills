import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { validateBpmnFile } from '../core/bpmn-validator.mjs';
import { exitCodeForReport } from '../core/validation-report.mjs';

export async function validateCommand(bpmnPath, options = {}) {
  const report = await validateBpmnFile({ bpmnPath, yamlPath: options.yaml, strict: Boolean(options.strict) });
  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report.summary, null, 2));
  const code = exitCodeForReport(report, Boolean(options.strict));
  if (code) process.exit(code);
}
