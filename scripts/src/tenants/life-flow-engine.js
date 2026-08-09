import { compileBuildingOperations } from '../buildings/operations-engine.js';
import { cloneLandlordState } from '../model/default-state.js';
import { planSpatialMove } from '../spatial/route-engine.js';
import { compilePortfolioAssignments } from './portfolio-assignment-engine.js';

const phases = Object.freeze([
  { id: 'origin', time: '08:00', label: '当前落点', activity: '从现在的生活状态出发' },
  { id: 'day', time: '12:00', label: '白日主场', activity: '发挥职业、能力与世界特质' },
  { id: 'evening', time: '19:00', label: '晚间碰撞', activity: '进入更有活力的共同生活' },
  { id: 'return', time: '23:30', label: '夜间归处', activity: '回到已确认的当前生活落点' },
]);

function hash(value) {
  let result = 5381;
  for (const character of String(value)) result = Math.imul(result, 33) ^ character.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function candidateKey(candidate) {
  return `${candidate.buildingId}::${candidate.spaceId}`;
}

function compileCandidates(person, operationMaps) {
  const seen = new Set();
  return person.placements.flatMap(placement => placement.spaces.map(space => {
    const key = `${placement.buildingId}::${space.spaceId}`;
    if (seen.has(key)) return null;
    seen.add(key);
    return Object.freeze({
      key,
      buildingId: placement.buildingId,
      buildingName: placement.buildingName,
      buildingType: placement.buildingType,
      color: placement.color,
      spaceId: space.spaceId,
      spaceName: space.spaceName,
      fit: space.fit,
      matchedTags: space.matchedTags,
      operation: operationMaps.get(placement.buildingId)?.get(space.spaceId),
    });
  })).filter(candidate => candidate?.operation);
}

function phaseScore(candidate, phaseId, currentKey, usedKeys) {
  const metrics = candidate.operation.metrics;
  const novelty = candidate.key === currentKey ? -5 : 5;
  const repeat = usedKeys.has(candidate.key) ? -12 : 0;
  if (phaseId === 'day') return Math.round(candidate.fit * 0.42 + metrics.function * 0.38 + metrics.appeal * 0.12 + metrics.vitality * 0.08 + novelty + repeat);
  return Math.round(candidate.fit * 0.34 + metrics.vitality * 0.34 + metrics.comfort * 0.18 + metrics.appeal * 0.14 + (candidate.operation.publicSpace ? 10 : 0) + novelty + repeat);
}

function locateCurrent(person, candidates) {
  const placement = person.placements.find(item => item.buildingId === person.current.buildingId);
  return candidates.find(candidate => candidate.buildingId === person.current.buildingId && candidate.spaceId === person.current.spaceId)
    ?? Object.freeze({
      key: `${person.current.buildingId}::${person.current.spaceId}`,
      buildingId: person.current.buildingId,
      buildingName: person.current.buildingName,
      buildingType: placement?.buildingType ?? '',
      color: placement?.color ?? person.color,
      spaceId: person.current.spaceId,
      spaceName: person.current.spaceName,
      fit: person.current.fit,
      matchedTags: Object.freeze([]),
      operation: null,
    });
}

function setDraftLocation(draft, personId, destination) {
  draft.人物列表[personId].所在建筑ID = destination.buildingId;
  draft.人物列表[personId].所在空间ID = destination.spaceId;
}

function chooseStop(draft, personId, candidates, phaseId, usedKeys) {
  const person = draft.人物列表[personId];
  const currentKey = `${person.所在建筑ID}::${person.所在空间ID}`;
  const ranked = candidates
    .map(candidate => ({ candidate, route: planSpatialMove(draft, { personId, buildingId: candidate.buildingId, spaceId: candidate.spaceId }), score: phaseScore(candidate, phaseId, currentKey, usedKeys) }))
    .filter(item => item.route.ok)
    .sort((left, right) => right.score - left.score || right.candidate.fit - left.candidate.fit || left.candidate.key.localeCompare(right.candidate.key));
  const best = ranked[0] ?? null;
  const fresh = ranked.find(item => !usedKeys.has(item.candidate.key));
  return fresh && fresh.score >= best.score - 22 ? fresh : best;
}

function stopFrom(phase, candidate, score = candidate.fit) {
  return Object.freeze({
    phase: phase.id,
    time: phase.time,
    label: phase.label,
    activity: phase.activity,
    buildingId: candidate.buildingId,
    buildingName: candidate.buildingName,
    buildingType: candidate.buildingType,
    color: candidate.color,
    spaceId: candidate.spaceId,
    spaceName: candidate.spaceName,
    fit: candidate.fit,
    phaseScore: score,
    matchedTags: candidate.matchedTags,
  });
}

function compileResidentFlow(state, person, operationMaps) {
  const candidates = compileCandidates(person, operationMaps);
  const origin = locateCurrent(person, candidates);
  const draft = cloneLandlordState(state);
  const stops = [stopFrom(phases[0], origin)];
  const transitions = [];
  const usedKeys = new Set([candidateKey(origin)]);
  for (const phase of phases.slice(1, -1)) {
    const selected = chooseStop(draft, person.personId, candidates, phase.id, usedKeys);
    if (!selected) continue;
    transitions.push(Object.freeze({
      fromPhase: stops.at(-1).phase,
      toPhase: phase.id,
      kind: selected.route.kind,
      code: selected.route.code,
      path: selected.route.path,
      reason: selected.route.reason,
      crossBuilding: selected.route.code === 'CROSS_BUILDING',
    }));
    stops.push(stopFrom(phase, selected.candidate, selected.score));
    usedKeys.add(selected.candidate.key);
    setDraftLocation(draft, person.personId, selected.candidate);
  }
  const returnRoute = planSpatialMove(draft, { personId: person.personId, buildingId: origin.buildingId, spaceId: origin.spaceId });
  transitions.push(Object.freeze({
    fromPhase: stops.at(-1).phase,
    toPhase: phases.at(-1).id,
    kind: returnRoute.kind,
    code: returnRoute.code,
    path: returnRoute.path,
    reason: returnRoute.reason,
    crossBuilding: returnRoute.code === 'CROSS_BUILDING',
  }));
  stops.push(stopFrom(phases.at(-1), origin));
  const distinctBuildings = new Set(stops.map(stop => stop.buildingId));
  const distinctSpaces = new Set(stops.map(stop => `${stop.buildingId}::${stop.spaceId}`));
  return Object.freeze({
    personId: person.personId,
    name: person.name,
    profession: person.profession,
    origin: person.origin,
    color: person.color,
    stops: Object.freeze(stops),
    transitions: Object.freeze(transitions),
    metrics: Object.freeze({ buildings: distinctBuildings.size, spaces: distinctSpaces.size, crossBuildingTrips: transitions.filter(item => item.crossBuilding).length }),
  });
}

function compileWaves(flows, buildings) {
  return phases.map(phase => {
    const counts = buildings.map(building => {
      const count = flows.filter(flow => flow.stops.find(stop => stop.phase === phase.id)?.buildingId === building.id).length;
      return Object.freeze({ buildingId: building.id, buildingName: building.name, color: building.color, count });
    });
    return Object.freeze({ phase: phase.id, time: phase.time, label: phase.label, counts: Object.freeze(counts), total: counts.reduce((sum, item) => sum + item.count, 0) });
  });
}

export function compileLifeFlows(state) {
  const assignments = compilePortfolioAssignments(state);
  const operationMaps = new Map(assignments.buildings.map(building => [building.id, new Map(compileBuildingOperations(state, building.id).spaces.map(space => [space.id, space]))]));
  const residents = assignments.residents.map(person => compileResidentFlow(state, person, operationMaps));
  const waves = compileWaves(residents, assignments.buildings);
  const visitedBuildings = new Set(residents.flatMap(person => person.stops.map(stop => stop.buildingId)));
  const visitedSpaces = new Set(residents.flatMap(person => person.stops.map(stop => `${stop.buildingId}::${stop.spaceId}`)));
  const crossBuildingTrips = residents.reduce((sum, person) => sum + person.metrics.crossBuildingTrips, 0);
  const busiest = waves.flatMap(wave => wave.counts.map(item => ({ ...item, phase: wave.phase, time: wave.time, label: wave.label }))).sort((left, right) => right.count - left.count || left.time.localeCompare(right.time) || left.buildingId.localeCompare(right.buildingId))[0] ?? null;
  const signatureSource = residents.map(person => `${person.personId}:${person.stops.map(stop => `${stop.phase}-${stop.buildingId}-${stop.spaceId}`).join(',')}`).join('|');
  return Object.freeze({
    signature: `life_flow_${hash(signatureSource)}`,
    phases,
    buildings: assignments.buildings,
    residents: Object.freeze(residents),
    waves: Object.freeze(waves),
    metrics: Object.freeze({ residents: residents.length, visitedBuildings: visitedBuildings.size, visitedSpaces: visitedSpaces.size, crossBuildingTrips }),
    busiest: busiest ? Object.freeze(busiest) : null,
  });
}

export function createLifeFlowService() {
  return Object.freeze({ compile: compileLifeFlows });
}
