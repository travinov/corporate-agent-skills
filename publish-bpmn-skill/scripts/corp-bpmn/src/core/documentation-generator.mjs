import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { allNodes, processScopes } from './model-utils.mjs';

export async function writeProcessDocumentation(model, { report = null, outPath }) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, renderProcessMarkdown(model, report), 'utf8');
}

export function renderProcessMarkdown(model, report = null) {
  const doc = model.documentation || {};
  const scopes = processScopes(model);
  const title = model.schema_version === 2 ? model.definitions.name : model.process.name;
  const advanced = allNodes(model).filter((node) => isAdvanced(node.type));
  const lines = [`# ${title}`, '', `Schema version: \`${model.schema_version}\``];
  if (model.schema_version === 1) lines.push(`Process id: \`${model.process.id}\``, `Target engine: \`${model.process.target_engine || 'none'}\``);
  else lines.push(`Definitions id: \`${model.definitions.id}\``, `Processes: ${scopes.length}`);
  lines.push('');
  if (doc.purpose) lines.push('## Purpose', '', doc.purpose, '');

  lines.push('## Participants and Ownership', '');
  for (const participant of model.participants || []) {
    const processRef = model.schema_version === 2 ? ` -> \`${participant.process_ref}\`` : '';
    lines.push(`- ${participant.name} (\`${participant.id}\`)${processRef}`);
    for (const lane of participant.lanes || []) lines.push(`  - ${lane.name} (\`${lane.id}\`)`);
  }
  if (!(model.participants || []).length) lines.push('- Single process without an explicit pool');

  for (const scope of scopes) {
    lines.push('', `## Flow Summary: ${scope.process.name}`, '');
    for (const flow of scope.flows || []) {
      const from = scope.nodes.find((node) => node.id === flow.from);
      const to = scope.nodes.find((node) => node.id === flow.to);
      const condition = flow.condition?.body ? ` {${flow.condition.body}}` : '';
      lines.push(`- ${from?.name || flow.from} -> ${to?.name || flow.to}${flow.label ? ` [${flow.label}]` : ''}${condition}`);
    }
  }
  if ((model.message_flows || []).length) {
    lines.push('', '## Message Flows', '');
    for (const flow of model.message_flows) lines.push(`- \`${flow.from}\` -> \`${flow.to}\`${flow.label ? ` [${flow.label}]` : ''}`);
  }
  if (doc.assumptions?.length) {
    lines.push('', '## Assumptions', '');
    for (const assumption of doc.assumptions) lines.push(`- ${assumption}`);
  }
  if (doc.migration) {
    lines.push('', '## Migration', '', `- Source schema: v${doc.migration.source_schema_version}`, `- Target schema: v${model.schema_version}`, `- Ownership: ${doc.migration.ownership}`);
  }
  if (advanced.length) {
    lines.push('', '## Advanced BPMN Elements', '');
    for (const node of advanced) {
      const status = (report?.findings || []).some((finding) => finding.code === 'capability.partial' && finding.element === node.id) ? 'partial' : 'supported';
      lines.push(`- \`${node.id}\` (${node.type}, ${status}): ${node.reason || 'used to preserve the authored semantics'}`);
    }
  }
  if (report) {
    lines.push('', '## Validation Summary', '', `- Status: ${report.summary.status}`, `- Preservation: ${report.preservation}`, `- Errors: ${report.summary.errors}`, `- Warnings: ${report.summary.warnings}`, `- Infos: ${report.summary.infos}`);
    const visible = (report.findings || []).filter((finding) => finding.severity !== 'info');
    if (visible.length) {
      lines.push('', '## Validation Findings', '');
      for (const finding of visible) lines.push(`- [${finding.severity}] ${finding.code}: ${finding.message}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function isAdvanced(type) {
  return ['boundaryEvent', 'transaction', 'subProcess', 'callActivity'].includes(type);
}
