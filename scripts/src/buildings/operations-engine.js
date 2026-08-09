const facilityScores = Object.freeze({ 良好: 100, 普通: 68, 待修复: 28, 停用: 0 });
const publicWords = ['公共', '客厅', '大厅', '花园', '厨房', '会议', '接待', '共享', '活动'];

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function includesAny(value, words) {
  const source = String(value ?? '');
  return words.some(word => source.includes(word));
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function scoreSpace(id, space, people) {
  const facilities = Object.values(space.设施 ?? {});
  const occupants = Object.keys(space.占用者 ?? {}).filter(personId => people[personId]);
  const completion = clamp(space.装修?.完成度 ?? 0);
  const furnitureCount = Object.keys(space.装修?.家具 ?? {}).length;
  const colorCount = Object.keys(space.装修?.配色 ?? {}).length;
  const facilityHealth = average(facilities.map(item => facilityScores[item.状态] ?? 50), 55);
  const publicSpace = includesAny(`${space.名称} ${space.类型} ${space.用途}`, publicWords);
  const broken = space.状态 === '待修复' ? -24 : space.状态 === '装修中' ? -10 : 0;
  const planned = String(space.用途 ?? '').includes('等待') ? 0 : 14;
  const atmospheric = includesAny(space.装修?.氛围, ['舒适', '温暖', '治愈', '安心', '梦幻']) ? 9 : 4;
  const lighting = includesAny(space.装修?.照明, ['自然', '柔', '暖']) ? 8 : 4;
  const metrics = Object.freeze({
    comfort: clamp(35 + completion * 0.35 + atmospheric + lighting + Math.min(occupants.length * 4, 12) + broken),
    function: clamp(32 + planned + facilityHealth * 0.38 + furnitureCount * 3 + broken),
    vitality: clamp(18 + occupants.length * 23 + (publicSpace ? 13 : 3) + completion * 0.12 + facilities.filter(item => item.状态 === '良好').length * 4),
    appeal: clamp(24 + completion * 0.43 + colorCount * 4 + furnitureCount * 3 + atmospheric),
  });
  const total = Math.round(average(Object.values(metrics)));
  const status = space.状态 === '待修复'
    ? '需照料'
    : total >= 78 ? '高光' : total >= 62 ? '顺畅' : total >= 45 ? '蓄能' : '待点亮';
  const strongest = Object.entries(metrics).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'comfort';
  return Object.freeze({
    id,
    name: space.名称,
    type: space.类型,
    purpose: space.用途,
    floorId: space.楼层ID,
    state: space.状态,
    status,
    total,
    metrics,
    strongest,
    completion,
    facilityHealth: Math.round(facilityHealth),
    facilityCount: facilities.length,
    occupantIds: occupants,
    occupantNames: occupants.map(personId => people[personId].姓名),
    publicSpace,
  });
}

function createScene({ buildingId, kind, space, participants = [], signature, title, tagline, summary, activity, impacts, priority }) {
  const id = `scene_${hash([buildingId, kind, space.id, participants.join(','), signature].join('|'))}`;
  return Object.freeze({
    id,
    kind,
    buildingId,
    spaceId: space.id,
    spaceName: space.name,
    participantIds: Object.freeze([...participants]),
    title,
    tagline,
    summary,
    activity,
    impacts: Object.freeze([...impacts]),
    priority,
  });
}

function compileScenes({ buildingId, building, spaces, people, signature, activatedKeys }) {
  const scenes = [];
  for (const space of spaces) {
    if (space.completion >= 75 && space.occupantIds.length) {
      const names = space.occupantNames.join('、');
      scenes.push(createScene({
        buildingId, kind: 'room-resonance', space, participants: space.occupantIds, signature,
        title: `${space.name}·第一次真正被使用`,
        tagline: '装修与人物在同一空间发生共鸣',
        summary: `${names}开始按照自己的方式使用完成改造的${space.name}，空间不再只是布景。`,
        activity: `正在体验${space.name}的新装修`, impacts: ['人物状态同步', '四频道可预览', '装修价值显现'], priority: 100 + space.total,
      }));
    }
  }

  const residents = Object.entries(people).filter(([, person]) => person.所在建筑ID === buildingId);
  const origins = new Set(residents.map(([, person]) => person.来源世界));
  if (origins.size >= 2 && spaces.length) {
    const stage = [...spaces].sort((left, right) => Number(right.publicSpace) - Number(left.publicSpace) || right.metrics.vitality - left.metrics.vitality || left.id.localeCompare(right.id))[0];
    const participants = residents.slice(0, 3).map(([id]) => id);
    scenes.push(createScene({
      buildingId, kind: 'world-convergence', space: stage, participants, signature,
      title: `${stage.name}·世界规则交汇`,
      tagline: `${origins.size} 种世界观第一次共享同一处日常`,
      summary: `${participants.map(id => people[id].姓名).join('、')}在${stage.name}相遇，各自习以为常的规则开始碰撞。`,
      activity: `正在${stage.name}交换各自世界的生活方式`, impacts: ['跨世界碰撞', '关系素材', '正文舞台'], priority: 190,
    }));
  }

  for (const space of spaces) {
    if (space.completion >= 75 && !space.occupantIds.length) {
      scenes.push(createScene({
        buildingId, kind: 'space-debut', space, signature,
        title: `${space.name}·开放亮相`,
        tagline: '把已经完成的装修变成一场真实活动',
        summary: `${building.名称}准备第一次正式开放${space.name}，等待人物为它留下记忆。`,
        activity: `准备参加${space.name}开放活动`, impacts: ['空间热度', '招募落点', '新闻素材'], priority: 80 + space.metrics.appeal,
      }));
    }
    if (space.facilityCount && space.facilityHealth >= 80) {
      scenes.push(createScene({
        buildingId, kind: 'facility-showcase', space, participants: space.occupantIds, signature,
        title: `${space.name}·设施高光时刻`,
        tagline: '现有基础设施开始主动服务建筑生活',
        summary: `${space.name}的设施状态很好，足以承载一次不需要额外准备的特色体验。`,
        activity: `正在使用${space.name}的特色设施`, impacts: ['设施利用', '生活细节', '低成本活动'], priority: 55 + space.metrics.function,
      }));
    }
  }

  if (!scenes.length && spaces.length) {
    const stage = [...spaces].sort((left, right) => right.total - left.total || left.id.localeCompare(right.id))[0];
    scenes.push(createScene({
      buildingId, kind: 'daily-spotlight', space: stage, participants: stage.occupantIds, signature,
      title: `${stage.name}·今日聚光`, tagline: '从现有建筑状态里找出一处可以立刻玩的舞台',
      summary: `${stage.name}成为今天最适合发生故事的地方。`, activity: `在${stage.name}享受今天的建筑生活`,
      impacts: ['日常舞台', '正文联动', '建筑记忆'], priority: 30 + stage.total,
    }));
  }

  return scenes
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
    .slice(0, 4)
    .map(scene => Object.freeze({ ...scene, activated: activatedKeys.has(scene.id) }));
}

export function compileBuildingOperations(state, buildingId) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const people = state.人物列表 ?? {};
  const spaces = Object.entries(building.空间列表 ?? {})
    .filter(([, space]) => Number(space.感知度 ?? 0) > 0)
    .map(([id, space]) => scoreSpace(id, space, people))
    .sort((left, right) => right.total - left.total || left.id.localeCompare(right.id));
  const metrics = Object.freeze({
    comfort: Math.round(average(spaces.map(space => space.metrics.comfort))),
    function: Math.round(average(spaces.map(space => space.metrics.function))),
    vitality: Math.round(average(spaces.map(space => space.metrics.vitality))),
    appeal: Math.round(average(spaces.map(space => space.metrics.appeal))),
  });
  const residentIds = Object.entries(people).filter(([, person]) => person.所在建筑ID === buildingId).map(([id]) => id).sort();
  const origins = new Set(residentIds.map(id => people[id].来源世界));
  const signature = hash(JSON.stringify({
    spaces: spaces.map(space => [space.id, space.state, space.completion, space.facilityHealth, space.occupantIds]),
    residentIds,
  }));
  const synergies = [
    spaces.some(space => space.completion >= 75 && space.occupantIds.length) && { id: 'lived-design', title: '人屋共鸣', description: '已装修空间正在被人物真实使用。', level: '已激活' },
    spaces.some(space => space.facilityHealth >= 80 && space.completion >= 50) && { id: 'facility-design', title: '设施 × 装修', description: '良好设施和空间风格开始互相加成。', level: '已激活' },
    origins.size >= 2 && { id: 'world-collision', title: '世界碰撞', description: `${origins.size} 种来源世界已经进入同一栋建筑。`, level: '稀有' },
    spaces.filter(space => space.publicSpace).some(space => space.occupantIds.length >= 2) && { id: 'social-gravity', title: '社交引力', description: '公共空间正在自然聚集多位人物。', level: '活跃' },
  ].filter(Boolean);
  const activatedKeys = new Set(Object.values(state.事件列表 ?? {}).map(event => event.场景键).filter(Boolean));
  const scenes = compileScenes({ buildingId, building, spaces, people, signature, activatedKeys });
  const total = Math.round(average(Object.values(metrics)));
  return Object.freeze({
    buildingId,
    buildingName: building.名称,
    signature: `pulse_${signature}`,
    total,
    state: total >= 75 ? '高光运行' : total >= 58 ? '稳定生长' : total >= 42 ? '正在蓄能' : '等待点亮',
    metrics,
    spaces: Object.freeze(spaces),
    synergies: Object.freeze(synergies),
    scenes: Object.freeze(scenes),
    residentCount: residentIds.length,
    originCount: origins.size,
  });
}

export function createBuildingOperationsService() {
  return Object.freeze({ compile: compileBuildingOperations });
}
