import { compileBuildingOperations } from '../buildings/operations-engine.js';

const preferenceRules = Object.freeze([
  { id: 'nature', label: '自然与生命感', person: ['植物', '自然', '灵植', '园艺', '治愈', '摄影'], space: ['花园', '植物', '自然', '木', '阳光', '采光', '户外'] },
  { id: 'creation', label: '创作与灵感', person: ['创作', '摄影', '艺术', '设计', '作家', '研究'], space: ['展示', '景观', '工作', '创意', '梦幻', '陈列', '会议'] },
  { id: 'quiet', label: '安静与私密', person: ['安静', '冷静', '谨慎', '独处', '内向', '敏锐'], space: ['安静', '私人', '柔光', '休息', '病房', '房间'] },
  { id: 'social', label: '交流与热闹', person: ['开朗', '外向', '热情', '活泼', '健谈', '好奇'], space: ['公共', '客厅', '大厅', '共享', '聚餐', '活动', '会客'] },
  { id: 'technology', label: '技术与新奇设施', person: ['未来', '科技', '工程', '机械', '医生', '研究'], space: ['设备', '玻璃', '智能', '诊疗', '检查', '网络', '漂浮'] },
  { id: 'fantasy', label: '异世界奇观', person: ['幻想', '魔法', '灵', '异界', '神秘'], space: ['梦幻', '灵光', '超自然', '万界', '漂浮', '神秘'] },
  { id: 'comfort', label: '柔软与安心', person: ['温柔', '松弛', '治愈', '细腻', '谨慎'], space: ['柔软', '舒适', '温暖', '治愈', '沙发', '暖光'] },
  { id: 'order', label: '秩序与功能', person: ['理性', '严谨', '医生', '管理', '秩序', '冷静'], space: ['整洁', '功能', '设备', '诊室', '办公', '厨房', '卫浴'] },
]);

