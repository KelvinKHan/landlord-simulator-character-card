import { compileBuildingOperations } from '../buildings/operations-engine.js';
import { planSpatialMove } from '../spatial/route-engine.js';
import { compileLifeFlows } from './life-flow-engine.js';
import { evaluateRelationshipPair } from './relationship-engine.js';

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function adjacent(building, leftSpaceId, rightSpaceId) {
  const left = building?.空间列表?.[leftSpaceId];
  const right = building?.空间列表?.[rightSpaceId];
  return Boolean(left?.相邻空间?.[rightSpaceId] || right?.相邻空间?.[leftSpaceId]);
}

function proximity(state, leftStop, rightStop) {
  if (leftStop.buildingId !== rightStop.buildingId) return null;
  if (leftStop.spaceId === rightStop.spaceId) return Object.freeze({ kind: 'same-space', label: '同屋相遇', bonus: 12, reason: `两条生活流线同时落在${leftStop.spaceName}` });
  const building = state.建筑列表[leftStop.buildingId];
  if (adjacent(building, leftStop.spaceId, rightStop.spaceId)) return Object.freeze({ kind: 'adjacent', label: '相邻擦肩', bonus: 4, reason: `${leftStop.spaceName}与${rightStop.spaceName}有已知通路，两人可能在路线上交汇` });
  return Object.freeze({ kind: 'same-building', label: '同栋共振', bonus: -7, reason: `两人在同一时段共用${building.名称}的不同区域` });
}

function collisionLabel(score, differentWorlds) {
  if (score >= 92) return differentWorlds ? '跨世界命运交汇' : '命运交汇';
  if (score >= 80) return differentWorlds ? '异界高能碰撞' : '高能生活碰撞';
  if (score >= 68) return '邻近相遇';
  return '同栋共振';
}

function selectDestination(leftStop, rightStop) {
  return [leftStop, rightStop].sort((left, right) => right.phaseScore - left.phaseScore || right.fit - left.fit || left.spaceId.localeCompare(right.spaceId))[0];
}

function freezeLocations(state, personIds) {
  return Object.freeze(Object.fromEntries(personIds.map(personId => {
    const person = state.人物列表[personId];
    return [personId, Object.freeze({ buildingId: person.所在建筑ID, spaceId: person.所在空间ID })];
  })));
}

function compileCollision(state, flows, phase, leftFlow, rightFlow, operations, recordedKeys) {
  const leftStop = leftFlow.stops.find(stop => stop.phase === phase.id);
  const rightStop = rightFlow.stops.find(stop => stop.phase === phase.id);
  if (!leftStop || !rightStop) return null;
  const proximityResult = proximity(state, leftStop, rightStop);
  if (!proximityResult) return null;
  const destination = selectDestination(leftStop, rightStop);
  const operation = operations.get(destination.buildingId)?.get(destination.spaceId);
  if (!operation) return null;
  const personIds = [leftFlow.personId, rightFlow.personId].sort();
  const routes = personIds.map(personId => planSpatialMove(state, { personId, buildingId: destination.buildingId, spaceId: destination.spaceId }));
  if (routes.some(route => !route.ok)) return null;
  const left = state.人物列表[personIds[0]];
  const right = state.人物列表[personIds[1]];
  const relationship = evaluateRelationshipPair(left, right, operation);
  const existing = Boolean(left.关系?.[personIds[1]] || right.关系?.[personIds[0]]);
  const score = clamp(relationship.score + proximityResult.bonus + (phase.id === 'evening' ? 4 : 0) + (existing ? 4 : 0));
  if (score < 58) return null;
  const differentWorlds = left.来源世界 !== right.来源世界;
  const label = collisionLabel(score, differentWorlds);
  const id = `flow_collision_${hash([flows.signature, phase.id, ...personIds, destination.buildingId, destination.spaceId].join('|'))}`;
  const people = Object.freeze(personIds.map(personId => {
    const person = state.人物列表[personId];
    return Object.freeze({ id: personId, name: person.姓名, origin: person.来源世界, profession: person.职业, color: person.视觉身份?.主色 ?? '#FF9EAA' });
  }));
  const expectedLocations = freezeLocations(state, personIds);
  const title = `${phase.time}｜${people[0].name} × ${people[1].name}的${label}`;
  const summary = `${people[0].name}与${people[1].name}的生活流线在${destination.buildingName}的${destination.spaceName}附近交汇；${relationship.reasons[0]}。`;
  const activities = Object.freeze({
    [personIds[0]]: `正在和${people[1].name}经历${label}`,
    [personIds[1]]: `正在和${people[0].name}经历${label}`,
  });
  const scene = Object.freeze({
    id,
    kind: 'life-flow-collision',
    label,
    title,
    summary,
    relationshipLabel: label,
    buildingId: destination.buildingId,
    buildingName: destination.buildingName,
    destination: Object.freeze({ id: destination.spaceId, name: destination.spaceName, score: operation.total }),
    personIds: Object.freeze(personIds),
    people,
    expectedLocations,
    activities,
    recorded: recordedKeys.has(id),
  });
  return Object.freeze({
    id,
    phase: phase.id,
    time: phase.time,
    phaseLabel: phase.label,
    proximity: proximityResult,
    score,
    label,
    title,
    summary,
    buildingId: destination.buildingId,
    buildingName: destination.buildingName,
    destination: scene.destination,
    personIds: scene.personIds,
    people,
    routes: Object.freeze(routes.map(route => Object.freeze({ personId: route.personId, kind: route.kind, code: route.code, reason: route.reason }))),
    reasons: Object.freeze([proximityResult.reason, ...relationship.reasons].slice(0, 4)),
    recorded: scene.recorded,
    scene,
  });
}

export function compileLifeCollisions(state) {
  const flows = compileLifeFlows(state);
  const operations = new Map(flows.buildings.map(building => [building.id, new Map(compileBuildingOperations(state, building.id).spaces.map(space => [space.id, space]))]));
  const recordedKeys = new Set(Object.values(state.事件列表 ?? {}).map(event => event.场景键).filter(Boolean));
  const collisions = [];
  for (const phase of flows.phases.filter(item => ['day', 'evening'].includes(item.id))) {
    for (let leftIndex = 0; leftIndex < flows.residents.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < flows.residents.length; rightIndex += 1) {
        const collision = compileCollision(state, flows, phase, flows.residents[leftIndex], flows.residents[rightIndex], operations, recordedKeys);
        if (collision) collisions.push(collision);
      }
    }
  }
  collisions.sort((left, right) => Number(left.recorded) - Number(right.recorded) || right.score - left.score || left.id.localeCompare(right.id));
  const buildingIds = new Set(collisions.map(item => item.buildingId));
  return Object.freeze({
    signature: `collision_oracle_${hash(collisions.map(item => `${item.id}:${item.score}:${item.recorded}`).join('|'))}`,
    collisions: Object.freeze(collisions),
    focus: collisions.find(item => !item.recorded) ?? null,
    metrics: Object.freeze({
      candidates: collisions.length,
      exact: collisions.filter(item => item.proximity.kind === 'same-space').length,
      adjacent: collisions.filter(item => item.proximity.kind === 'adjacent').length,
      crossWorld: collisions.filter(item => item.people[0].origin !== item.people[1].origin).length,
      buildings: buildingIds.size,
    }),
  });
}

export function createLifeCollisionService() {
  return Object.freeze({ compile: compileLifeCollisions });
}
