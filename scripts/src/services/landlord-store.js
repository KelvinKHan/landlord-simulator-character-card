import { cloneLandlordState, createDefaultLandlordState } from '../model/default-state.js';
import { assertLandlordState } from '../model/validate-state.js';
import { applyChangeSet } from '../state/change-set.js';

function defaultIdFactory(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function awarenessTier(value) {
  const awareness = Math.max(0, Math.min(100, Number(value) || 0));
  if (awareness === 0) return '未发现';
  if (awareness < 25) return '轮廓';
  if (awareness < 60) return '初步了解';
  if (awareness < 90) return '已显露';
  return '完全掌握';
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

  function appendDomainEvent(state, event, { channels = ['正文', '微信', '新闻', '建筑'] } = {}) {
    const eventId = idFactory('event');
    state.事件列表[eventId] = event;
    const personId = Object.keys(event.参与者 ?? {})[0] ?? '';
    for (const channel of channels) {
      const deliveryId = idFactory('link');
      state.联动队列[deliveryId] = {
        事件ID: eventId,
        频道: channel,
        标题: event.标题,
        摘要: event.摘要,
        建筑ID: event.建筑ID,
        空间ID: event.空间ID,
        人物ID: personId,
        来源类型: event.类型,
        状态: '待分发',
        创建时间: event.发生时间,
        上下文: {},
      };
    }
    return eventId;
  }

  function revealManagedSpace(building, space) {
    space.感知度 = 100;
    const floor = building.楼层列表?.[space.楼层ID];
    if (floor) floor.感知度 = 100;
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

    async setRunMode(mode) {
      if (!['模拟', '真实'].includes(mode)) throw new Error(`不支持的运行模式：${mode}`);
      return commit('切换经营生成模式', state => {
        state.运行模式 = mode;
      });
    },

    async increaseAwareness({ buildingId, floorId = null, spaceId = null, personId = null, amount = 10 }) {
      const step = Number(amount);
      if (!Number.isFinite(step) || step <= 0) throw new Error('感知提升必须大于 0');
      return commit('探索与逐步感知', state => {
        const building = state.建筑列表[buildingId];
        if (!building) throw new Error(`建筑不存在：${buildingId}`);
        let target = building;
        let targetName = building.名称;
        if (floorId) {
          target = building.楼层列表[floorId];
          if (!target) throw new Error(`楼层不存在：${floorId}`);
          targetName = target.名称;
        }
        if (spaceId) {
          target = building.空间列表[spaceId];
          if (!target) throw new Error(`空间不存在：${spaceId}`);
          targetName = target.名称;
        }
        if (personId) {
          target = state.人物列表[personId];
          if (!target) throw new Error(`人物不存在：${personId}`);
          if (target.所在建筑ID !== buildingId) throw new Error('人物不在指定建筑中');
          targetName = target.姓名;
        }
        const beforeTier = awarenessTier(target.感知度);
        target.感知度 = Math.min(100, Number(target.感知度 ?? 0) + step);
        const afterTier = awarenessTier(target.感知度);
        if (beforeTier !== afterTier) {
          appendDomainEvent(state, {
            标题: `对「${targetName}」的了解加深`,
            类型: '探索发现',
            建筑ID: buildingId,
            空间ID: spaceId ?? '',
            状态: '已完成',
            摘要: `${targetName}从「${beforeTier}」进入「${afterTier}」阶段。`,
            发生时间: '刚刚',
            参与者: personId ? { [personId]: '被了解' } : {},
          });
        }
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
        appendDomainEvent(state, {
          标题: `正式接管「${building.名称}」`,
          类型: '建筑接管',
          建筑ID: buildingId,
          空间ID: '',
          状态: '已完成',
          摘要: direction?.summary ?? '新的建筑已经加入房东经营版图。',
          发生时间: '刚刚',
          参与者: {},
        });
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
        revealManagedSpace(building, space);
        space.状态 = '正常';
        space.描述 = plan.resultDescription ?? space.描述;
        building.经营摘要.今日亮点 = `${space.名称}完成了「${plan.name}」改造`;
        appendDomainEvent(state, {
          标题: `${space.名称}焕然一新`,
          类型: '装修完成',
          建筑ID: buildingId,
          空间ID: spaceId,
          状态: '已完成',
          摘要: plan.resultDescription,
          发生时间: '刚刚',
          参与者: {},
        });
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
        revealManagedSpace(building, space);
        space.占用者[personId] = candidate.role;
        building.经营摘要.活跃度 = Math.min(100, building.经营摘要.活跃度 + 8);
        appendDomainEvent(state, {
          标题: `${candidate.name}加入了${building.名称}`,
          类型: '人物加入',
          建筑ID: buildingId,
          空间ID: spaceId,
          状态: '已完成',
          摘要: `${candidate.name}已经被安排到${space.名称}。`,
          发生时间: '刚刚',
          参与者: { [personId]: '新成员' },
        });
      });
    },

    async movePerson({ personId, buildingId, spaceId, activity = '移动中', expectedFrom = null }) {
      return commit('确认人物空间同步', state => {
        const person = state.人物列表[personId];
        if (!person) throw new Error(`人物不存在：${personId}`);
        if (expectedFrom && (person.所在建筑ID !== expectedFrom.buildingId || person.所在空间ID !== expectedFrom.spaceId)) {
          throw new Error(`${person.姓名}的位置已经被其他剧情更新，不能覆盖`);
        }
        const building = state.建筑列表[buildingId];
        const destination = building?.空间列表?.[spaceId];
        if (!destination) throw new Error(`移动目标不存在：${buildingId}/${spaceId}`);
        if (!['总部', '已接管'].includes(building.接管状态)) throw new Error('不能把人物移动到尚未接管的建筑');
        const sourceBuilding = state.建筑列表[person.所在建筑ID];
        const source = sourceBuilding?.空间列表?.[person.所在空间ID];
        const role = source?.占用者?.[personId] ?? person.身份类型;
        if (source?.占用者) delete source.占用者[personId];
        destination.占用者[personId] = role;
        const sourceName = source?.名称 ?? '未知位置';
        person.所在建筑ID = buildingId;
        person.所在空间ID = spaceId;
        person.状态 = String(activity || '移动中');
        revealManagedSpace(building, destination);
        appendDomainEvent(state, {
          标题: `${person.姓名}来到${destination.名称}`,
          类型: '人物移动',
          建筑ID: buildingId,
          空间ID: spaceId,
          状态: '已完成',
          摘要: `${person.姓名}从${sourceName}来到${destination.名称}，当前正在${person.状态}。`,
          发生时间: '刚刚',
          参与者: { [personId]: role },
        }, { channels: ['正文', '建筑'] });
      });
    },

    async setDeliveryStatus(deliveryId, status) {
      if (!['待分发', '已读取', '已忽略'].includes(status)) throw new Error(`不支持的联动状态：${status}`);
      return commit('更新联动队列', state => {
        const delivery = state.联动队列[deliveryId];
        if (!delivery) throw new Error(`联动项不存在：${deliveryId}`);
        delivery.状态 = status;
      });
    },

    async applyStateChanges(changes, { direction = 'undo', label = '应用经营状态变更' } = {}) {
      return commit(label, state => applyChangeSet(state, changes, direction));
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('状态订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
