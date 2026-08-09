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

export function compileRelationshipSparks(state, buildingId) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const operations = compileBuildingOperations(state, buildingId);
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
  return Object.freeze({
    buildingId,
    buildingName: building.名称,
    sparks: Object.freeze(sparks.sort((left, right) => Number(left.recorded) - Number(right.recorded) || right.score - left.score || left.id.localeCompare(right.id))),
  });
}

export function createRelationshipService() {
  return Object.freeze({ compile: compileRelationshipSparks });
}
