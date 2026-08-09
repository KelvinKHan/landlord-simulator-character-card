function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function createPerceptionService({ store, step = 18 }) {
  if (!store || typeof store.increaseAwareness !== 'function') throw new TypeError('逐步感知服务需要状态服务');

  function findNext(buildingId) {
    const state = store.getState();
    const building = state.建筑列表[buildingId];
    if (!building) throw new Error(`建筑不存在：${buildingId}`);
    if (clamp(building.感知度) < 100) return { kind: 'building', id: buildingId, name: building.名称, awareness: clamp(building.感知度) };

    const floors = Object.entries(building.楼层列表 ?? {})
      .filter(([, floor]) => clamp(floor.感知度) < 100)
      .sort((left, right) => clamp(left[1].感知度) - clamp(right[1].感知度) || Number(left[1].顺序) - Number(right[1].顺序));
    if (floors.length) return { kind: 'floor', id: floors[0][0], name: floors[0][1].名称, awareness: clamp(floors[0][1].感知度) };

    const spaces = Object.entries(building.空间列表 ?? {})
      .filter(([, space]) => clamp(space.感知度) < 100)
      .sort((left, right) => clamp(left[1].感知度) - clamp(right[1].感知度));
    if (spaces.length) return { kind: 'space', id: spaces[0][0], name: spaces[0][1].名称, awareness: clamp(spaces[0][1].感知度) };
    return null;
  }

  return Object.freeze({
    findNext,
    async exploreNext(buildingId) {
      const target = findNext(buildingId);
      if (!target) return Object.freeze({ complete: true, target: null });
      await store.increaseAwareness({
        buildingId,
        floorId: target.kind === 'floor' ? target.id : null,
        spaceId: target.kind === 'space' ? target.id : null,
        amount: step,
      });
      const after = target.kind === 'building'
        ? store.getState().建筑列表[buildingId].感知度
        : target.kind === 'floor'
          ? store.getState().建筑列表[buildingId].楼层列表[target.id].感知度
          : store.getState().建筑列表[buildingId].空间列表[target.id].感知度;
      return Object.freeze({ complete: false, target: Object.freeze({ ...target, awareness: clamp(after) }) });
    },
  });
}