function hash(value) {
  let result = 5381;
  for (const character of String(value)) result = Math.imul(result, 33) ^ character.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function includesAny(source, keywords) {
  const text = String(source ?? '');
  return keywords.some(keyword => text.includes(keyword));
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function personSource(person) {
  return [person.来源世界, person.职业, person.性格, person.身份类型, person.内心].join(' ');
}

function spaceSource(space) {
  return [
    space.名称, space.类型, space.用途, space.描述,
    ...Object.values(space.装修?.配色 ?? {}),
    ...Object.values(space.装修?.材质 ?? {}),
    ...Object.values(space.装修?.家具 ?? {}),
    space.装修?.照明, space.装修?.氛围,
    ...Object.values(space.设施 ?? {}).flatMap(item => [item.名称, item.描述]),
  ].join(' ');
}

function derivePreferences(person) {
  const source = personSource(person);
  const matched = preferenceRules.filter(rule => includesAny(source, rule.person));
  return matched.length ? matched : [preferenceRules.find(rule => rule.id === 'comfort')];
}

function scoreFit(person, space, operationSpace, roommateCount) {
  const preferences = derivePreferences(person);
  const source = spaceSource(space);
  const matchDetails = preferences
    .map(rule => ({ rule, hits: rule.space.filter(keyword => String(source).includes(keyword)).length }))
    .filter(item => item.hits > 0);
  const matches = matchDetails.map(item => item.rule);
  const matchStrength = matchDetails.reduce((sum, item) => sum + Math.min(4, item.hits), 0);
  const social = preferences.some(rule => rule.id === 'social');
  const quiet = preferences.some(rule => rule.id === 'quiet');
  const companyEffect = social ? Math.min(roommateCount * 7, 14) : quiet ? (roommateCount ? -Math.min(roommateCount * 4, 12) : 8) : Math.min(roommateCount * 2, 6);
  const fit = clamp(25 + Number(operationSpace?.total ?? 45) * 0.32 + matchStrength * 5 + companyEffect);
  return Object.freeze({ fit, preferences, matches, matchStrength, roommateCount });
}

function reactionCopy(person, space, result) {
  const matched = result.matches.slice(0, 2).map(item => item.label);
  const preference = result.preferences[0]?.label ?? '舒适与安心';
  const name = person.姓名;
  if (result.fit >= 82) return `${name}明显被这里的${matched.join('、') || preference}打动，已经开始把${space.名称}当成属于自己生活的一部分。`;
  if (result.fit >= 65) return `${name}在${space.名称}里找到了${matched.join('、') || preference}，看起来愿意在这里多停留一会儿。`;
  if (result.fit >= 48) return `${name}正在观察${space.名称}的生活方式；这里已经可用，但还缺少一个真正贴合其偏好的细节。`;
  return `${name}暂时没有和${space.名称}形成共鸣；换一个空间或补一次针对性装修，会更容易看见真实反应。`;
}

function compilePerson(state, buildingId, personId, person, operations) {
  const building = state.建筑列表[buildingId];
  const spaces = building.空间列表 ?? {};
  const currentSpace = spaces[person.所在空间ID];
  if (!currentSpace) return null;
  const operationMap = new Map(operations.spaces.map(space => [space.id, space]));
  const candidates = Object.entries(spaces).map(([spaceId, space]) => {
    const roommates = Object.keys(space.占用者 ?? {}).filter(id => id !== personId && state.人物列表[id]).length;
    const result = scoreFit(person, space, operationMap.get(spaceId), roommates);
    return Object.freeze({
      spaceId,
      spaceName: space.名称,
      fit: result.fit,
      matches: Object.freeze(result.matches.map(item => item.label)),
      current: spaceId === person.所在空间ID,
    });
  }).sort((left, right) => right.fit - left.fit || left.spaceId.localeCompare(right.spaceId));
  const current = candidates.find(item => item.current);
  const currentRoommates = Object.keys(currentSpace.占用者 ?? {}).filter(id => id !== personId && state.人物列表[id]);
  const currentResult = scoreFit(person, currentSpace, operationMap.get(person.所在空间ID), currentRoommates.length);
  const id = `reaction_${hash([personId, buildingId, person.所在空间ID, operations.signature, person.职业, person.性格].join('|'))}`;
  const recorded = person.生活状态?.反应键 === id;
  return Object.freeze({
    id,
    personId,
    name: person.姓名,
    origin: person.来源世界,
    profession: person.职业,
    color: person.视觉身份?.主色 ?? '#FF9EAA',
    buildingId,
    spaceId: person.所在空间ID,
    spaceName: currentSpace.名称,
    expectedLocation: Object.freeze({ buildingId, spaceId: person.所在空间ID }),
    fit: currentResult.fit,
    state: currentResult.fit >= 82 ? '产生归属感' : currentResult.fit >= 65 ? '自在融入' : currentResult.fit >= 48 ? '正在适应' : '等待共鸣',
    reaction: reactionCopy(person, currentSpace, currentResult),
    preferenceTags: Object.freeze(currentResult.preferences.map(item => item.label)),
    matchedTags: Object.freeze(currentResult.matches.map(item => item.label)),
    roommateIds: Object.freeze(currentRoommates),
    alternatives: Object.freeze(candidates.filter(item => !item.current && item.fit > current.fit).slice(0, 3).map(item => Object.freeze({ ...item, delta: item.fit - current.fit }))),
    recorded,
  });
}

export function compileTenantEmbodiment(state, buildingId) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const operations = compileBuildingOperations(state, buildingId);
  const residents = Object.entries(state.人物列表 ?? {})
    .filter(([, person]) => person.所在建筑ID === buildingId)
    .map(([personId, person]) => compilePerson(state, buildingId, personId, person, operations))
    .filter(Boolean)
    .sort((left, right) => right.fit - left.fit || left.personId.localeCompare(right.personId));
  const encounters = [];
  for (const [spaceId, space] of Object.entries(building.空间列表 ?? {})) {
    const personIds = Object.keys(space.占用者 ?? {}).filter(id => state.人物列表?.[id]);
    if (personIds.length < 2) continue;
    encounters.push(Object.freeze({
      id: `encounter_${hash(`${buildingId}|${spaceId}|${personIds.sort().join(',')}`)}`,
      spaceId,
      spaceName: space.名称,
      personIds: Object.freeze(personIds),
      names: Object.freeze(personIds.map(id => state.人物列表[id].姓名)),
      title: `${space.名称}里的共同生活`,
      summary: `${personIds.map(id => state.人物列表[id].姓名).join('、')}正在共享同一空间，关系变化拥有了明确发生地点。`,
    }));
  }
  return Object.freeze({ buildingId, buildingName: building.名称, signature: `embodied_${hash(`${operations.signature}|${residents.map(item => item.id).join(',')}`)}`, residents: Object.freeze(residents), encounters: Object.freeze(encounters) });
}

export function createTenantEmbodimentService() {
  return Object.freeze({ compile: compileTenantEmbodiment });
}
