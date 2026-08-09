function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function equal(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => equal(value, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

function assertPath(path) {
  if (!Array.isArray(path) || path.length === 0) throw new TypeError('状态变更路径不能为空');
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  for (const part of path) {
    if (typeof part !== 'string' || !part || forbidden.has(part)) throw new TypeError(`状态变更路径不安全：${path.join('.')}`);
  }
}

function locate(root, path) {
  let value = root;
  for (const part of path) {
    if (!isRecord(value) || !own(value, part)) return { exists: false, value: undefined };
    value = value[part];
  }
  return { exists: true, value };
}

function write(root, path, exists, value) {
  let parent = root;
  for (const part of path.slice(0, -1)) {
    if (!isRecord(parent[part])) parent[part] = {};
    parent = parent[part];
  }
  const key = path.at(-1);
  if (exists) parent[key] = clone(value);
  else delete parent[key];
}

function collect(before, after, path, changes) {
  if (equal(before, after)) return;
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      const beforeExists = own(before, key);
      const afterExists = own(after, key);
      if (!beforeExists || !afterExists) {
        changes.push(Object.freeze({
          path: Object.freeze([...path, key]),
          beforeExists,
          beforeValue: clone(before[key]),
          afterExists,
          afterValue: clone(after[key]),
        }));
      } else {
        collect(before[key], after[key], [...path, key], changes);
      }
    }
    return;
  }
  changes.push(Object.freeze({
    path: Object.freeze([...path]),
    beforeExists: true,
    beforeValue: clone(before),
    afterExists: true,
    afterValue: clone(after),
  }));
}

export function createChangeSet(before, after) {
  if (!isRecord(before) || !isRecord(after)) throw new TypeError('状态变更集只接受对象快照');
  const changes = [];
  collect(before, after, [], changes);
  return Object.freeze(changes);
}

export function isChangeSetApplicable(state, changes, direction = 'undo') {
  if (!isRecord(state) || !Array.isArray(changes)) return false;
  if (!['undo', 'redo'].includes(direction)) return false;
  return changes.every(change => {
    try {
      assertPath(change.path);
      const current = locate(state, change.path);
      const expectedExists = direction === 'undo' ? change.afterExists : change.beforeExists;
      const expectedValue = direction === 'undo' ? change.afterValue : change.beforeValue;
      return current.exists === expectedExists && (!expectedExists || equal(current.value, expectedValue));
    } catch {
      return false;
    }
  });
}

export function applyChangeSet(state, changes, direction = 'undo') {
  if (!isRecord(state)) throw new TypeError('状态变更集需要对象目标');
  if (!Array.isArray(changes)) throw new TypeError('状态变更集必须是数组');
  if (!['undo', 'redo'].includes(direction)) throw new Error(`不支持的变更方向：${direction}`);
  if (!isChangeSetApplicable(state, changes, direction)) throw new Error('经营状态已发生重叠变化，无法安全回溯');
  for (const change of changes) {
    const nextExists = direction === 'undo' ? change.beforeExists : change.afterExists;
    const nextValue = direction === 'undo' ? change.beforeValue : change.afterValue;
    write(state, change.path, nextExists, nextValue);
  }
  return state;
}

export function affectedRoots(changes) {
  return Object.freeze([...new Set(changes.map(change => change.path[0]))].sort());
}
