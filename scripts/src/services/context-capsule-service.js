import { compileBuildingOperations } from '../buildings/operations-engine.js';
import { compileTenantEmbodiment } from '../tenants/embodiment-engine.js';

function escapeXml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function appendWithin(lines, line, maxChars, closingLength) {
  const current = lines.reduce((sum, item) => sum + item.length + 1, 0);
  if (current + line.length + closingLength > maxChars) return false;
  lines.push(line);
  return true;
}

export function compileContextCapsule(state, buildingId, { maxChars = 2400 } = {}) {
  const building = state?.建筑列表?.[buildingId];
  if (!building) throw new Error(`建筑不存在：${buildingId}`);
  const budget = Math.max(800, Math.min(5000, Number(maxChars) || 2400));
  const operations = compileBuildingOperations(state, buildingId);
  const embodiment = compileTenantEmbodiment(state, buildingId);
  const closing = '</landlord_context>';
  const lines = [
    `<landlord_context building="${escapeXml(buildingId)}" version="1">`,
    '以下是《房东模拟器》代码从当前 MVU 编译出的事实，只用于保持下一次正文与经营状态一致。不要替玩家自动确认经营操作。',
    `建筑：${escapeXml(building.名称)}｜${escapeXml(building.类型)}｜${escapeXml(building.世界观)}｜${escapeXml(building.接管状态)}`,
    `运行：${escapeXml(operations.state)} ${operations.total}｜舒适 ${operations.metrics.comfort}｜功能 ${operations.metrics.function}｜活力 ${operations.metrics.vitality}｜吸引 ${operations.metrics.appeal}`,
  ];
  lines.push('空间：');
  for (const space of operations.spaces) {
    const raw = building.空间列表[space.id];
    const occupants = space.occupantNames.length ? space.occupantNames.join('、') : '无人';
    const line = `- [${escapeXml(space.id)}] ${escapeXml(space.name)}：${escapeXml(raw?.用途)}；${escapeXml(space.status)} ${space.total}；在场 ${escapeXml(occupants)}`;
    if (!appendWithin(lines, line, budget, closing.length + 120)) break;
  }
  if (embodiment.residents.length) {
    appendWithin(lines, '人物：', budget, closing.length + 80);
    for (const person of embodiment.residents) {
      const line = `- ${escapeXml(person.name)}（${escapeXml(person.origin)}·${escapeXml(person.profession)}）在${escapeXml(person.spaceName)}；契合 ${person.fit}；${escapeXml(person.reaction)}`;
      if (!appendWithin(lines, line, budget, closing.length + 80)) break;
    }
  }
  const recentEvents = Object.values(state.事件列表 ?? {}).filter(event => event.建筑ID === buildingId).slice(-4);
  if (recentEvents.length) {
    appendWithin(lines, '最近已确认变化：', budget, closing.length + 60);
    for (const event of recentEvents) {
      if (!appendWithin(lines, `- [${escapeXml(event.类型)}] ${escapeXml(event.标题)}：${escapeXml(event.摘要)}`, budget, closing.length + 60)) break;
    }
  }
  appendWithin(lines, '一致性要求：人物只能被视为位于上述真实空间；未知空间与未确认提案不得写成既成事实。', budget, closing.length);
  lines.push(closing);
  const content = lines.join('\n');
  const signature = `capsule_${hash(content)}`;
  return Object.freeze({
    id: signature,
    signature,
    buildingId,
    buildingName: building.名称,
    content,
    chars: content.length,
    estimatedTokens: Math.ceil(content.length / 2.4),
    residentCount: embodiment.residents.length,
    spaceCount: operations.spaces.length,
    eventCount: recentEvents.length,
    maxChars: budget,
  });
}

export function createContextCapsuleService({ store }) {
  if (!store?.getState) throw new TypeError('上下文胶囊需要房东状态服务');
  return Object.freeze({
    compile(buildingId, options) {
      return compileContextCapsule(store.getState(), buildingId, options);
    },
  });
}
