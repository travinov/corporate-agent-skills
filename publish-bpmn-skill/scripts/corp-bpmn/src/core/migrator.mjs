export function migrateV1ToV2(model) {
  if (model.schema_version !== 1) throw migrationError('migration.source_version', `expected schema version 1, received ${model.schema_version}`);
  const participants = model.participants || [];
  if (participants.length > 1) throw migrationError('migration.ambiguous_process_ownership', 'v1 contains multiple participants without explicit process ownership');
  const processId = model.process.id;
  const participant = participants[0] || { id: uniqueParticipantId(processId, model), name: model.process.name, lanes: [] };
  const lanes = dedupeById([...(participant.lanes || []), ...(model.lanes || [])]);
  const nodes = (model.nodes || []).map(({ participant: ignoredParticipant, ...node }) => node);
  return {
    schema_version: 2,
    definitions: {
      id: `${processId}_definitions`,
      name: model.process.name,
      target_namespace: model.process.targetNamespace || 'http://corp.example/bpmn'
    },
    processes: [{
      id: processId,
      name: model.process.name,
      executable: Boolean(model.process.executable),
      target_engine: model.process.target_engine || 'none',
      lanes,
      nodes,
      flows: structuredClone(model.flows || []),
      data: structuredClone(model.data || []),
      artifacts: structuredClone(model.artifacts || []),
      extensions: {}
    }],
    participants: [{ id: participant.id, name: participant.name, process_ref: processId }],
    message_flows: [],
    extensions: {},
    documentation: {
      ...(model.documentation || {}),
      migration: { source_schema_version: 1, ownership: participants.length ? 'single existing participant' : 'deterministic generated participant' }
    }
  };
}

function uniqueParticipantId(processId, model) {
  const ids = new Set([model.process?.id, ...(model.nodes || []).map((item) => item.id), ...(model.flows || []).map((item) => item.id), ...(model.lanes || []).map((item) => item.id)]);
  let candidate = `participant_${processId}`;
  let suffix = 2;
  while (ids.has(candidate)) candidate = `participant_${processId}_${suffix++}`;
  return candidate;
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id));
}

function migrationError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = 7;
  error.findings = [{ layer: 'migration', severity: 'error', code, message }];
  return error;
}
