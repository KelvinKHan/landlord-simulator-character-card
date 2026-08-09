function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function safeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#FF9EAA';
}

export function createTenantIdentityService({ store }) {
  if (!store || typeof store.getState !== 'function') throw new TypeError('租客身份服务需要状态服务');

  function get(personId) {
    const state = store.getState();
    const person = state.人物列表[personId];
    if (!person) return null;
    const building = state.建筑列表[person.所在建筑ID];
    const space = building?.空间列表?.[person.所在空间ID];
    const key = stableHash(personId);
    return Object.freeze({
      id: personId,
      name: person.姓名,
      initial: person.姓名.slice(0, 1),
      avatarKey: `tenant_${key}`,
      contactId: `landlord_wechat_${key}`,
      markerId: `building_marker_${key}`,
      color: safeColor(person.视觉身份?.主色),
      icon: person.视觉身份?.图标 ?? 'person',
      pattern: person.视觉身份?.纹样 ?? 'dots',
      origin: person.来源世界,
      role: person.身份类型,
      profession: person.职业,
      status: person.状态,
      buildingId: person.所在建筑ID,
      buildingName: building?.名称 ?? '未知建筑',
      spaceId: person.所在空间ID,
      spaceName: space?.名称 ?? '未分配空间',
      signature: `${person.来源世界} · ${person.职业} · ${person.状态}`,
    });
  }

  function listForBuilding(buildingId) {
    return Object.keys(store.getState().人物列表)
      .map(get)
      .filter(identity => identity?.buildingId === buildingId);
  }

  function project(personId, channel) {
    const identity = get(personId);
    if (!identity) throw new Error(`人物不存在：${personId}`);
    if (channel === '微信') return Object.freeze({ id: identity.contactId, name: identity.name, avatarKey: identity.avatarKey, color: identity.color, signature: identity.signature });
    if (channel === '新闻') return Object.freeze({ subjectId: identity.id, displayName: identity.name, descriptor: `${identity.origin}来的${identity.profession}` });
    if (channel === '正文') return Object.freeze({ characterId: identity.id, name: identity.name, location: `${identity.buildingName}·${identity.spaceName}`, status: identity.status });
    if (channel === '建筑') return Object.freeze({ markerId: identity.markerId, label: identity.name, color: identity.color, buildingId: identity.buildingId, spaceId: identity.spaceId });
    throw new Error(`未知身份投影频道：${channel}`);
  }

  return Object.freeze({ get, listForBuilding, project });
}
