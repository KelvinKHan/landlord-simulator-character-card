export async function extractNarrativeProposals({ text, mode, narrativeIntents, spatialSync }) {
  if (!narrativeIntents || !spatialSync) throw new Error('剧情空间提取服务尚未加载');
  const source = String(text ?? '').trim();
  if (!source) throw new Error('请先粘贴一段需要解析的剧情文字');
  const result = await narrativeIntents.extract(source, { mode });
  if (!result.intents.length) {
    throw new Error(result.unresolved.length ? `没有形成可确认移动：${result.unresolved[0]}` : '没有识别到人物移动');
  }
  spatialSync.propose(result.intents, { source: `narrative-${result.mode}` });
  return Object.freeze({ mode: result.mode, count: result.intents.length, unresolved: result.unresolved.length });
}

export function isOwnedBuilding(building) {
  return building && ['总部', '已接管'].includes(building.status);
}

export function detectDocumentTheme(document) {
  const classes = `${document.documentElement?.className ?? ''} ${document.body?.className ?? ''}`.toLowerCase();
  if (classes.includes('dark')) return 'dark';
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export async function applyRelationshipSpark({ spark, store, recordOperation }) {
  if (!spark || spark.recorded) throw new Error('请选择一条尚未记录的关系火花');
  return recordOperation('relationship', `记录${spark.title}`, () => store.confirmRelationshipSpark(spark));
}
