import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import BpmnModdle from 'bpmn-moddle';
import { stringify } from 'yaml';
import { readAndValidateYaml, readProcessYaml } from '../core/yaml-reader.mjs';
import { migrateV1ToV2 } from '../core/migrator.mjs';
import { resolveAndValidateProcessModel } from '../core/yaml-validator.mjs';
import { lintProcessModel } from '../core/semantic-linter.mjs';
import { generateBpmnXml } from '../core/bpmn-generator.mjs';
import { validateSemanticRoundTrip } from '../core/semantic-roundtrip.mjs';

export async function migrateCommand(inputPath, options = {}) {
  const targetVersion = Number(options.toVersion);
  if (targetVersion !== 2) throw migrationFailure('migration.target_version', `only migration to schema version 2 is supported; received ${options.toVersion}`);
  if (!options.out) throw migrationFailure('migration.output_required', 'an explicit --out path is required');
  const input = await readProcessYaml(inputPath);
  const sourceVersion = input.schema_version ?? 1;
  if (sourceVersion === 1 && (input.participants || []).length > 1) {
    throw migrationFailure('migration.ambiguous_process_ownership', 'v1 contains multiple participants without explicit process ownership');
  }
  const { model } = await readAndValidateYaml(inputPath);
  const migrated = migrateV1ToV2(model);
  const resolved = await resolveAndValidateProcessModel(migrated);
  const findings = [...resolved.findings, ...lintProcessModel(resolved.model)];
  const errors = findings.filter((finding) => finding.severity === 'error');
  if (errors.length) throw migrationFailure('migration.target_invalid', 'migrated v2 model failed validation', findings);
  const xml = await generateBpmnXml(resolved.model);
  const parsed = await new BpmnModdle().fromXML(xml);
  const roundTrip = validateSemanticRoundTrip(resolved.model, parsed.rootElement);
  if (roundTrip.length) throw migrationFailure('migration.roundtrip_failed', 'migrated v2 model failed semantic round-trip validation', roundTrip);
  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, stringify(resolved.model), 'utf8');
  console.log(`Migrated ${inputPath} -> ${options.out}`);
  return { model: resolved.model, findings };
}

function migrationFailure(code, message, findings = null) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = 7;
  error.findings = findings || [{ layer: 'migration', severity: 'error', code, message }];
  return error;
}
