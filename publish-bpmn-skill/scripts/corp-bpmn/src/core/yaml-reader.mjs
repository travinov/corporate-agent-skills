import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { resolveAndValidateProcessModel } from './yaml-validator.mjs';
import { lintProcessModel } from './semantic-linter.mjs';

export async function readProcessYaml(filePath) {
  const text = await readFile(filePath, 'utf8');
  return parse(text);
}

export async function readAndValidateYaml(filePath) {
  const input = await readProcessYaml(filePath);
  const resolved = await resolveAndValidateProcessModel(input);
  const semanticFindings = resolved.findings.some((finding) => finding.layer === 'schema' && finding.severity === 'error') ? [] : lintProcessModel(resolved.model);
  const schemaFindings = [...resolved.findings, ...semanticFindings];
  const errors = schemaFindings.filter((finding) => finding.severity === 'error');
  if (errors.length) {
    const message = errors.map((finding) => `${finding.code}: ${finding.message}`).join('\n');
    const error = new Error(`process.yaml validation failed:\n${message}`);
    error.exitCode = 1;
    error.findings = schemaFindings;
    error.model = resolved.model;
    error.validationContext = resolved.context;
    throw error;
  }
  return { model: resolved.model, schemaFindings, validationContext: resolved.context };
}
