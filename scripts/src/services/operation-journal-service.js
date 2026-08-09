import { affectedRoots, createChangeSet, isChangeSetApplicable } from '../state/change-set.js';

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function defaultIdFactory() {
  return `operation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicEntry(entry, index, cursor) {
  return Object.freeze({
    id: entry.id,
    kind: entry.kind,
    label: entry.label,
    changeCount: entry.changes.length,
    affectedRoots: entry.affectedRoots,
    createdAt: entry.createdAt,
    status: index <= cursor ? '已应用' : '已撤销',
  });
}

export function createOperationJournal({ store, maxEntries = 30, idFactory = defaultIdFactory, clock = () => Date.now() }) {
  if (!store?.getState || !store?.applyStateChanges) throw new TypeError('经营回溯需要支持变更集的房东状态服务');
  const limit = Math.max(1, Number(maxEntries) || 30);
  const entries = [];
  const listeners = new Set();
  let cursor = -1;
  let busy = false;

  function publish() {
    const snapshot = summary();
    for (const listener of listeners) listener(snapshot);
    return snapshot;
  }

  function summary() {
    const state = store.getState();
    const undoEntry = entries[cursor] ?? null;
    const redoEntry = entries[cursor + 1] ?? null;
    return Object.freeze({
      busy,
      count: entries.length,
      appliedCount: cursor + 1,
      canUndo: Boolean(undoEntry && isChangeSetApplicable(state, undoEntry.changes, 'undo')),
      canRedo: Boolean(redoEntry && isChangeSetApplicable(state, redoEntry.changes, 'redo')),
      undoLabel: undoEntry?.label ?? '',
      redoLabel: redoEntry?.label ?? '',
      blockedUndo: Boolean(undoEntry && !isChangeSetApplicable(state, undoEntry.changes, 'undo')),
    });
  }

  async function perform({ kind = 'management', label }, action) {
    if (busy) throw new Error('经营回溯正在处理另一项操作');
    if (!label || typeof action !== 'function') throw new TypeError('经营操作需要名称和执行函数');
    busy = true;
    publish();
    const before = clone(store.getState());
    try {
      const result = await action();
      const changes = createChangeSet(before, store.getState());
      if (changes.length > 0) {
        entries.splice(cursor + 1);
        entries.push(Object.freeze({
          id: idFactory(),
          kind,
          label,
          changes,
          affectedRoots: affectedRoots(changes),
          createdAt: clock(),
        }));
        if (entries.length > limit) entries.splice(0, entries.length - limit);
        cursor = entries.length - 1;
      }
      return result;
    } finally {
      busy = false;
      publish();
    }
  }

  async function move(direction) {
    if (busy) throw new Error('经营回溯正在处理另一项操作');
    const index = direction === 'undo' ? cursor : cursor + 1;
    const entry = entries[index];
    if (!entry) throw new Error(direction === 'undo' ? '没有可以撤销的经营操作' : '没有可以重做的经营操作');
    busy = true;
    publish();
    try {
      await store.applyStateChanges(entry.changes, {
        direction,
        label: `${direction === 'undo' ? '撤销' : '重做'}：${entry.label}`,
      });
      cursor += direction === 'undo' ? -1 : 1;
      return publicEntry(entry, index, cursor);
    } finally {
      busy = false;
      publish();
    }
  }

  return Object.freeze({
    perform,
    undo: () => move('undo'),
    redo: () => move('redo'),
    summary,
    list({ limit: requested = limit } = {}) {
      const count = Math.max(0, Number(requested) || 0);
      if (count === 0) return Object.freeze([]);
      const start = Math.max(0, entries.length - count);
      return Object.freeze(entries.slice(start).map((entry, index) => {
        const absoluteIndex = start + index;
        return publicEntry(entry, absoluteIndex, cursor);
      }).reverse());
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('经营回溯订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
  });
}
