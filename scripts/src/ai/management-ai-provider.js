import { ManagementAiJsonSchemas, ManagementAiSchemas } from './management-ai-contracts.js';

const taskInstructions = Object.freeze({
  takeover: '根据建筑类型、现有格局和世界观提出三种差异明显、偏爽文体验的接管方向。保留可立即游玩的基础，不增加繁琐惩罚。',
  renovation: '针对指定空间提出三种可视化差异明显的装修方案。方案必须能改变配色、材质、家具、照明、空间描述和后续人物互动。',
  coCreation: '根据已经确认的双人生活场景提出三种共创装修方案。必须同时体现两人的来源世界、职业、性格和目标房间，让人物碰撞产生可见且可继续游玩的建筑结果。',
  recruitment: '为当前建筑生成三名来自不同世界、能与现有空间和人物产生碰撞的候选人。人物必须适合被安置到当前建筑。',
});

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function abortError() {
  const error = new Error('AI 任务已取消');
  error.name = 'AbortError';
  return error;
}

function compactInput(input) {
  const copy = clone(input);
  // 编译后的建筑对象已经只包含 AI 需要理解的语义数据，不向 AI 发送
  // MVU 快照、运行时对象或界面缓存。
  return copy;
}

export function createManagementAiProvider({ tavern, isEnabled = () => false, logger = console }) {
  if (!tavern || typeof tavern.generateStructured !== 'function') {
    throw new TypeError('经营 AI 提供器需要酒馆助手生成服务');
  }

  return Object.freeze({
    id: 'management-ai',
    // available 只表示宿主是否具备生成能力；玩家授权仍在 run 里单独校验。
    // 否则会出现「尚未启用→按钮不可点→永远无法启用」的循环依赖。
    available: () => tavern.has?.('generateRaw') === true,
    supports: kind => Object.hasOwn(ManagementAiSchemas, kind),

    async run(kind, input, { signal, taskId, attempt }) {
      const contract = ManagementAiSchemas[kind];
      if (!contract) throw new Error(`经营 AI 不支持任务：${kind}`);
      if (!isEnabled()) throw new Error('AI 经营模式尚未由玩家启用');
      if (signal?.aborted) throw abortError();

      const payload = compactInput(input);
      logger.info?.(`[经营AI] ${kind} 任务开始`, { taskId, attempt });
      const generated = await tavern.generateStructured({
        schemaName: `landlord_${kind}_preview`,
        schema: ManagementAiJsonSchemas[kind],
        mode: 'raw',
        should_stream: false,
        max_chat_history: 0,
        ordered_prompts: [
          {
            role: 'system',
            content: [
              '你是《房东模拟器》的经营内容生成器。',
              taskInstructions[kind],
              '只生成预览方案，不修改变量，不输出 JSON 之外的解释，不制造材料税、倒计时或强制失败。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `当前经营数据：\n${JSON.stringify(payload)}`,
          },
        ],
      });
      if (signal?.aborted) throw abortError();
      const parsed = contract.parse(generated);
      return {
        source: 'ai',
        ...clone(parsed),
        ...(kind === 'coCreation' ? { projectId: input.project?.id } : {}),
      };
    },
  });
}
