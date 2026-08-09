import { createRenovationVisual } from './visual-engine.js';

export function compileRenovationProjection(twin, spaceId, plan, fallbackAccent = '#FF9EAA') {
  const floor = twin?.floors?.find(item => item.nodes.some(node => node.id === spaceId));
  const target = floor?.nodes.find(node => node.id === spaceId);
  if (!floor || !target || !plan) return null;

  const before = target.visual ?? createRenovationVisual(target.renovation, { fallbackAccent });
  const after = createRenovationVisual(plan, { fallbackAccent });
  const nodes = floor.nodes.map(node => Object.freeze({
    ...node,
    projected: node.id === spaceId,
    visual: node.id === spaceId ? after : node.visual,
  }));

  return Object.freeze({
    signature: `${before.signature}::${after.signature}`,
    buildingName: twin.name,
    floorId: floor.id,
    floorName: floor.name,
    targetId: target.id,
    targetName: target.name,
    before,
    after,
    impacts: Object.freeze([...(plan.impacts ?? [])]),
    nodes: Object.freeze(nodes),
    edges: floor.edges,
  });
}
