import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readAndValidateYaml } from '../core/yaml-reader.mjs';
import { generateBpmnXml } from '../core/bpmn-generator.mjs';
import { layoutBpmnXml } from '../core/bpmn-layout.mjs';
import { validateBpmnXml } from '../core/bpmn-validator.mjs';
import { writeProcessDocumentation } from '../core/documentation-generator.mjs';
import { buildReport, exitCodeForReport } from '../core/validation-report.mjs';

export async function buildCommand(yamlPath, options = {}) {
  const dir = path.dirname(yamlPath);
  const bpmnPath = path.join(dir, 'process.bpmn');
  const reportPath = path.join(dir, 'validation-report.json');
  const docPath = path.join(dir, 'process.md');
  await mkdir(dir, { recursive: true });
  let validated;
  try {
    validated = await readAndValidateYaml(yamlPath);
  } catch (error) {
    if (!error.findings) throw error;
    const report = buildReport({ source: { yamlPath }, model: error.model, findings: error.findings, strict: Boolean(options.strict), validationContext: error.validationContext, preservationEvaluated: false });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    if (error.model) await writeProcessDocumentation(error.model, { report, outPath: docPath });
    error.exitCode = exitCodeForReport(report, Boolean(options.strict));
    throw error;
  }
  const { model, schemaFindings, validationContext } = validated;
  const rawXml = await generateBpmnXml(model);
  const layout = await layoutBpmnXml(rawXml, model);
  await writeFile(bpmnPath, layout.xml, 'utf8');
  const report = await validateBpmnXml({
    xml: layout.xml,
    model,
    schemaFindings,
    validationContext,
    layoutFindings: layout.findings,
    source: { yamlPath, bpmnPath },
    strict: Boolean(options.strict)
  });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeProcessDocumentation(model, { report, outPath: docPath });
  console.log(`Built ${dir}`);
  const code = exitCodeForReport(report, Boolean(options.strict));
  if (code) {
    const error = new Error(`build failed with exit code ${code}`);
    error.exitCode = code;
    error.report = report;
    throw error;
  }
  return report;
}
