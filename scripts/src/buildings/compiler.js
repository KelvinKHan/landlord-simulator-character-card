const sizeWeight = Object.freeze({ 微型: 1, 小型: 2, 中型: 3, 大型: 5, 超大型: 8 });

function byOrderDescending(left, right) {
  return right.order - left.order || left.name.localeCompare(right.name, 'zh-CN');
}

function visible(value) {
  return Number(value?.感知度 ?? 100) > 0;
}

export function compileBuilding(buildingId, building, people = {}) {
  if (!building || typeof building !== 'object') throw new TypeError(`建筑不存在：${buildingId}`);

  const floors = Object.entries(building.楼层列表 ?? {})
    .filter(([, floor]) => visible(floor))
    .map(([id, floor]) => ({
      id,
      name: floor.名称,
      order: Number(floor.顺序 ?? 0),
      description: floor.描述,
      awareness: Number(floor.感知度 ?? 100),
      spaces: [],
    }))
    .sort(byOrderDescending);
  const floorMap = new Map(floors.map(floor => [floor.id, floor]));

  for (const [id, space] of Object.entries(building.空间列表 ?? {})) {
    if (!visible(space)) continue;
    const floor = floorMap.get(space.楼层ID);
    if (!floor) continue;
    const occupants = Object.keys(space.占用者 ?? {}).map(personId => ({
      id: personId,
      name: people[personId]?.姓名 ?? personId,
      role: space.占用者[personId],
      color: people[personId]?.视觉身份?.主色 ?? '#FF9EAA',
    }));
    floor.spaces.push({
      id,
      name: space.名称,
      type: space.类型,
      size: space.尺寸,
      weight: sizeWeight[space.尺寸] ?? sizeWeight.中型,
      status: space.状态,
      purpose: space.用途,
      description: space.描述,
      awareness: Number(space.感知度 ?? 100),
      occupants,
      facilityCount: Object.keys(space.设施 ?? {}).length,
      renovation: space.装修 ?? {},
    });
  }

  for (const floor of floors) {
    floor.spaces.sort((left, right) => right.weight - left.weight || left.name.localeCompare(right.name, 'zh-CN'));
  }

  const visibleSpaces = floors.flatMap(floor => floor.spaces);
  const occupiedSpaces = visibleSpaces.filter(space => space.occupants.length > 0).length;
  const emptySpaces = visibleSpaces.filter(space => space.status === '空置').length;

  return {
    id: buildingId,
    name: building.名称,
    type: building.类型,
    worldview: building.世界观,
    description: building.简介,
    status: building.接管状态,
    isHeadquarters: Boolean(building.是否总部),
    awareness: Number(building.感知度 ?? 0),
    theme: building.主题 ?? {},
    summary: building.经营摘要 ?? {},
    metrics: {
      floors: floors.length,
      spaces: visibleSpaces.length,
      occupiedSpaces,
      emptySpaces,
      people: new Set(visibleSpaces.flatMap(space => space.occupants.map(person => person.id))).size,
    },
    floors,
  };
}

export function compilePortfolio(state) {
  const buildings = Object.entries(state.建筑列表 ?? {}).map(([id, building]) =>
    compileBuilding(id, building, state.人物列表 ?? {}),
  );
  return {
    currentBuildingId: state.当前建筑ID,
    headquarters: buildings.find(building => building.isHeadquarters) ?? null,
    owned: buildings.filter(building => ['总部', '已接管'].includes(building.status)),
    available: buildings.filter(building => building.status === '可接管'),
    hidden: buildings.filter(building => building.status === '未发现'),
    buildings,
  };
}
