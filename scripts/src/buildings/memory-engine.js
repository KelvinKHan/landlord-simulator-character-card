const eventWeights = Object.freeze({
  关系场景: 5,
  关系火花: 4,
  建筑场景: 4,
  装修完成: 3,
  人物加入: 3,
  人物感受: 2,
  人物移动: 2,
  探索发现: 1,
});

const eventColors = Object.freeze({
  关系场景: '#C4A7E7',
  关系火花: '#C4A7E7',
  建筑场景: '#F3B562',
  装修完成: '#FF9EAA',
  人物加入: '#55B7A5',
  人物感受: '#6B8DC9',
  人物移动: '#6B8DC9',
  探索发现: '#9CCFD8',
});

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function compileEntry(id, event, index, people) {
  return Object.freeze({
    id,
    title: event.标题,
    type: event.类型,
    summary: event.摘要,
    occurredAt: event.发生时间,
    weight: eventWeights[event.类型] ?? 1,
    color: eventColors[event.类型] ?? '#FF9EAA',
    participantNames: Object.keys(event.参与者 ?? {}).map(personId => people[personId]?.姓名).filter(Boolean),
    order: index,
  });
}

export function compileBuildingMemories(state, buildingId) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const people = state.人物列表 ?? {};
  const spaces = new Map(Object.entries(building.空间列表 ?? {}).map(([spaceId, space]) => [spaceId, {
    id: spaceId,
    name: space.名称,
    entries: [],
  }]));
  const unplaced = [];
  Object.entries(state.事件列表 ?? {}).forEach(([eventId, event], index) => {
    if (event.建筑ID !== buildingId) return;
    const entry = compileEntry(eventId, event, index, people);
    const target = spaces.get(event.空间ID);
    if (target) target.entries.push(entry);
    else unplaced.push(entry);
  });
  const spaceModels = [...spaces.values()].map(space => {
    const entries = [...space.entries].sort((left, right) => right.order - left.order || left.id.localeCompare(right.id));
    const typeScores = new Map();
    for (const entry of entries) typeScores.set(entry.type, (typeScores.get(entry.type) ?? 0) + entry.weight);
    const dominantType = [...typeScores.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? '';
    const resonance = entries.length ? Math.min(100, 18 + entries.reduce((sum, entry) => sum + entry.weight, 0) * 11) : 0;
    return Object.freeze({
      id: space.id,
      name: space.name,
      count: entries.length,
      resonance,
      dominantType,
      accent: eventColors[dominantType] ?? '#A7A2C9',
      latest: entries[0] ?? null,
      entries: Object.freeze(entries),
    });
  });
  const totalEvents = spaceModels.reduce((sum, space) => sum + space.count, 0) + unplaced.length;
  const signature = `memory_${hash(JSON.stringify({
    buildingId,
    spaces: spaceModels.map(space => [space.id, space.entries.map(entry => entry.id)]),
    unplaced: unplaced.map(entry => entry.id),
  }))}`;
  return Object.freeze({
    buildingId,
    buildingName: building.名称,
    signature,
    totalEvents,
    activeSpaces: spaceModels.filter(space => space.count > 0).length,
    spaces: Object.freeze(spaceModels),
    unplaced: Object.freeze(unplaced.sort((left, right) => right.order - left.order || left.id.localeCompare(right.id))),
  });
}

export function createBuildingMemoryService() {
  return Object.freeze({ compile: compileBuildingMemories });
}
