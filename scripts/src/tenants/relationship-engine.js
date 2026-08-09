import { compileBuildingOperations } from '../buildings/operations-engine.js';

function hash(value) {
  let result = 5381;
  for (const character of String(value)) result = Math.imul(result, 33) ^ character.charCodeAt(0);
  return (result >>> 0).toString(36);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function hasAny(value, words) {
  const source = String(value ?? '');
  return words.some(word => source.includes(word));
}

function scorePair(left, right, space) {
  let score = 42 + Number(space?.metrics?.vitality ?? 40) * 0.2 + Number(space?.metrics?.comfort ?? 50) * 0.12;
  const reasons = [];
  if (left.来源世界 !== right.来源世界) {
    score += 14;
    reasons.push('来自不同世界，彼此的常识本身就是新鲜事');
  } else {
    score += 8;
    reasons.push('共享同一来源世界，交流不需要额外翻译');
  }
  if (left.职业 !== right.职业) {
    score += 7;
    reasons.push(`${left.职业}与${right.职业}会注意完全不同的空间细节`);
  } else {
    score += 10;
    reasons.push(`相同职业让两人很快找到共同语言`);
  }
  const curiousLeft = hasAny(`${left.性格} ${left.内心}`, ['好奇', '开朗', '敏锐', '热情']);
  const curiousRight = hasAny(`${right.性格} ${right.内心}`, ['好奇', '开朗', '敏锐', '热情']);
  if (curiousLeft || curiousRight) {
    score += 7;
    reasons.push('至少一人愿意主动理解对方的生活方式');
  }
  const quietPair = hasAny(left.性格, ['安静', '冷静', '谨慎']) && hasAny(right.性格, ['安静', '冷静', '谨慎']);
  if (quietPair) {
    score += 5;
    reasons.push('两人都能接受不说话也不尴尬的相处');
  }
  return { score: clamp(score), reasons };
}

function relationshipLabel(score, differentWorlds) {
  if (score >= 88) return differentWorlds ? '跨世界命运共鸣' : '一见如故';
  if (score >= 76) return differentWorlds ? '异界新鲜火花' : '迅速亲近';
  if (score >= 62) return '自然熟悉';
  return '微妙磨合';
}

function compileSparks(state, buildingId, building, operations) {
  const spaceMap = new Map(operations.spaces.map(space => [space.id, space]));
  const recordedKeys = new Set(Object.values(state.事件列表 ?? {}).map(event => event.场景键).filter(Boolean));
  const sparks = [];
  for (const [spaceId, rawSpace] of Object.entries(building.空间列表 ?? {})) {
    const ids = Object.keys(rawSpace.占用者 ?? {}).filter(id => state.人物列表?.[id]).sort();
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const leftId = ids[leftIndex];
        const rightId = ids[rightIndex];
        const left = state.人物列表[leftId];
        const right = state.人物列表[rightId];
        const result = scorePair(left, right, spaceMap.get(spaceId));
        const label = relationshipLabel(result.score, left.来源世界 !== right.来源世界);
        const id = `spark_${hash([buildingId, spaceId, leftId, rightId, operations.signature].join('|'))}`;
        sparks.push(Object.freeze({
          id,
          buildingId,
          spaceId,
          spaceName: rawSpace.名称,
          personIds: Object.freeze([leftId, rightId]),
          people: Object.freeze([
            Object.freeze({ id: leftId, name: left.姓名, origin: left.来源世界, profession: left.职业, color: left.视觉身份?.主色 ?? '#FF9EAA' }),
            Object.freeze({ id: rightId, name: right.姓名, origin: right.来源世界, profession: right.职业, color: right.视觉身份?.主色 ?? '#55B7A5' }),
          ]),
          score: result.score,
          label,
          title: `${left.姓名} × ${right.姓名}｜${label}`,
          summary: `${left.姓名}与${right.姓名}在${rawSpace.名称}共享了一段具体生活；${result.reasons[0]}。`,
          reasons: Object.freeze(result.reasons.slice(0, 3)),
          expectedLocation: Object.freeze({ buildingId, spaceId }),
          recorded: recordedKeys.has(id),
          existing: Object.freeze({ left: left.关系?.[rightId] ?? '', right: right.关系?.[leftId] ?? '' }),
        }));
      }
    }
  }
  return sparks.sort((left, right) => Number(left.recorded) - Number(right.recorded) || right.score - left.score || left.id.localeCompare(right.id));
}

function relationKey(leftId, rightId) {
  return [leftId, rightId].sort().join('|');
}

