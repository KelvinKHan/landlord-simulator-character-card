import { cloneLandlordState, createDefaultLandlordState } from '../model/default-state.js';
import { assertLandlordState } from '../model/validate-state.js';

function defaultIdFactory(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function createLandlordStore({ mvu, schema, idFactory = defaultIdFactory }) {
  if (!mvu || typeof mvu.transaction !== 'function') throw new TypeError('房东状态服务需要 MVU 事务服务');
  if (!schema || typeof schema.parseState !== 'function') throw new TypeError('房东状态服务需要 Schema 解析器');

  const listeners = new Set();

  function parse(value) {
    return assertLandlordState(schema.parseState(value));
  }

  function getState() {
    const stored = mvu.read('房东系统', null);
    return parse(stored ?? createDefaultLandlordState());
  }

  async function commit(label, change) {
    let committedState;
    const transaction = await mvu.transaction(
      statData => {
        const current = parse(statData.房东系统 ?? createDefaultLandlordState());
        const draft = cloneLandlordState(current);
        const result = change(draft);
        committedState = parse(result ?? draft);
        statData.房东系统 = committedState;
      },
      {
        validate: snapshot => {
          snapshot.stat_data.房东系统 = parse(snapshot.stat_data.房东系统);
          return snapshot;
        },
      },
    );
    const event = Object.freeze({ label, state: cloneLandlordState(committedState), transaction });
    for (const listener of listeners) listener(event);
    return event;
  }

  return Object.freeze({
    getState,

    async ensureInitialized() {
      if (mvu.read('房东系统', null)) return Object.freeze({ initialized: false, state: getState() });
      const event = await commit('初始化房东系统', () => createDefaultLandlordState());
      return Object.freeze({ initialized: true, state: event.state });
    },

    async setCurrentBuilding(buildingId) {
      return commit('切换当前建筑', state => {
        if (!state.建筑列表[buildingId]) throw new Error(`建筑不存在：${buildingId}`);
        state.当前建筑ID = buildingId;
      });
    },

    async acquireBuilding(buildingId, direction = null) {
      return commit('接管建筑', state => {
        const building = state.建筑列表[buildingId];
        if (!building) throw new Error(`建筑不存在：${buildingId}`);
        if (building.接管状态 !== '可接管') throw new Error(`建筑「${building.名称}」当前不可接管`);
        building.接管状态 = '已接管';
        building.感知度 = 100;
        building.经营摘要.活跃度 = Math.max(50, building.经营摘要.活跃度);
        if (direction) {
          building.名称 = direction.buildingName ?? building.名称;
          building.简介 = direction.description ?? building.简介;
          building.经营摘要.今日亮点 = direction.highlight ?? building.经营摘要.今日亮点;
          building.主题 = { ...building.主题, ...(direction.theme ?? {}) };
        }
        state.当前建筑ID = buildingId;
        const eventId = idFactory('event');
        state.事件列表[eventId] = {
          标题: `正式接管「${building.名称}」`,
          类型: '建筑接管',
          建筑ID: buildingId,
          空间ID: '',
          状态: '已完成',
          摘要: direction?.summary ?? '新的建筑已经加入房东经营版图。',
          发生时间: '刚刚',
          参与者: {},
        };
      });
    },

    async applyRenovation({ buildingId, spaceId, plan }) {
      return commit('应用装修方案', state => {
        const building = state.建筑列表[buildingId];
        const space = building?.空间列表?.[spaceId];
        if (!space) throw new Error(`装修目标不存在：${buildingId}/${spaceId}`);
        if (!['总部', '已接管'].includes(building.接管状态)) throw new Error('尚未接管的建筑不能装修');
        space.装修 = {
          风格: plan.style,
          配色: cloneLandlordState(plan.palette ?? {}),
          材质: cloneLandlordState(plan.materials ?? {}),
          家具: cloneLandlordState(plan.furniture ?? {}),
          照明: plan.lighting,
          氛围: plan.atmosphere,
          完成度: 100,
        };
        space.状态 = '正常';
        space.描述 = plan.resultDescription ?? space.描述;
        building.经营摘要.今日亮点 = `${space.名称}完成了「${plan.name}」改造`;
        const eventId = idFactory('event');
        state.事件列表[eventId] = {
          标题: `${space.名称}焕然一新`,
          类型: '装修完成',
          建筑ID: buildingId,
          空间ID: spaceId,
          状态: '已完成',
          摘要: plan.resultDescription,
          发生时间: '刚刚',
          参与者: {},
        };
      });
    },

    async recruit({ buildingId, spaceId, candidate }) {
      return commit('招募并安置人物', state => {
        const building = state.建筑列表[buildingId];
        const space = building?.空间列表?.[spaceId];
        if (!space) throw new Error(`安置空间不存在：${buildingId}/${spaceId}`);
        if (!['总部', '已接管'].includes(building.接管状态)) throw new Error('尚未接管的建筑不能招募人物');
        const personId = candidate.id || idFactory('person');
        if (state.人物列表[personId]) throw new Error(`人物已经存在：${personId}`);
        state.人物列表[personId] = {
          姓名: candidate.name,
          来源世界: candidate.origin,
          身份类型: candidate.role,
          职业: candidate.profession,
          所在建筑ID: buildingId,
          所在空间ID: spaceId,
          外貌: candidate.appearance,
          性格: candidate.personality,
          状态: '刚刚加入',
          内心: candidate.firstThought,
          感知度: 100,
          视觉身份: cloneLandlordState(candidate.visualIdentity),
          关系: {},
        };
        space.占用者[personId] = candidate.role;
        building.经营摘要.活跃度 = Math.min(100, building.经营摘要.活跃度 + 8);
        const eventId = idFactory('event');
        state.事件列表[eventId] = {
          标题: `${candidate.name}加入了${building.名称}`,
          类型: '人物加入',
          建筑ID: buildingId,
          空间ID: spaceId,
          状态: '已完成',
          摘要: `${candidate.name}已经被安排到${space.名称}。`,
          发生时间: '刚刚',
          参与者: { [personId]: '新成员' },
        };
      });
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('状态订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
