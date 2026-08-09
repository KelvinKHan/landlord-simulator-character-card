const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

function polarPoint(index, count, radius) {
  const angle = -Math.PI / 6 + (Math.PI * 2 * index) / Math.max(1, count);
  return {
    x: Number((50 + Math.cos(angle) * radius).toFixed(2)),
    y: Number((50 + Math.sin(angle) * radius).toFixed(2)),
  };
}

function networkNode(building, point, currentBuildingId) {
  const owned = ['总部', '已接管'].includes(building.status);
  return Object.freeze({
    id: building.id,
    name: building.name,
    type: building.type,
    status: building.status,
    color: building.theme?.主色 ?? '#FF9EAA',
    x: point.x,
    y: point.y,
    owned,
    current: building.id === currentBuildingId,
    headquarters: building.isHeadquarters,
    activity: clamp(building.summary?.活跃度),
    people: Number(building.metrics?.people ?? 0),
    spaces: Number(building.metrics?.spaces ?? 0),
    awareness: clamp(building.awareness),
    action: owned ? 'open-building' : 'open-takeover',
  });
}

export function compilePortfolioNetwork(buildings = [], currentBuildingId) {
  const visible = buildings.filter(building => building.status !== '未发现');
  const headquarters = visible.find(building => building.isHeadquarters) ?? visible[0] ?? null;
  const satellites = visible.filter(building => building.id !== headquarters?.id);
  const nodes = visible.map(building => networkNode(
    building,
    building.id === headquarters?.id ? { x: 50, y: 50 } : polarPoint(
      satellites.findIndex(item => item.id === building.id),
      satellites.length,
      building.status === '可接管' ? 39 : 31,
    ),
    currentBuildingId,
  ));
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const hub = nodeMap.get(headquarters?.id);
  const edges = satellites.map(building => {
    const target = nodeMap.get(building.id);
    const operational = target.owned;
    return Object.freeze({
      id: `${hub.id}::${target.id}`,
      from: hub.id,
      to: target.id,
      fromPoint: Object.freeze({ x: hub.x, y: hub.y }),
      toPoint: Object.freeze({ x: target.x, y: target.y }),
      kind: operational ? '运营交通' : '接管机会',
      status: operational ? 'active' : 'potential',
    });
  });
  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    metrics: Object.freeze({
      owned: nodes.filter(node => node.owned).length,
      opportunities: nodes.filter(node => !node.owned).length,
      activeRoutes: edges.filter(edge => edge.status === 'active').length,
      totalPeople: nodes.filter(node => node.owned).reduce((sum, node) => sum + node.people, 0),
    }),
  });
}
