import { createRenovationVisual } from '../renovation/visual-engine.js';

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function splitNearHalf(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let sum = 0;
  let index = 1;
  let bestDifference = Infinity;
  for (let candidate = 1; candidate < items.length; candidate += 1) {
    sum += items[candidate - 1].weight;
    const difference = Math.abs(total / 2 - sum);
    if (difference < bestDifference) {
      bestDifference = difference;
      index = candidate;
    }
  }
  return [items.slice(0, index), items.slice(index), total];
}

function tile(items, rect, depth = 0) {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], ...rect }];
  const [left, right, total] = splitNearHalf(items);
  const leftWeight = left.reduce((sum, item) => sum + item.weight, 0);
  const ratio = leftWeight / total;
  const vertical = rect.w > rect.h || (rect.w === rect.h && depth % 2 === 0);
  if (vertical) {
    const width = rect.w * ratio;
    return [
      ...tile(left, { x: rect.x, y: rect.y, w: width, h: rect.h }, depth + 1),
      ...tile(right, { x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h }, depth + 1),
    ];
  }
  const height = rect.h * ratio;
  return [
    ...tile(left, { x: rect.x, y: rect.y, w: rect.w, h: height }, depth + 1),
    ...tile(right, { x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height }, depth + 1),
  ];
}

function centerOf(node) {
  return Object.freeze({
    x: round(node.x + node.w / 2),
    y: round(node.y + node.h / 2),
  });
}

function uniqueEdges(nodes) {
  const known = new Map(nodes.map(node => [node.id, node]));
  const edges = new Map();
  for (const node of nodes) {
    for (const targetId of node.adjacentSpaceIds ?? []) {
      if (!known.has(targetId) || targetId === node.id) continue;
      const ids = [node.id, targetId].sort();
      const key = ids.join('::');
      if (!edges.has(key)) {
        const fromNode = known.get(ids[0]);
        const toNode = known.get(ids[1]);
        const fromPoint = centerOf(fromNode);
        const toPoint = centerOf(toNode);
        edges.set(key, Object.freeze({
          id: key,
          from: ids[0],
          to: ids[1],
          fromPoint,
          toPoint,
          distance: round(Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y)),
        }));
      }
    }
  }
  return [...edges.values()];
}

export function createBuildingLayout(building) {
  if (!building || !Array.isArray(building.floors)) throw new TypeError('数字孪生布局需要编译后的建筑');
  const floors = building.floors.map(floor => {
    const source = floor.spaces.map(space => ({
      id: space.id,
      name: space.name,
      type: space.type,
      status: space.status,
      size: space.size,
      visibility: space.visibility,
      awareness: space.awareness,
      purpose: space.purpose,
      description: space.description,
      facilityCount: space.facilityCount,
      renovation: space.renovation,
      visual: createRenovationVisual(space.renovation, { fallbackAccent: building.theme?.主色 }),
      occupants: space.occupants,
      adjacentSpaceIds: space.adjacentSpaceIds,
      weight: Math.max(1, Number(space.weight) || 1),
    }));
    const nodes = tile(source, { x: 0, y: 0, w: 100, h: 100 }).map(node => Object.freeze({
      ...node,
      x: round(node.x), y: round(node.y), w: round(node.w), h: round(node.h),
    }));
    return Object.freeze({
      id: floor.id,
      name: floor.name,
      order: floor.order,
      awareness: floor.awareness,
      visibility: floor.visibility,
      nodes,
      edges: uniqueEdges(nodes),
    });
  });
  return Object.freeze({
    buildingId: building.id,
    name: building.name,
    theme: building.theme,
    floors,
    metrics: Object.freeze({ floors: floors.length, nodes: floors.reduce((sum, floor) => sum + floor.nodes.length, 0), edges: floors.reduce((sum, floor) => sum + floor.edges.length, 0) }),
  });
}

export function createBuildingLayoutService() {
  return Object.freeze({ compile: createBuildingLayout });
}