function compileNetwork(state, buildingId, building, sparks) {
  const residents = Object.entries(state.人物列表 ?? {})
    .filter(([, person]) => person.所在建筑ID === buildingId)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
  const spaceOrder = Object.keys(building.空间列表 ?? {});
  const clusters = [...new Set(residents.map(([, person]) => person.所在空间ID))]
    .sort((left, right) => spaceOrder.indexOf(left) - spaceOrder.indexOf(right) || left.localeCompare(right));
  const nodePositions = new Map();
  const clusterModels = clusters.map((spaceId, clusterIndex) => {
    const memberIds = residents.filter(([, person]) => person.所在空间ID === spaceId).map(([personId]) => personId);
    const angle = -Math.PI / 2 + (Math.PI * 2 * clusterIndex) / Math.max(1, clusters.length);
    const anchor = clusters.length === 1
      ? { x: 360, y: 160 }
      : { x: 360 + Math.cos(angle) * 230, y: 160 + Math.sin(angle) * 92 };
    const radius = memberIds.length <= 1 ? 0 : Math.min(48, 22 + memberIds.length * 4);
    memberIds.forEach((personId, memberIndex) => {
      const memberAngle = -Math.PI / 2 + (Math.PI * 2 * memberIndex) / Math.max(1, memberIds.length);
      nodePositions.set(personId, {
        x: Math.round(Math.max(42, Math.min(678, anchor.x + Math.cos(memberAngle) * radius))),
        y: Math.round(Math.max(48, Math.min(272, anchor.y + Math.sin(memberAngle) * radius))),
      });
    });
    return Object.freeze({
      id: spaceId,
      name: building.空间列表?.[spaceId]?.名称 ?? '未知空间',
      x: Math.round(anchor.x),
      y: Math.round(anchor.y),
      count: memberIds.length,
    });
  });
  const residentMap = new Map(residents);
  const confirmedPairs = new Set();
  const edges = [];
  for (const [leftId, left] of residents) {
    for (const [rightId, label] of Object.entries(left.关系 ?? {})) {
      if (!residentMap.has(rightId) || !label) continue;
      const pairKey = relationKey(leftId, rightId);
      if (confirmedPairs.has(pairKey)) continue;
      confirmedPairs.add(pairKey);
      const right = residentMap.get(rightId);
      edges.push(Object.freeze({
        id: `relation_${hash(`${pairKey}|${label}`)}`,
        source: leftId,
        target: rightId,
        type: 'confirmed',
        label: String(label),
        score: 100,
        differentWorlds: left.来源世界 !== right.来源世界,
      }));
    }
  }
  for (const spark of sparks) {
    const pairKey = relationKey(...spark.personIds);
    if (spark.recorded || confirmedPairs.has(pairKey)) continue;
    edges.push(Object.freeze({
      id: spark.id,
      source: spark.personIds[0],
      target: spark.personIds[1],
      type: 'potential',
      label: spark.label,
      score: spark.score,
      spaceName: spark.spaceName,
      differentWorlds: spark.people[0].origin !== spark.people[1].origin,
    }));
  }
  const degrees = new Map(residents.map(([personId]) => [personId, 0]));
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  const nodes = residents.map(([id, person]) => Object.freeze({
    id,
    name: person.姓名,
    origin: person.来源世界,
    profession: person.职业,
    spaceId: person.所在空间ID,
    spaceName: building.空间列表?.[person.所在空间ID]?.名称 ?? '未知空间',
    color: person.视觉身份?.主色 ?? '#FF9EAA',
    degree: degrees.get(id) ?? 0,
    ...(nodePositions.get(id) ?? { x: 360, y: 160 }),
  }));
  const signature = `social_${hash(JSON.stringify({
    nodes: nodes.map(node => [node.id, node.spaceId]),
    edges: edges.map(edge => [edge.source, edge.target, edge.type, edge.label]),
  }))}`;
  return Object.freeze({
    signature,
    width: 720,
    height: 320,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    clusters: Object.freeze(clusterModels),
    metrics: Object.freeze({
      people: nodes.length,
      confirmed: edges.filter(edge => edge.type === 'confirmed').length,
      potential: edges.filter(edge => edge.type === 'potential').length,
      spaces: clusterModels.length,
      crossWorld: edges.filter(edge => edge.differentWorlds).length,
    }),
  });
}

export function compileRelationshipSparks(state, buildingId) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const operations = compileBuildingOperations(state, buildingId);
  const sparks = compileSparks(state, buildingId, building, operations);
  return Object.freeze({
    buildingId,
    buildingName: building.名称,
    sparks: Object.freeze(sparks),
    network: compileNetwork(state, buildingId, building, sparks),
  });
}

export function createRelationshipService() {
  return Object.freeze({ compile: compileRelationshipSparks });
}
