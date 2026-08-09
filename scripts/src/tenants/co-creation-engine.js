import { createRenovationVisual } from '../renovation/visual-engine.js';

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function text(value, fallback) {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function color(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value).toUpperCase() : fallback;
}

function personSnapshot(id, person) {
  return Object.freeze({
    id,
    name: text(person.姓名, '未命名人物'),
    origin: text(person.来源世界, '当前世界'),
    profession: text(person.职业, '生活观察者'),
    personality: text(person.性格, '保持好奇'),
    color: color(person.视觉身份?.主色, '#FF9EAA'),
  });
}

function compileProject(state, sourceEventId, event, recordedKeys) {
  if (event.类型 !== '关系场景' || !event.场景键 || !event.空间ID) return null;
  const personIds = Object.keys(event.参与者 ?? {}).sort();
  if (personIds.length !== 2) return null;
  const building = state.建筑列表?.[event.建筑ID];
  const space = building?.空间列表?.[event.空间ID];
  if (!space || !['总部', '已接管'].includes(building.接管状态)) return null;
  const people = personIds.map(personId => state.人物列表?.[personId]);
  if (people.some(person => !person)) return null;
  if (people.some(person => person.所在建筑ID !== event.建筑ID || person.所在空间ID !== event.空间ID)) return null;

  const id = `co_creation_${hash(event.场景键)}`;
  const snapshots = Object.freeze(personIds.map((personId, index) => personSnapshot(personId, people[index])));
  const differentWorlds = snapshots[0].origin !== snapshots[1].origin;
  return Object.freeze({
    id,
    sourceEventId,
    sourceSceneKey: event.场景键,
    sourceTitle: event.标题,
    buildingId: event.建筑ID,
    buildingName: building.名称,
    spaceId: event.空间ID,
    spaceName: space.名称,
    personIds: Object.freeze(personIds),
    people: snapshots,
    differentWorlds,
    headline: `${snapshots[0].name} × ${snapshots[1].name}想把相遇留在${space.名称}`,
    premise: differentWorlds
      ? `${snapshots[0].origin}与${snapshots[1].origin}不再只是聊天设定，而会共同改变房间的材质、家具和用途。`
      : `两种职业与性格会共同改变${space.名称}，让人物碰撞真正留下可见结果。`,
    expectedRenovationSignature: createRenovationVisual(space.装修, { fallbackAccent: building.主题?.主色 }).signature,
    expectedLocations: Object.freeze(Object.fromEntries(personIds.map(personId => [personId, Object.freeze({
      buildingId: event.建筑ID,
      spaceId: event.空间ID,
    })]))),
    recorded: recordedKeys.has(id),
  });
}

export function compileCoCreationProjects(state, buildingId = null) {
  const recordedKeys = new Set(Object.values(state.事件列表 ?? {}).map(event => event.场景键).filter(Boolean));
  const projects = Object.entries(state.事件列表 ?? {})
    .reverse()
    .map(([eventId, event]) => compileProject(state, eventId, event, recordedKeys))
    .filter(project => project && (!buildingId || project.buildingId === buildingId))
    .sort((left, right) => Number(left.recorded) - Number(right.recorded) || left.id.localeCompare(right.id));
  return Object.freeze({
    signature: `co_creation_center_${hash(projects.map(project => `${project.id}:${project.expectedRenovationSignature}:${project.recorded}`).join('|'))}`,
    projects: Object.freeze(projects),
    focus: projects.find(project => !project.recorded) ?? null,
    metrics: Object.freeze({
      projects: projects.length,
      ready: projects.filter(project => !project.recorded).length,
      crossWorld: projects.filter(project => project.differentWorlds).length,
      people: new Set(projects.flatMap(project => project.personIds)).size,
    }),
  });
}

function basePlan(project, id, name, style, tagline, palette, materials, furniture, lighting, atmosphere, impacts) {
  return Object.freeze({
    id: `${project.id}_${id}`,
    name,
    style,
    tagline,
    palette: Object.freeze(palette),
    materials: Object.freeze(materials),
    furniture: Object.freeze(furniture),
    lighting,
    atmosphere,
    resultDescription: `${project.spaceName}被${project.people[0].name}与${project.people[1].name}共同改造成「${name}」：${tagline}。这里同时回应${project.people[0].profession}与${project.people[1].profession}的生活方式。`,
    impacts: Object.freeze(impacts),
  });
}

export function createLocalCoCreationPlans(project, building = {}) {
  if (!project?.id || project.people?.length !== 2) throw new Error('共创装修项目缺少双人交汇信息');
  const [left, right] = project.people;
  const buildingAccent = color(building.theme?.主色 ?? building.主题?.主色, '#7C6CE7');
  return Object.freeze([
    basePlan(project, 'shared-life', '双世界生活舱', '跨世界生活融合', '把两个人各自熟悉的日常拼成一个可以共同居住的新空间',
      { 主色: left.color, 共创色: right.color, 建筑脉冲: buildingAccent },
      { 基础界面: `${left.origin}的生活纹理`, 交汇层: `${right.origin}的触感材料`, 地面: '温润连续地坪' },
      { left_station: `${left.profession}生活位`, right_station: `${right.profession}生活位`, center: '可重组共用岛台', memory: '双世界交换陈列墙' },
      '会随两人活动切换层次的共生光场', '亲密、自由、处处保留两种世界的痕迹',
      ['人物世界观变成可见陈设', '形成双人长期生活据点', '继续吸收后续剧情细节']),
    basePlan(project, 'profession-lab', '异业共创工坊', '跨职业可变工坊', '让职业能力直接决定空间怎样运作，而不是只做背景设定',
      { 主色: '#F8FAFC', 职业色: left.color, 灵感色: right.color },
      { 工作面: '耐用可书写复合材质', 隔断: '半透明移动界面', 吸音层: '柔性声场织物' },
      { prototype: `${left.profession}原型台`, research: `${right.profession}研究站`, exchange: '跨职业成果交换桌', storage: '可生长模块仓' },
      '高显色工作光与柔和交流光双回路', '高效但不严肃，随人物合作方式不断重组',
      ['职业设定获得实际用途', '解锁共同创作场景', '装修与招募形成正反馈']),
    basePlan(project, 'memory-theatre', '生活回声剧场', '可生长记忆空间', '把已经发生的交汇变成房间会持续记住的生活舞台',
      { 暮色: '#232136', 回声色: right.color, 记忆高光: left.color },
      { 墙面: '可记录光影的记忆涂层', 展示面: '悬浮事件切片', 软装: '多世界纹样织物' },
      { stage: '可切换日常场景的中央平台', archive: '生活事件档案墙', seat: '双人观察座', portal: '下一次共创预留位' },
      '根据建筑记忆缓慢变化的情景光', '有故事感、可回看、每次共同生活都会留下新层次',
      ['事件记忆获得空间载体', '强化人物关系存在感', '为正文与微信提供持续话题']),
  ]);
}

export function createCoCreationService() {
  return Object.freeze({ compile: compileCoCreationProjects, createLocalPlans: createLocalCoCreationPlans });
}
