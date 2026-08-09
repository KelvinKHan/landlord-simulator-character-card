import { compileBuildingOperations } from '../buildings/operations-engine.js';

function hash(value) {
  let result = 5381;
  for (const character of String(value)) result = Math.imul(result, 33) ^ character.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function includesAny(value, words) {
  const source = String(value ?? '');
  return words.some(word => source.includes(word));
}

function destinationAffinity(person, space) {
  let score = space.total * 0.55 + space.metrics.appeal * 0.2 + space.metrics.comfort * 0.15 + space.metrics.vitality * 0.1;
  const reasons = [`${space.name}当前处于「${space.status}」状态`];
  if (includesAny(person.职业, ['摄影', '艺术', '设计', '作家', '记者'])) {
    score += space.metrics.appeal * 0.12;
    reasons.push(`${person.职业}会被这里的空间表现力吸引`);
  }
  if (includesAny(person.职业, ['医生', '护士', '治疗', '疗愈', '心理'])) {
    score += (space.metrics.comfort + space.metrics.function) * 0.07;
    reasons.push(`${person.职业}会本能地检查舒适与功能细节`);
  }
  if (includesAny(`${person.职业} ${person.性格}`, ['灵植', '园艺', '植物', '自然']) && includesAny(`${space.name} ${space.purpose}`, ['花园', '植物', '自然', '绿'])) {
    score += 18;
    reasons.push('人物与这个空间的自然属性形成职业共鸣');
  }
  if (includesAny(`${person.性格} ${person.内心}`, ['好奇', '开朗', '热情']) && space.publicSpace) {
    score += 9;
    reasons.push('好奇心让人物愿意主动走进公共生活');
  }
  if (includesAny(person.性格, ['安静', '谨慎', '内向']) && !space.publicSpace) {
    score += 8;
    reasons.push('相对安静的空间更适合人物此刻的节奏');
  }
  return { score: Math.round(score), reasons };
}

function activityFor(person, destination) {
  if (includesAny(person.职业, ['摄影'])) return `采集${destination.name}的光影与生活样本`;
  if (includesAny(person.职业, ['灵植', '园艺', '植物'])) return `观察${destination.name}里适合生长的角落`;
  if (includesAny(person.职业, ['医生', '护士', '治疗', '疗愈'])) return `检查${destination.name}是否让人真正放松`;
  if (includesAny(person.职业, ['作家', '记者'])) return `记录${destination.name}正在发生的生活细节`;
  return `体验${destination.name}与自己世界完全不同的日常`;
}

export function compileTenantAutonomy(state, buildingId) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const operations = compileBuildingOperations(state, buildingId);
  const proposals = [];
  for (const [personId, person] of Object.entries(state.人物列表 ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    if (person.所在建筑ID !== buildingId) continue;
    const candidates = operations.spaces
      .filter(space => space.id !== person.所在空间ID)
      .map(space => ({ space, ...destinationAffinity(person, space) }))
      .sort((left, right) => right.score - left.score || left.space.id.localeCompare(right.space.id));
    const chosen = candidates[0];
    if (!chosen) continue;
    const source = building.空间列表?.[person.所在空间ID];
    const activity = activityFor(person, chosen.space);
    const id = `autonomy_${hash([buildingId, personId, person.所在空间ID, chosen.space.id, operations.signature].join('|'))}`;
    proposals.push(Object.freeze({
      id,
      personId,
      person: Object.freeze({ name: person.姓名, origin: person.来源世界, profession: person.职业, color: person.视觉身份?.主色 ?? '#FF9EAA' }),
      buildingId,
      buildingName: building.名称,
      source: Object.freeze({ id: person.所在空间ID, name: source?.名称 ?? '未知空间' }),
      destination: Object.freeze({ id: chosen.space.id, name: chosen.space.name, status: chosen.space.status, score: chosen.score }),
      activity,
      title: `${person.姓名}想去${chosen.space.name}`,
      summary: `${person.姓名}想暂时离开${source?.名称 ?? '当前位置'}，去${chosen.space.name}${activity}。这是一段生活行动，不是永久搬家。`,
      reasons: Object.freeze(chosen.reasons.slice(0, 3)),
      expectedFrom: Object.freeze({ buildingId, spaceId: person.所在空间ID }),
    }));
  }
  const signature = `autonomy_${hash(JSON.stringify(proposals.map(item => [item.id, item.destination.id])))}`;
  return Object.freeze({ buildingId, buildingName: building.名称, signature, proposals: Object.freeze(proposals) });
}

export function createTenantAutonomyService() {
  return Object.freeze({ compile: compileTenantAutonomy });
}
