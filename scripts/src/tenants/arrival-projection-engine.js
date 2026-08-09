import { compileBuildingOperations } from '../buildings/operations-engine.js';
import { createRenovationVisual } from '../renovation/visual-engine.js';
import { compileTenantEmbodiment } from './embodiment-engine.js';
import { compileRelationshipSparks } from './relationship-engine.js';

const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

function candidateRecord(candidate, buildingId, spaceId) {
  return {
    姓名: candidate.name,
    来源世界: candidate.origin,
    身份类型: candidate.role,
    职业: candidate.profession,
    所在建筑ID: buildingId,
    所在空间ID: spaceId,
    外貌: candidate.appearance,
    性格: candidate.personality,
    状态: '入住预演',
    内心: candidate.firstThought,
    感知度: 100,
    视觉身份: clone(candidate.visualIdentity ?? {}),
    关系: {},
  };
}

export function compileArrivalProjection(state, buildingId, spaceId, candidate) {
  const sourceBuilding = state?.建筑列表?.[buildingId];
  const sourceSpace = sourceBuilding?.空间列表?.[spaceId];
  if (!sourceSpace || !candidate?.id || !['总部', '已接管'].includes(sourceBuilding.接管状态) || state.人物列表?.[candidate.id]) return null;

  const before = compileBuildingOperations(state, buildingId);
  const draft = clone(state);
  draft.人物列表 ??= {};
  draft.人物列表[candidate.id] = candidateRecord(candidate, buildingId, spaceId);
  draft.建筑列表[buildingId].空间列表[spaceId].占用者 ??= {};
  draft.建筑列表[buildingId].空间列表[spaceId].占用者[candidate.id] = candidate.role;

  const after = compileBuildingOperations(draft, buildingId);
  const embodiment = compileTenantEmbodiment(draft, buildingId).residents.find(item => item.personId === candidate.id);
  const sparks = compileRelationshipSparks(draft, buildingId).sparks.filter(item => item.personIds.includes(candidate.id));
  const beforeRoom = before.spaces.find(item => item.id === spaceId);
  const afterRoom = after.spaces.find(item => item.id === spaceId);
  const roommateIds = Object.keys(sourceSpace.占用者 ?? {}).filter(id => state.人物列表?.[id]);
  const beforeSynergies = new Set(before.synergies.map(item => item.id));

  return Object.freeze({
    signature: `arrival_${candidate.id}_${spaceId}_${after.signature}`,
    buildingId,
    buildingName: sourceBuilding.名称,
    spaceId,
    spaceName: sourceSpace.名称,
    candidate: Object.freeze({ id: candidate.id, name: candidate.name, origin: candidate.origin, profession: candidate.profession, role: candidate.role, color: candidate.visualIdentity?.主色 ?? '#FF9EAA' }),
    fit: embodiment.fit,
    fitState: embodiment.state,
    reaction: embodiment.reaction,
    preferenceTags: embodiment.preferenceTags,
    matchedTags: embodiment.matchedTags,
    roommates: Object.freeze(roommateIds.map(id => Object.freeze({ id, name: state.人物列表[id].姓名, origin: state.人物列表[id].来源世界, color: state.人物列表[id].视觉身份?.主色 ?? '#55B7A5' }))),
    sparks: Object.freeze(sparks.map(item => Object.freeze({ id: item.id, title: item.title, label: item.label, score: item.score, otherName: item.people.find(person => person.id !== candidate.id)?.name ?? '新邻居' }))),
    pulseDelta: Object.freeze({ total: after.total - before.total, vitality: after.metrics.vitality - before.metrics.vitality, roomTotal: afterRoom.total - beforeRoom.total, roomVitality: afterRoom.metrics.vitality - beforeRoom.metrics.vitality }),
    newSynergies: Object.freeze(after.synergies.filter(item => !beforeSynergies.has(item.id)).map(item => item.title)),
    spaceVisual: createRenovationVisual(sourceSpace.装修, { fallbackAccent: sourceBuilding.主题?.主色 }),
  });
}
