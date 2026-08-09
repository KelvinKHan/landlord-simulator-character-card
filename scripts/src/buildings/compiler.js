const sizeWeight = Object.freeze({ 微型: 1, 小型: 2, 中型: 3, 大型: 5, 超大型: 8 });

function byOrderDescending(left, right) {
  return right.order - left.order || left.name.localeCompare(right.name, 'zh-CN');
}

export function awarenessTier(value) {
  const awareness = Math.max(0, Math.min(100, Number(value) || 0));
  if (awareness === 0) return 'hidden';
  if (awareness < 25) return 'outline';
  if (awareness < 60) return 'partial';
  if (awareness < 90) return 'revealed';
  return 'full';
}

function redact(value, tier, kind) {
  if (tier === 'outline') return kind === 'floor' ? '只能确认这里存在一层空间。' : '只能看出大致轮廓，用途与内部仍是未知。';
  if (tier === 'partial') return kind === 'floor' ? `已初步确认：${value}` : `初步观察：${value}`;
  return value;
}

export function compileBuilding(buildingId, building, people = {}) {
  if (!building || typeof building !== 'object') throw new TypeError(`建筑不存在：${buildingId}`);

  const floors = Object.entries(building.楼层列表 ?? {})
    .map(([id, floor]) => {
      const awareness = Math.min(Number(building.感知度 ?? 0), Number(floor.感知度 ?? 100));
      const visibility = awarenessTier(awareness);
      return {
      id,
      name: visibility === 'outline' ? '未确认楼层' : floor.名称,
      order: Number(floor.顺序 ?? 0),
      description: redact(floor.描述, visibility, 'floor'),
      awareness,
      visibility,
      spaces: [],
      };
    })
    .filter(floor => floor.visibility !== 'hidden')
    .sort(byOrderDescending);
  const floorMap = new Map(floors.map(floor => [floor.id, floor]));

  for (const [id, space] of Object.entries(building.空间列表 ?? {})) {
    const floor = floorMap.get(space.楼层ID);
    if (!floor) continue;
    const awareness = Math.min(floor.awareness, Number(space.感知度 ?? 100));
    const visibility = awarenessTier(awareness);
    if (visibility === 'hidden') continue;
    const occupants = ['revealed', 'full'].includes(visibility) ? Object.keys(space.占用者 ?? {}).map(personId => ({
      id: personId,
      name: people[personId]?.姓名 ?? personId,
      role: space.占用者[personId],
      color: people[personId]?.视觉身份?.主色 ?? '#FF9EAA',
    })) : [];
    floor.spaces.push({
      id,
      name: visibility === 'outline' ? '未知空间' : space.名称,
      type: visibility === 'outline' ? '待探索' : space.类型,
      size: space.尺寸,
      weight: sizeWeight[space.尺寸] ?? sizeWeight.中型,
      status: visibility === 'outline' ? '未知' : space.状态,
      purpose: ['outline', 'partial'].includes(visibility) ? '等待进一步探索' : space.用途,
      description: redact(space.描述, visibility, 'space'),
      awareness,
      visibility,
      occupants,
      facilityCount: visibility === 'full' ? Object.keys(space.设施 ?? {}).length : 0,
      renovation: ['revealed', 'full'].includes(visibility) ? (space.装修 ?? {}) : {},
      adjacentSpaceIds: ['revealed', 'full'].includes(visibility) ? Object.keys(space.相邻空间 ?? {}) : [],
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
      partialSpaces: visibleSpaces.filter(space => ['outline', 'partial'].includes(space.visibility)).length,
      fullyKnownSpaces: visibleSpaces.filter(space => space.visibility === 'full').length,
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
