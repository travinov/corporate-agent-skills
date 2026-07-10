import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { stringify } from 'yaml';
import { writeProcessDocumentation } from '../core/documentation-generator.mjs';

export async function initCommand(dir, options = {}) {
  await mkdir(dir, { recursive: true });
  const id = path.basename(dir).replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() || 'process';
  const version = Number(options.schemaVersion || 1);
  if (![1, 2].includes(version)) {
    const error = new Error(`schema version ${options.schemaVersion} is not supported`);
    error.exitCode = 1;
    throw error;
  }
  const model = version === 2 ? v2Starter(id) : v1Starter(id);
  await writeFile(path.join(dir, 'process.yaml'), stringify(model), 'utf8');
  await writeProcessDocumentation(model, { report: null, outPath: path.join(dir, 'process.md') });
  console.log(`Initialized ${dir} with schema v${version}`);
  return model;
}

function v1Starter(id) {
  return {
    schema_version: 1,
    process: { id, name: titleize(id), executable: false, target_engine: 'none' },
    participants: [{ id: 'main', name: 'Main process', lanes: [{ id: 'owner', name: 'Process Owner' }] }],
    nodes: [
      { id: 'start', type: 'startEvent', name: 'Start', lane: 'owner' },
      { id: 'do-work', type: 'userTask', name: 'Do work', lane: 'owner' },
      { id: 'end', type: 'endEvent', name: 'End', lane: 'owner' }
    ],
    flows: [{ id: 'flow-start-work', from: 'start', to: 'do-work' }, { id: 'flow-work-end', from: 'do-work', to: 'end' }],
    message_flows: [], data: [], artifacts: [], extensions: {},
    documentation: { purpose: 'Starter BPMN process.', assumptions: [] }
  };
}

function v2Starter(id) {
  return {
    schema_version: 2,
    definitions: { id: `${id}_definitions`, name: `${titleize(id)} Collaboration`, target_namespace: 'http://corp.example/bpmn' },
    processes: [
      { id: `${id}_requester`, name: 'Requester Process', executable: false, target_engine: 'none', lanes: [], nodes: [{ id: 'requester-start', type: 'startEvent', name: 'Start request' }, { id: 'send-request', type: 'sendTask', name: 'Send request' }, { id: 'requester-end', type: 'endEvent', name: 'Request sent' }], flows: [{ id: 'requester-flow-1', from: 'requester-start', to: 'send-request' }, { id: 'requester-flow-2', from: 'send-request', to: 'requester-end' }], data: [], artifacts: [], extensions: {} },
      { id: `${id}_provider`, name: 'Provider Process', executable: false, target_engine: 'none', lanes: [], nodes: [{ id: 'provider-start', type: 'startEvent', name: 'Ready' }, { id: 'receive-request', type: 'receiveTask', name: 'Receive request' }, { id: 'provider-end', type: 'endEvent', name: 'Request received' }], flows: [{ id: 'provider-flow-1', from: 'provider-start', to: 'receive-request' }, { id: 'provider-flow-2', from: 'receive-request', to: 'provider-end' }], data: [], artifacts: [], extensions: {} }
    ],
    participants: [{ id: 'requester', name: 'Requester', process_ref: `${id}_requester` }, { id: 'provider', name: 'Provider', process_ref: `${id}_provider` }],
    message_flows: [{ id: 'request-message', from: 'send-request', to: 'receive-request', label: 'Request' }],
    extensions: {}, documentation: { purpose: 'Starter BPMN collaboration.', assumptions: [] }
  };
}

function titleize(id) {
  return id.split(/[-_]+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}
