import { compilePortfolio } from './compiler.js';

const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export function applyAcquisitionDirection(building, direction = null) {
  if (!building || building.接管状态 !== '可接管') throw new Error('建筑当前不可接管');
  building.接管状态 = '已接管';
  building.感知度 = 100;
  building.经营摘要 ??= {};
  building.经营摘要.活跃度 = Math.max(50, Number(building.经营摘要.活跃度 ?? 0));
  if (direction) {
    building.名称 = direction.buildingName ?? building.名称;
    building.简介 = direction.description ?? building.简介;
    building.经营摘要.今日亮点 = direction.highlight ?? building.经营摘要.今日亮点;
    building.主题 = { ...(building.主题 ?? {}), ...(direction.theme ?? {}) };
  }
  return building;
}

export function compileAcquisitionProjection(state, buildingId, direction) {
  const source = state?.建筑列表?.[buildingId];
  if (!source || source.接管状态 !== '可接管' || !direction) return null;
  const beforePortfolio = compilePortfolio(state);
  const draft = clone(state);
  applyAcquisitionDirection(draft.建筑列表[buildingId], direction);
  draft.当前建筑ID = buildingId;
  const afterPortfolio = compilePortfolio(draft);
  const before = beforePortfolio.buildings.find(item => item.id === buildingId);
  const after = afterPortfolio.buildings.find(item => item.id === buildingId);
  const beforeNode = beforePortfolio.network.nodes.find(item => item.id === buildingId);
  const afterNode = afterPortfolio.network.nodes.find(item => item.id === buildingId);
  const beforeEdge = beforePortfolio.network.edges.find(item => item.to === buildingId);
  const afterEdge = afterPortfolio.network.edges.find(item => item.to === buildingId);
  const beforeSpaceIds = new Set(before.floors.flatMap(floor => floor.spaces.map(space => space.id)));
  const revealedSpaces = after.floors.flatMap(floor => floor.spaces).filter(space => !beforeSpaceIds.has(space.id)).map(space => space.name);

  return Object.freeze({
    signature: `acquisition_${buildingId}_${direction.id}_${afterNode.status}_${after.metrics.spaces}`,
    buildingId,
    before: Object.freeze({ name: before.name, status: before.status, awareness: before.awareness, color: before.theme?.主色 ?? '#778096', floors: before.metrics.floors, spaces: before.metrics.spaces }),
    after: Object.freeze({ name: after.name, status: after.status, awareness: after.awareness, color: after.theme?.主色 ?? '#FF9EAA', floors: after.metrics.floors, spaces: after.metrics.spaces, description: after.description, highlight: after.summary.今日亮点 }),
    network: Object.freeze({ before: beforeEdge.kind, after: afterEdge.kind, beforeStatus: beforeNode.status, afterStatus: afterNode.status }),
    deltas: Object.freeze({ owned: afterPortfolio.network.metrics.owned - beforePortfolio.network.metrics.owned, activeRoutes: afterPortfolio.network.metrics.activeRoutes - beforePortfolio.network.metrics.activeRoutes, awareness: after.awareness - before.awareness, floors: after.metrics.floors - before.metrics.floors, spaces: after.metrics.spaces - before.metrics.spaces }),
    revealedSpaces: Object.freeze(revealedSpaces),
    opportunities: Object.freeze([...(direction.opportunities ?? [])]),
    tags: Object.freeze([...(direction.tags ?? [])]),
    summary: direction.summary ?? after.description,
  });
}
