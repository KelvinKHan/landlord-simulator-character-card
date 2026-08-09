function freezeRoute(value) {
  return Object.freeze({ ...value, path: Object.freeze(value.path ?? []) });
}

function owned(building) {
  return building && ['总部', '已接管'].includes(building.接管状态);
}

function buildGraph(building) {
  const graph = new Map(Object.keys(building.空间列表 ?? {}).map(id => [id, new Set()]));
  for (const [spaceId, space] of Object.entries(building.空间列表 ?? {})) {
    for (const adjacentId of Object.keys(space.相邻空间 ?? {})) {
      if (!graph.has(adjacentId) || adjacentId === spaceId) continue;
      graph.get(spaceId).add(adjacentId);
      graph.get(adjacentId).add(spaceId);
    }
  }
  return graph;
}

function findPath(graph, from, to) {
  const queue = [[from]];
  const visited = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === to) return path;
    for (const next of graph.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }
  return null;
}

export function planSpatialMove(state, { personId, buildingId, spaceId }) {
  const person = state?.人物列表?.[personId];
  if (!person) return freezeRoute({ ok: false, code: 'PERSON_NOT_FOUND', reason: `人物不存在：${personId}`, path: [] });
  const destinationBuilding = state.建筑列表?.[buildingId];
  if (!destinationBuilding) return freezeRoute({ ok: false, code: 'BUILDING_NOT_FOUND', reason: `目标建筑不存在：${buildingId}`, path: [] });
  if (!owned(destinationBuilding)) return freezeRoute({ ok: false, code: 'BUILDING_NOT_OWNED', reason: `尚未接管「${destinationBuilding.名称}」`, path: [] });
  const destination = destinationBuilding.空间列表?.[spaceId];
  if (!destination) return freezeRoute({ ok: false, code: 'SPACE_NOT_FOUND', reason: `目标空间不存在：${spaceId}`, path: [] });
  const destinationFloor = destinationBuilding.楼层列表?.[destination.楼层ID];
  const effectiveAwareness = Math.min(
    Number(destinationBuilding.感知度 ?? 0),
    Number(destinationFloor?.感知度 ?? 0),
    Number(destination.感知度 ?? 0),
  );
  if (effectiveAwareness <= 0) return freezeRoute({ ok: false, code: 'SPACE_HIDDEN', reason: `目标空间「${destination.名称}」尚未被发现`, path: [] });

  const fromBuildingId = person.所在建筑ID;
  const fromSpaceId = person.所在空间ID;
  const sourceBuilding = state.建筑列表?.[fromBuildingId];
  const source = sourceBuilding?.空间列表?.[fromSpaceId];
  if (!sourceBuilding || !source) return freezeRoute({ ok: false, code: 'SOURCE_UNKNOWN', reason: `${person.姓名}当前所在空间无法确认`, path: [] });
  const base = {
    ok: true,
    personId,
    personName: person.姓名,
    fromBuildingId,
    fromSpaceId,
    fromName: source.名称,
    buildingId,
    spaceId,
    destinationName: destination.名称,
  };
  if (fromBuildingId !== buildingId) {
    return freezeRoute({ ...base, code: 'CROSS_BUILDING', kind: '跨建筑交通', path: [fromSpaceId, spaceId], reason: `从「${sourceBuilding.名称}」前往「${destinationBuilding.名称}」` });
  }
  if (fromSpaceId === spaceId) {
    return freezeRoute({ ...base, code: 'SAME_SPACE', kind: '原地状态更新', path: [spaceId], reason: `仍在「${destination.名称}」` });
  }
  if (source.楼层ID !== destination.楼层ID) {
    return freezeRoute({ ...base, code: 'CROSS_FLOOR', kind: '跨楼层通行', path: [fromSpaceId, spaceId], reason: `从${sourceBuilding.楼层列表[source.楼层ID]?.名称 ?? '当前楼层'}前往${destinationFloor?.名称 ?? '目标楼层'}` });
  }
  const path = findPath(buildGraph(destinationBuilding), fromSpaceId, spaceId);
  if (!path) return freezeRoute({ ...base, ok: false, code: 'ROUTE_UNKNOWN', reason: `「${source.名称}」与「${destination.名称}」之间的通路尚未确认`, path: [] });
  return freezeRoute({ ...base, code: 'CONNECTED', kind: '建筑内移动', path, reason: `经过 ${path.length - 1} 段已知连接` });
}

export function createSpatialRouteService() {
  return Object.freeze({ plan: planSpatialMove });
}
