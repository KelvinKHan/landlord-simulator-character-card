export function assertLandlordState(state) {
  const buildings = state?.建筑列表 ?? {};
  const people = state?.人物列表 ?? {};
  const headquarters = Object.entries(buildings).filter(([, building]) => building.是否总部);

  if (headquarters.length !== 1) throw new Error('房东系统必须且只能有一栋总部建筑');
  if (!buildings[state.当前建筑ID]) throw new Error(`当前建筑不存在：${state.当前建筑ID}`);

  for (const [buildingId, building] of Object.entries(buildings)) {
    for (const [spaceId, space] of Object.entries(building.空间列表 ?? {})) {
      if (!building.楼层列表?.[space.楼层ID]) {
        throw new Error(`建筑「${building.名称}」的空间「${space.名称}」引用了不存在的楼层：${space.楼层ID}`);
      }
      for (const personId of Object.keys(space.占用者 ?? {})) {
        const person = people[personId];
        if (!person) throw new Error(`空间「${spaceId}」引用了不存在的人物：${personId}`);
        if (person.所在建筑ID !== buildingId || person.所在空间ID !== spaceId) {
          throw new Error(`人物「${person.姓名}」的位置与空间占用记录不一致`);
        }
      }
    }
  }

  for (const [personId, person] of Object.entries(people)) {
    const building = buildings[person.所在建筑ID];
    if (!building) throw new Error(`人物「${person.姓名}」所在建筑不存在`);
    if (!person.所在空间ID) continue;
    const space = building.空间列表?.[person.所在空间ID];
    if (!space) throw new Error(`人物「${person.姓名}」所在空间不存在`);
    if (!space.占用者?.[personId]) throw new Error(`人物「${person.姓名}」没有出现在对应空间的占用记录中`);
  }

  return state;
}
