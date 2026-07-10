import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');

export async function runSelfCheck() {
  const schemaDir = path.resolve(__dirname, '../schemas');
  const schemaPaths = [path.join(schemaDir, 'process.v1.schema.json'), path.join(schemaDir, 'process.v2.schema.json')];
  const schemas = await Promise.all(schemaPaths.map(async (schemaPath) => JSON.parse(await readFile(schemaPath, 'utf8'))));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const schema of schemas) ajv.compile(schema);

  const matrixPath = path.resolve(__dirname, '../capabilities/capability-matrix.json');
  const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
  const traceabilityPath = path.resolve(packageRoot, '../../tests/traceability.json');
  const traceability = JSON.parse(await readFile(traceabilityPath, 'utf8'));
  validateCapabilityMatrix(matrix, traceability);

  const requiredFiles = ['package.json', 'package-lock.json', 'src/schemas/process.v1.schema.json', 'src/schemas/process.v2.schema.json', 'src/capabilities/capability-matrix.json', '../../tests/traceability.json'];
  for (const file of requiredFiles) await readFile(path.join(packageRoot, file));
  return { schemas: schemas.length, capabilities: matrix.capabilities.length, requiredFiles: requiredFiles.length };
}

export function validateCapabilityMatrix(matrix, traceability = { evidence: [] }) {
  if (matrix?.matrix_version !== 1 || !Array.isArray(matrix.capabilities)) {
    throw new Error('capability matrix must declare matrix_version 1 and capabilities[]');
  }
  const ids = new Set();
  const evidenceIds = new Set((traceability.evidence || []).map((entry) => entry.id));
  for (const capability of matrix.capabilities) {
    if (!capability?.id || ids.has(capability.id)) throw new Error(`duplicate or missing capability id '${capability?.id || ''}'`);
    ids.add(capability.id);
    if (!['supported', 'partial', 'unsupported'].includes(capability.status)) throw new Error(`invalid status for ${capability.id}`);
    if (!Array.isArray(capability.versions) || !capability.versions.length || capability.versions.some((version) => ![1, 2].includes(version))) {
      throw new Error(`invalid versions for ${capability.id}`);
    }
    const evidence = capability.evidence || {};
    for (const kind of ['positive', 'negative', 'roundtrip']) {
      if (!Array.isArray(evidence[kind])) throw new Error(`missing ${kind} evidence for ${capability.id}`);
      for (const evidenceId of evidence[kind]) if (!evidenceIds.has(evidenceId)) throw new Error(`unknown evidence '${evidenceId}' for ${capability.id}`);
    }
    if (['supported', 'partial'].includes(capability.status) && (!evidence.positive.length || !evidence.negative.length || !evidence.roundtrip.length)) {
      throw new Error(`${capability.status} capability ${capability.id} requires positive, negative, and roundtrip evidence`);
    }
  }
}
