import { planSpatialMove } from '../spatial/route-engine.js';

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function defaultIdFactory() {
  return `spatial_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicProposal(proposal) {
  return Object.freeze(clone(proposal));
}

export function createSpatialSyncService({ store, idFactory = defaultIdFactory, clock = () => Date.now() }) {
  if (!store?.getState || !store?.movePerson) throw new TypeError('空间同步需要支持人物移动的房东状态服务');
  const proposals = new Map();
  const listeners = new Set();

  function publish(proposal) {
    const snapshot = publicProposal(proposal);
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }

  function get(proposalId) {
    const proposal = proposals.get(proposalId);
    return proposal ? publicProposal(proposal) : null;
  }

  function propose(intents, { source = 'manual' } = {}) {
    if (!Array.isArray(intents) || intents.length === 0) throw new Error('空间同步至少需要一条移动意图');
    return Object.freeze(intents.slice(0, 20).map(intent => {
      const route = planSpatialMove(store.getState(), intent);
      const now = clock();
      const proposal = {
        id: idFactory(),
        source,
        personId: intent.personId,
        buildingId: intent.buildingId,
        spaceId: intent.spaceId,
        activity: String(intent.activity ?? '移动中'),
        status: route.ok ? '待确认' : '冲突',
        reason: route.reason,
        route,
        createdAt: now,
        updatedAt: now,
      };
      proposals.set(proposal.id, proposal);
      return publish(proposal);
    }));
  }

  async function confirm(proposalId) {
    const proposal = proposals.get(proposalId);
    if (!proposal) throw new Error(`空间同步提案不存在：${proposalId}`);
    if (proposal.status !== '待确认') throw new Error(`空间同步提案当前不可确认：${proposal.status}`);
    proposal.status = '写入中';
    proposal.updatedAt = clock();
    publish(proposal);
    try {
      await store.movePerson({
        personId: proposal.personId,
        buildingId: proposal.buildingId,
        spaceId: proposal.spaceId,
        activity: proposal.activity,
        expectedFrom: {
          buildingId: proposal.route.fromBuildingId,
          spaceId: proposal.route.fromSpaceId,
        },
      });
      proposal.status = '已应用';
      proposal.updatedAt = clock();
      return publish(proposal);
    } catch (error) {
      proposal.status = '冲突';
      proposal.reason = error instanceof Error ? error.message : String(error);
      proposal.updatedAt = clock();
      publish(proposal);
      throw error;
    }
  }

  function ignore(proposalId) {
    const proposal = proposals.get(proposalId);
    if (!proposal) throw new Error(`空间同步提案不存在：${proposalId}`);
    if (['已应用', '已忽略'].includes(proposal.status)) return publicProposal(proposal);
    proposal.status = '已忽略';
    proposal.updatedAt = clock();
    return publish(proposal);
  }

  return Object.freeze({
    propose,
    confirm,
    ignore,
    get,
    list({ status = null, limit = 30 } = {}) {
      const count = Math.max(0, Number(limit) || 0);
      if (count === 0) return Object.freeze([]);
      return Object.freeze([...proposals.values()]
        .filter(proposal => !status || proposal.status === status)
        .slice(-count)
        .map(publicProposal)
        .reverse());
    },
    counts() {
      const result = { 待确认: 0, 冲突: 0, 已应用: 0, 已忽略: 0, 写入中: 0 };
      for (const proposal of proposals.values()) result[proposal.status] = (result[proposal.status] ?? 0) + 1;
      return Object.freeze(result);
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('空间同步订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      proposals.clear();
    },
  });
}
