import { compilePortfolio } from '../buildings/compiler.js';
import { compileBuildingOperations } from '../buildings/operations-engine.js';
import { evaluateTenantSpaceFit } from './embodiment-engine.js';

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function roommateCount(state, space, personId) {
  return Object.keys(space?.占用者 ?? {}).filter(id => id !== personId && state.人物列表?.[id]).length;
}

function visibleSpaceIds(building) {
  return new Set(building.floors
    .flatMap(floor => floor.spaces)
    .filter(space => ['revealed', 'full'].includes(space.visibility))
    .map(space => space.id));
}

function evaluatePlacement(state, personId, person, building, operationMap) {
  const rawBuilding = state.建筑列表[building.id];
  const knownIds = visibleSpaceIds(building);
  const spaces = Object.entries(rawBuilding.空间列表 ?? {})
    .filter(([spaceId]) => knownIds.has(spaceId) && operationMap.has(spaceId))
    .map(([spaceId, space]) => {
      const evaluation = evaluateTenantSpaceFit({
        person,
        space,
        operationSpace: operationMap.get(spaceId),
        roommateCount: roommateCount(state, space, personId),
      });
      return Object.freeze({
        spaceId,
        spaceName: space.名称,
        fit: evaluation.fit,
        matchedTags: evaluation.matchedTags,
        currentSpace: building.id === person.所在建筑ID && spaceId === person.所在空间ID,
      });
    })
    .sort((left, right) => right.fit - left.fit || left.spaceId.localeCompare(right.spaceId));
  const best = spaces[0];
  if (!best) return null;
  return Object.freeze({
    buildingId: building.id,
    buildingName: building.name,
    buildingType: building.type,
    color: building.theme?.主色 ?? '#FF9EAA',
    currentBuilding: building.id === person.所在建筑ID,
    spaceId: best.spaceId,
    spaceName: best.spaceName,
    fit: best.fit,
    matchedTags: best.matchedTags,
    currentSpace: best.currentSpace,
    alternatives: Object.freeze(spaces.slice(1, 3)),
  });
}

function verdict(person, current, best) {
  if (best.buildingId === current.buildingId && best.spaceId === current.spaceId) return `${person.姓名}的当前落点已是全版图最佳匹配`;
  if (best.buildingId === current.buildingId) return `${person.姓名}适合留在${current.buildingName}，但${best.spaceName}更合拍`;
  return `${person.姓名}在${best.buildingName}的${best.spaceName}会解锁更高契合`;
}

function compilePersonAssignment(state, personId, person, buildings, operationMaps) {
  const currentBuilding = buildings.find(building => building.id === person.所在建筑ID);
  const currentSpace = state.建筑列表?.[person.所在建筑ID]?.空间列表?.[person.所在空间ID];
  const currentOperation = operationMaps.get(person.所在建筑ID)?.get(person.所在空间ID);
  if (!currentBuilding || !currentSpace || !currentOperation) return null;
  const currentEvaluation = evaluateTenantSpaceFit({
    person,
    space: currentSpace,
    operationSpace: currentOperation,
    roommateCount: roommateCount(state, currentSpace, personId),
  });
  const current = Object.freeze({
    buildingId: currentBuilding.id,
    buildingName: currentBuilding.name,
    spaceId: person.所在空间ID,
    spaceName: currentSpace.名称,
    fit: currentEvaluation.fit,
  });
  const placements = buildings
    .map(building => evaluatePlacement(state, personId, person, building, operationMaps.get(building.id)))
    .filter(Boolean)
    .map(placement => Object.freeze({ ...placement, delta: placement.fit - current.fit }))
    .sort((left, right) => right.fit - left.fit || left.buildingId.localeCompare(right.buildingId));
  const best = placements[0];
  if (!best) return null;
  const crossBuilding = placements
    .filter(placement => !placement.currentBuilding && placement.fit > current.fit)
    .sort((left, right) => right.delta - left.delta || left.buildingId.localeCompare(right.buildingId))[0] ?? null;
  return Object.freeze({
    personId,
    name: person.姓名,
    profession: person.职业,
    origin: person.来源世界,
    color: person.视觉身份?.主色 ?? '#FF9EAA',
    preferenceTags: currentEvaluation.preferenceTags,
    current,
    best,
    placements: Object.freeze(placements),
    crossBuilding,
    verdict: verdict(person, current, best),
  });
}

export function compilePortfolioAssignments(state) {
  const portfolio = compilePortfolio(state);
  const buildings = portfolio.owned;
  const ownedIds = new Set(buildings.map(building => building.id));
  const operationMaps = new Map(buildings.map(building => {
    const operations = compileBuildingOperations(state, building.id);
    return [building.id, new Map(operations.spaces.map(space => [space.id, space]))];
  }));
  const residents = Object.entries(state.人物列表 ?? {})
    .filter(([, person]) => ownedIds.has(person.所在建筑ID))
    .map(([personId, person]) => compilePersonAssignment(state, personId, person, buildings, operationMaps))
    .filter(Boolean)
    .sort((left, right) => (right.crossBuilding?.delta ?? 0) - (left.crossBuilding?.delta ?? 0) || left.personId.localeCompare(right.personId));
  const opportunities = residents
    .filter(person => person.crossBuilding)
    .map(person => Object.freeze({
      personId: person.personId,
      name: person.name,
      color: person.color,
      fromBuilding: person.current.buildingName,
      fromSpace: person.current.spaceName,
      toBuilding: person.crossBuilding.buildingName,
      toSpace: person.crossBuilding.spaceName,
      fit: person.crossBuilding.fit,
      delta: person.crossBuilding.delta,
      matchedTags: person.crossBuilding.matchedTags,
    }))
    .sort((left, right) => right.delta - left.delta || left.personId.localeCompare(right.personId));
  const combinations = residents.reduce((sum, person) => sum + person.placements.length, 0);
  const signatureSource = residents.map(person => `${person.personId}:${person.current.fit}:${person.placements.map(item => `${item.buildingId}-${item.fit}`).join(',')}`).join('|');
  return Object.freeze({
    signature: `assignment_${hash(signatureSource)}`,
    buildings: Object.freeze(buildings.map(building => Object.freeze({ id: building.id, name: building.name, type: building.type, color: building.theme?.主色 ?? '#FF9EAA' }))),
    residents: Object.freeze(residents),
    opportunities: Object.freeze(opportunities),
    metrics: Object.freeze({
      buildings: buildings.length,
      residents: residents.length,
      combinations,
      crossBuildingOpportunities: opportunities.length,
      bestGain: opportunities[0]?.delta ?? 0,
    }),
  });
}

export function createPortfolioAssignmentService() {
  return Object.freeze({ compile: compilePortfolioAssignments });
}
