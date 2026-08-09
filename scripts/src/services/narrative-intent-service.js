const movementWords = ['来到', '走进', '进入', '前往', '回到', '搬到', '抵达', '去了', '去往', '出现在', '待在'];

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function buildIndex(state) {
  const people = Object.entries(state.人物列表 ?? {}).map(([id, person]) => ({ id, name: person.姓名, buildingId: person.所在建筑ID, spaceId: person.所在空间ID }));
  const buildings = Object.entries(state.建筑列表 ?? {}).map(([buildingId, building]) => ({
    id: buildingId,
    name: building.名称,
    status: building.接管状态,
    spaces: Object.entries(building.空间列表 ?? {}).map(([spaceId, space]) => ({ id: spaceId, name: space.名称, type: space.类型 })),
  }));
  return { people, buildings };
}

function byLongestName(left, right) {
  return right.name.length - left.name.length || left.id.localeCompare(right.id);
}

function extractActivity(sentence, personName, spaceName) {
  const explicit = sentence.match(/(?:正在|开始|准备|继续|打算)([^，。！？；]{1,40})/u)?.[0];
  if (explicit) return explicit;
  let result = sentence.replaceAll(personName, '').replaceAll(spaceName, '');
  for (const word of movementWords) result = result.replaceAll(word, '');
  result = result.replace(/[“”"'，。！？；、]/gu, '').trim();
  return result ? result.slice(0, 40) : `正在${spaceName}活动`;
}

export function extractNarrativeIntentsLocally(text, state) {
  const source = String(text ?? '').trim();
  if (!source) throw new Error('请先粘贴一段需要解析的剧情文字');
  const index = buildIndex(state);
  const people = [...index.people].sort(byLongestName);
  const spaces = index.buildings.flatMap(building => building.spaces.map(space => ({ ...space, buildingId: building.id, buildingName: building.name }))).sort(byLongestName);
  const intents = [];
  const unresolved = [];
  let lastPerson = null;
  for (const sentence of source.split(/(?<=[。！？；\n])/u).map(item => item.trim()).filter(Boolean)) {
    const person = people.find(item => sentence.includes(item.name)) ?? lastPerson;
    if (people.some(item => sentence.includes(item.name))) lastPerson = person;
    const space = spaces.find(item => sentence.includes(item.name));
    const hasMovement = movementWords.some(word => sentence.includes(word));
    if (person && space && hasMovement) {
      intents.push({ personId: person.id, buildingId: space.buildingId, spaceId: space.id, activity: extractActivity(sentence, person.name, space.name) });
      continue;
    }
    if (hasMovement || space) unresolved.push(sentence.slice(0, 80));
  }
  const unique = new Map(intents.map(intent => [`${intent.personId}|${intent.buildingId}|${intent.spaceId}`, intent]));
  return Object.freeze({ mode: 'local', intents: Object.freeze([...unique.values()].map(item => Object.freeze(item))), unresolved: Object.freeze(unresolved), sourceText: source });
}

export function createNarrativeIntentService({ store, tavern, isAiEnabled = () => false }) {
  if (!store?.getState) throw new TypeError('剧情意图提取需要房东状态服务');

  async function extractWithAi(text) {
    if (!isAiEnabled()) throw new Error('AI 经营模式尚未由玩家启用');
    if (!tavern?.has?.('generateRaw') || typeof tavern.generateStructured !== 'function') throw new Error('酒馆助手结构化生成接口不可用');
    // Zod 合同只在玩家显式发起 AI 提取时加载。本地解析路径因此不依赖
    // 酒馆中的全局 z，也不会因为 AI 能力缺失影响整个经营中枢启动。
    const { NarrativeIntentJsonSchema, NarrativeIntentSchema } = await import('../ai/narrative-intent-contracts.js');
    const state = store.getState();
    const index = buildIndex(state);
    const generated = await tavern.generateStructured({
      schemaName: 'landlord_narrative_spatial_intents',
      schema: NarrativeIntentJsonSchema,
      mode: 'raw',
      should_stream: false,
      max_chat_history: 0,
      ordered_prompts: [
        { role: 'system', content: '你只负责从用户提供的剧情片段提取人物移动意图。只能使用索引里存在的 personId、buildingId、spaceId；不要续写剧情，不要修改变量。没有把握的句子放进 unresolved。' },
        { role: 'user', content: `可用索引：\n${JSON.stringify(index)}\n\n待解析剧情：\n${String(text ?? '')}` },
      ],
    });
    const parsed = NarrativeIntentSchema.parse(generated);
    return Object.freeze({ mode: 'ai', ...clone(parsed), sourceText: String(text ?? '') });
  }

  return Object.freeze({
    capabilities() {
      return Object.freeze({ local: true, ai: Boolean(tavern?.has?.('generateRaw')) });
    },
    async extract(text, { mode = 'local' } = {}) {
      if (mode === 'local') return extractNarrativeIntentsLocally(text, store.getState());
      if (mode === 'ai') return extractWithAi(text);
      throw new Error(`不支持的剧情提取模式：${mode}`);
    },
  });
}
