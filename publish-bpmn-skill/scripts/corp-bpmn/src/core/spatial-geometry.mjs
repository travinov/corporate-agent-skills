const EPSILON = 0.75;

export function finiteBounds(value) {
  if (!value) return null;
  const bounds = Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Number(value[key])])) ;
  return Object.values(bounds).every(Number.isFinite) && bounds.width > 0 && bounds.height > 0 ? bounds : null;
}

export function centerOf(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function unionBounds(items = []) {
  const valid = items.map(finiteBounds).filter(Boolean);
  if (!valid.length) return null;
  const left = Math.min(...valid.map((item) => item.x));
  const top = Math.min(...valid.map((item) => item.y));
  const right = Math.max(...valid.map((item) => item.x + item.width));
  const bottom = Math.max(...valid.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function containsBounds(outer, inner, epsilon = EPSILON) {
  return inner.x >= outer.x - epsilon && inner.y >= outer.y - epsilon
    && inner.x + inner.width <= outer.x + outer.width + epsilon
    && inner.y + inner.height <= outer.y + outer.height + epsilon;
}

export function boundsOverlap(a, b, epsilon = EPSILON) {
  return a.x < b.x + b.width - epsilon && b.x < a.x + a.width - epsilon
    && a.y < b.y + b.height - epsilon && b.y < a.y + a.height - epsilon;
}

export function boundaryAnchor(source, target) {
  const from = centerOf(source);
  const to = centerOf(target);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      source: { x: dx >= 0 ? source.x + source.width : source.x, y: from.y },
      target: { x: dx >= 0 ? target.x : target.x + target.width, y: to.y }
    };
  }
  return {
    source: { x: from.x, y: dy >= 0 ? source.y + source.height : source.y },
    target: { x: to.x, y: dy >= 0 ? target.y : target.y + target.height }
  };
}

export function boundaryAnchorCandidates(source, target) {
  const dominant = boundaryAnchor(source, target);
  const sides = (bounds) => {
    const center = centerOf(bounds);
    return [
      { x: bounds.x, y: center.y },
      { x: bounds.x + bounds.width, y: center.y },
      { x: center.x, y: bounds.y },
      { x: center.x, y: bounds.y + bounds.height }
    ];
  };
  const result = [dominant];
  for (const sourcePoint of sides(source)) for (const targetPoint of sides(target)) result.push({ source: sourcePoint, target: targetPoint });
  const seen = new Set();
  return result.filter((item) => {
    const key = `${item.source.x},${item.source.y}|${item.target.x},${item.target.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pointOnBoundary(point, bounds, epsilon = EPSILON) {
  if (!point || !bounds || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return false;
  const x = Number(point.x); const y = Number(point.y);
  const withinX = x >= bounds.x - epsilon && x <= bounds.x + bounds.width + epsilon;
  const withinY = y >= bounds.y - epsilon && y <= bounds.y + bounds.height + epsilon;
  const onVertical = withinY && (Math.abs(x - bounds.x) <= epsilon || Math.abs(x - (bounds.x + bounds.width)) <= epsilon);
  const onHorizontal = withinX && (Math.abs(y - bounds.y) <= epsilon || Math.abs(y - (bounds.y + bounds.height)) <= epsilon);
  return onVertical || onHorizontal;
}

export function segmentIntersectsInterior(a, b, bounds, epsilon = EPSILON) {
  if (![a?.x, a?.y, b?.x, b?.y].every((value) => Number.isFinite(Number(value)))) return true;
  const left = bounds.x + epsilon; const right = bounds.x + bounds.width - epsilon;
  const top = bounds.y + epsilon; const bottom = bounds.y + bounds.height - epsilon;
  if (a.x === b.x) return a.x > left && a.x < right && Math.max(Math.min(a.y, b.y), top) < Math.min(Math.max(a.y, b.y), bottom);
  if (a.y === b.y) return a.y > top && a.y < bottom && Math.max(Math.min(a.x, b.x), left) < Math.min(Math.max(a.x, b.x), right);
  return liangBarsky(a, b, { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
}

export function routeIntersectsBounds(points, bounds) {
  return points.slice(1).some((point, index) => segmentIntersectsInterior(points[index], point, bounds));
}

export function segmentsCross(a, b, c, d, epsilon = EPSILON) {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denominator) <= epsilon) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
  return t > epsilon / 100 && t < 1 - epsilon / 100 && u > epsilon / 100 && u < 1 - epsilon / 100;
}

export function routesCross(first, second) {
  for (let i = 1; i < first.length; i += 1) for (let j = 1; j < second.length; j += 1) {
    if (segmentsCross(first[i - 1], first[i], second[j - 1], second[j])) return true;
  }
  return false;
}

export function routeSignature(points, reverseEquivalent = true) {
  const encode = (values) => values.map((point) => `${round(point.x)},${round(point.y)}`).join('|');
  const forward = encode(points); const reverse = encode([...points].reverse());
  return reverseEquivalent && reverse < forward ? reverse : forward;
}

export function routeObstacleScore(points, obstacles = [], foreignBounds = [], existingRoutes = []) {
  const obstacleHits = obstacles.filter((bounds) => routeIntersectsBounds(points, bounds)).length;
  const foreignHits = foreignBounds.filter((bounds) => routeIntersectsBounds(points, bounds)).length;
  const duplicate = existingRoutes.some((route) => routeSignature(route) === routeSignature(points)) ? 1 : 0;
  const crossings = existingRoutes.filter((route) => routesCross(route, points)).length;
  const bends = Math.max(0, points.length - 2);
  const length = points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
  return obstacleHits * 1_000_000_000_000 + crossings * 1_000_000_000 + foreignHits * 100_000_000 + duplicate * 10_000_000 + bends * 10 + length;
}

export function orthogonalRoute(sourceBounds, targetBounds, options = {}) {
  const anchors = options.anchors || boundaryAnchor(sourceBounds, targetBounds);
  const { source, target } = anchors;
  const allBounds = [...(options.obstacles || []), ...(options.foreignBounds || []), sourceBounds, targetBounds];
  const union = unionBounds(allBounds) || unionBounds([sourceBounds, targetBounds]);
  const margin = options.margin || 40;
  const candidates = [...(options.preferredRoutes || [])];
  if (source.x === target.x || source.y === target.y) candidates.push([source, target]);
  const middleX = round((source.x + target.x) / 2);
  const middleY = round((source.y + target.y) / 2);
  candidates.push([source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target]);
  candidates.push([source, { x: source.x, y: middleY }, { x: target.x, y: middleY }, target]);
  const corridorBounds = [...(options.obstacles || []), ...(options.foreignBounds || [])];
  const routePoints = (options.existingRoutes || []).flat();
  const xCorridors = uniqueNumbers([
    union.x - margin, union.x + union.width + margin, middleX, source.x, target.x,
    ...corridorBounds.flatMap((bounds) => [bounds.x - margin, bounds.x + bounds.width + margin]),
    ...routePoints.flatMap((point) => [point.x - margin, point.x + margin])
  ]);
  const yCorridors = uniqueNumbers([
    union.y - margin, union.y + union.height + margin, middleY, source.y, target.y,
    ...corridorBounds.flatMap((bounds) => [bounds.y - margin, bounds.y + bounds.height + margin]),
    ...routePoints.flatMap((point) => [point.y - margin, point.y + margin])
  ]);
  for (const x of xCorridors) candidates.push([source, { x, y: source.y }, { x, y: target.y }, target]);
  for (const y of yCorridors) candidates.push([source, { x: source.x, y }, { x: target.x, y }, target]);
  const strategicX = uniqueNumbers([union.x - margin, union.x + union.width + margin, middleX, source.x - margin, source.x + margin, target.x - margin, target.x + margin]);
  const strategicY = uniqueNumbers([union.y - margin, union.y + union.height + margin, middleY, source.y - margin, source.y + margin, target.y - margin, target.y + margin]);
  for (const x of strategicX) for (const y of strategicY) {
    candidates.push([source, { x, y: source.y }, { x, y }, { x: target.x, y }, target]);
    candidates.push([source, { x: source.x, y }, { x, y }, { x, y: target.y }, target]);
  }
  const outerX = [union.x - margin, union.x + union.width + margin];
  const outerY = [union.y - margin, union.y + union.height + margin];
  for (const x of outerX) for (const firstY of outerY) for (const secondY of outerY) {
    candidates.push([source, { x: source.x, y: firstY }, { x, y: firstY }, { x, y: secondY }, { x: target.x, y: secondY }, target]);
  }
  const normalized = candidates.map(compactRoute);
  normalized.sort((a, b) => {
    const obstacles = [...(options.obstacles || []), sourceBounds, targetBounds];
    const difference = routeObstacleScore(a, obstacles, options.foreignBounds, options.existingRoutes) - routeObstacleScore(b, obstacles, options.foreignBounds, options.existingRoutes);
    return difference || routeSignature(a, false).localeCompare(routeSignature(b, false));
  });
  const base = normalized[0];
  const signature = routeSignature(base);
  const duplicateIndex = options.signatureCounts?.get(signature) || 0;
  if (options.signatureCounts) options.signatureCounts.set(signature, duplicateIndex + 1);
  return { points: duplicateIndex ? staggerRoute(base, duplicateIndex, options.staggerStep || 14) : base, signature };
}

export function orthogonalRouteAcrossAnchors(sourceBounds, targetBounds, options = {}) {
  const obstacles = [...(options.obstacles || []), sourceBounds, targetBounds];
  const candidates = boundaryAnchorCandidates(sourceBounds, targetBounds).map((anchors, index) => {
    const routed = orthogonalRoute(sourceBounds, targetBounds, { ...options, anchors, signatureCounts: undefined });
    return {
      ...routed,
      index,
      score: routeObstacleScore(routed.points, obstacles, options.foreignBounds, options.existingRoutes)
    };
  });
  candidates.sort((first, second) => first.score - second.score || first.index - second.index || first.signature.localeCompare(second.signature));
  const selected = candidates[0];
  const duplicateIndex = options.signatureCounts?.get(selected.signature) || 0;
  if (options.signatureCounts) options.signatureCounts.set(selected.signature, duplicateIndex + 1);
  return {
    points: duplicateIndex ? staggerRoute(selected.points, duplicateIndex, options.staggerStep || 14) : selected.points,
    signature: selected.signature
  };
}

export function staggerRoute(points, index, step = 14) {
  if (!index) return points.map((point) => ({ ...point }));
  const amount = step * Math.ceil(index / 2) * (index % 2 ? 1 : -1);
  const start = points[0]; const end = points.at(-1);
  if (points.length === 2) {
    if (start.y === end.y) return compactRoute([start, { x: start.x, y: start.y + amount }, { x: end.x, y: end.y + amount }, end]);
    return compactRoute([start, { x: start.x + amount, y: start.y }, { x: end.x + amount, y: end.y }, end]);
  }
  const result = points.map((point) => ({ ...point }));
  const firstSegmentVertical = result[1].x === start.x;
  for (let i = 1; i < result.length - 1; i += 1) {
    if (firstSegmentVertical) result[i].y += amount;
    else result[i].x += amount;
  }
  return compactRoute(result);
}

export function compactRoute(points) {
  const result = [];
  for (const point of points) {
    const normalized = { x: round(point.x), y: round(point.y) };
    if (!result.length || result.at(-1).x !== normalized.x || result.at(-1).y !== normalized.y) result.push(normalized);
  }
  for (let index = result.length - 2; index > 0; index -= 1) {
    const previous = result[index - 1]; const current = result[index]; const next = result[index + 1];
    if ((previous.x === current.x && current.x === next.x) || (previous.y === current.y && current.y === next.y)) result.splice(index, 1);
  }
  return result;
}

function liangBarsky(a, b, bounds) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - bounds.x, bounds.x + bounds.width - a.x, a.y - bounds.y, bounds.y + bounds.height - a.y];
  let low = 0; let high = 1;
  for (let index = 0; index < 4; index += 1) {
    if (p[index] === 0 && q[index] < 0) return false;
    if (p[index] === 0) continue;
    const ratio = q[index] / p[index];
    if (p[index] < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
    if (low > high) return false;
  }
  return high > 0 && low < 1;
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function uniqueNumbers(values) {
  return [...new Set(values.map(round))].sort((first, second) => first - second);
}
