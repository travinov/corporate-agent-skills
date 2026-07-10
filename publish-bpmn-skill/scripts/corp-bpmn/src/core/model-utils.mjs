export function resolveSchemaVersion(model = {}) {
  const hasDeclared = Object.prototype.hasOwnProperty.call(model, 'schema_version');
  const declaredVersion = hasDeclared ? model.schema_version : null;
  const resolvedVersion = hasDeclared ? declaredVersion : 1;
  return { declaredVersion, resolvedVersion, implicit: !hasDeclared };
}

export function prepareProcessModel(input = {}) {
  const context = resolveSchemaVersion(input);
  const model = structuredClone(input || {});
  const findings = [];
  if (context.implicit) {
    model.schema_version = 1;
    findings.push({
      layer: 'schema',
      severity: 'warning',
      code: 'schema.version_implicit',
      path: '/schema_version',
      message: 'schema_version is omitted; resolving as v1 for the transition release'
    });
    normalizeLegacyV1(model, findings);
  }
  return { model, context, findings };
}

export function processScopes(model = {}) {
  if (model.schema_version === 2) {
    return (model.processes || []).map((process) => ({
      ...process,
      process,
      lanes: process.lanes || [],
      nodes: process.nodes || [],
      flows: process.flows || [],
      data: process.data || [],
      artifacts: process.artifacts || [],
      extensions: process.extensions || {},
      documentation: process.documentation || {}
    }));
  }
  const participantLanes = (model.participants || []).flatMap((participant) => participant.lanes || []);
  return [{
    ...(model.process || {}),
    process: model.process || {},
    lanes: [...participantLanes, ...(model.lanes || [])],
    nodes: model.nodes || [],
    flows: model.flows || [],
    data: model.data || [],
    artifacts: model.artifacts || [],
    extensions: model.extensions || {},
    documentation: model.documentation || {}
  }];
}

export function allNodes(model = {}) {
  return processScopes(model).flatMap((scope) => scope.nodes);
}

export function allFlows(model = {}) {
  return processScopes(model).flatMap((scope) => scope.flows);
}

export function targetEngines(model = {}) {
  return processScopes(model).map((scope) => ({ processId: scope.process.id, target: scope.process.target_engine || 'none', nodes: scope.nodes }));
}

function normalizeLegacyV1(model, findings) {
  for (const flow of model.flows || []) {
    if (typeof flow.condition === 'string' && flow.condition.trim()) {
      flow.condition = { body: flow.condition };
      findings.push({
        layer: 'schema',
        severity: 'warning',
        code: 'schema.legacy_condition_shorthand',
        path: `/flows/${escapePointer(flow.id || '')}/condition`,
        element: flow.id,
        message: 'legacy string condition was normalized to the v1 condition object'
      });
    }
  }
  const outgoing = new Map();
  for (const flow of model.flows || []) outgoing.set(flow.from, [...(outgoing.get(flow.from) || []), flow]);
  for (const node of model.nodes || []) {
    if (!node.default) continue;
    const byId = (outgoing.get(node.id) || []).find((flow) => flow.id === node.default);
    if (byId) continue;
    const byTarget = (outgoing.get(node.id) || []).filter((flow) => flow.to === node.default);
    if (byTarget.length === 1) {
      const previous = node.default;
      node.default = byTarget[0].id;
      findings.push({
        layer: 'schema',
        severity: 'warning',
        code: 'schema.legacy_default_target',
        path: `/nodes/${escapePointer(node.id || '')}/default`,
        element: node.id,
        message: `legacy default target '${previous}' was normalized to flow '${node.default}'`
      });
    }
  }
}

function escapePointer(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}
