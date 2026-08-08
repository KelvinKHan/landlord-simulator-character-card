function room({ name, type, floorId, size, purpose, description, status = '正常', adjacent = {}, facilities = {} }) {
  return {
    名称: name,
    类型: type,
    楼层ID: floorId,
    尺寸: size,
    状态: status,
    用途: purpose,
    描述: description,
    感知度: 100,
    相邻空间: adjacent,
    占用者: {},
    设施: facilities,
    装修: {
      风格: '基础装修',
      配色: { 主色: '#FFF7F9', 点缀: '#FF9EAA' },
      材质: {},
      家具: {},
      照明: '自然柔光',
      氛围: '舒适',
      完成度: 35,
    },
  };
}

function createHeadquarters() {
  return {
    名称: '房东总部公寓',
    类型: '公寓',
    世界观: '跟随当前世界',
    简介: '玩家最初拥有的总部。这里既是住处，也是所有建筑经营计划的起点。',
    是否总部: true,
    接管状态: '总部',
    感知度: 100,
    主题: { 图标: 'home', 主色: '#FF9EAA', 辅色: '#FFB7B2', 纹理: 'candy-grid' },
    经营摘要: { 等级: 1, 活跃度: 42, 入住率: 10, 今日亮点: '阳光正落在一楼客厅的窗边' },
    楼层列表: {
      floor_4: { 名称: '四楼', 顺序: 4, 感知度: 35, 描述: '尚有许多空间等待规划。' },
      floor_3: { 名称: '三楼', 顺序: 3, 感知度: 55, 描述: '安静的预留居住层。' },
      floor_2: { 名称: '二楼', 顺序: 2, 感知度: 100, 描述: '房东的私人楼层。' },
      floor_1: { 名称: '一楼', 顺序: 1, 感知度: 100, 描述: '公寓的主要公共生活区域。' },
      floor_b1: { 名称: '地下一楼', 顺序: -1, 感知度: 25, 描述: '尚未完全整理的地下空间。' },
    },
    空间列表: {
      room_owner: room({
        name: '您的房间',
        type: '您的房间',
        floorId: 'floor_2',
        size: '大型',
        purpose: '私人生活与休息',
        description: '这是您在总部公寓里的私人空间。',
        adjacent: { hall_floor_2: '连接走廊' },
      }),
      hall_floor_2: room({
        name: '二楼走廊',
        type: '公共区域',
        floorId: 'floor_2',
        size: '中型',
        purpose: '连接二楼房间',
        description: '铺着柔软地毯的安静走廊。',
        adjacent: { room_owner: '相邻' },
      }),
      living_room: room({
        name: '客厅',
        type: '固定设施',
        floorId: 'floor_1',
        size: '超大型',
        purpose: '会客、休息与公共活动',
        description: '宽敞舒适的公共客厅，是租客最容易相遇的地方。',
        adjacent: { kitchen: '开放式连接', public_bath: '经过走廊', garden: '落地门相连' },
        facilities: {
          sofa_group: { 名称: '柔软沙发组', 状态: '良好', 描述: '足够很多人一起坐下。' },
        },
      }),
      kitchen: room({
        name: '厨房',
        type: '固定设施',
        floorId: 'floor_1',
        size: '大型',
        purpose: '烹饪与聚餐准备',
        description: '设备齐全、可以大展厨艺的开放厨房。',
        adjacent: { living_room: '开放式连接' },
      }),
      public_bath: room({
        name: '公共卫浴',
        type: '固定设施',
        floorId: 'floor_1',
        size: '中型',
        purpose: '公共洗浴',
        description: '干净明亮、设备齐全的公共卫浴。',
        adjacent: { living_room: '经过走廊' },
      }),
      garden: room({
        name: '花园',
        type: '室外区域',
        floorId: 'floor_1',
        size: '超大型',
        purpose: '散步、休息与举办户外活动',
        description: '鲜花盛开的花园，傍晚会亮起暖色庭院灯。',
        adjacent: { living_room: '落地门相连', pool: '石板路相连' },
      }),
      pool: room({
        name: '泳池',
        type: '室外区域',
        floorId: 'floor_1',
        size: '大型',
        purpose: '游泳与夏日聚会',
        description: '清澈的室外泳池，水面映着花园的灯光。',
        adjacent: { garden: '石板路相连' },
      }),
    },
  };
}

function createHospitalCandidate() {
  return {
    名称: '白塔社区医院',
    类型: '医院',
    世界观: '跟随当前世界',
    简介: '一座仍在运行的小型社区医院。它有可靠的基础设施，也有大片可以重新规划的空间。',
    是否总部: false,
    接管状态: '可接管',
    感知度: 72,
    主题: { 图标: 'hospital', 主色: '#55B7A5', 辅色: '#A7F3D0', 纹理: 'medical-cross' },
    经营摘要: { 等级: 1, 活跃度: 58, 入住率: 46, 今日亮点: '旧住院部正在等待新的用途' },
    楼层列表: {
      hospital_3: { 名称: '三楼·住院部', 顺序: 3, 感知度: 45, 描述: '半数病房仍处于闲置状态。' },
      hospital_2: { 名称: '二楼·诊疗区', 顺序: 2, 感知度: 80, 描述: '现有诊室和检查室集中于此。' },
      hospital_1: { 名称: '一楼·门诊大厅', 顺序: 1, 感知度: 100, 描述: '仍在正常接待来访者。' },
    },
    空间列表: {
      hospital_lobby: room({
        name: '门诊大厅',
        type: '接待空间',
        floorId: 'hospital_1',
        size: '超大型',
        purpose: '挂号、候诊与访客分流',
        description: '采光不错，但旧式座椅让这里显得有些疲惫。',
        adjacent: { hospital_clinic: '楼梯与电梯相连' },
      }),
      hospital_clinic: room({
        name: '综合诊室',
        type: '诊疗空间',
        floorId: 'hospital_2',
        size: '大型',
        purpose: '日常诊疗',
        description: '设备基本齐全，可以直接投入使用。',
        adjacent: { hospital_lobby: '楼梯与电梯相连', hospital_ward: '医用电梯相连' },
      }),
      hospital_ward: room({
        name: '旧住院部',
        type: '病房',
        floorId: 'hospital_3',
        size: '超大型',
        purpose: '等待重新规划',
        description: '一整片安静的旧病房，可以改造成特色病区、康复中心或完全不同的空间。',
        status: '空置',
        adjacent: { hospital_clinic: '医用电梯相连' },
      }),
    },
  };
}

function createOfficeCandidate() {
  return {
    名称: '云端创意写字楼',
    类型: '写字楼',
    世界观: '跟随当前世界',
    简介: '位于城市中心的精品写字楼，已经拥有共享大厅和基础办公设施。',
    是否总部: false,
    接管状态: '可接管',
    感知度: 64,
    主题: { 图标: 'office', 主色: '#6B8DC9', 辅色: '#C4B5FD', 纹理: 'blueprint' },
    经营摘要: { 等级: 1, 活跃度: 38, 入住率: 22, 今日亮点: '顶层空中会议室拥有整面城市景观' },
    楼层列表: {
      office_12: { 名称: '十二楼·空中层', 顺序: 12, 感知度: 55, 描述: '拥有最好的景观，也最需要重新规划。' },
      office_11: { 名称: '十一楼·办公层', 顺序: 11, 感知度: 82, 描述: '标准办公区，基础设施完整。' },
      office_10: { 名称: '十楼·共享大厅', 顺序: 10, 感知度: 100, 描述: '连接访客、员工和公共服务。' },
    },
    空间列表: {
      office_lobby: room({
        name: '共享大厅',
        type: '接待空间',
        floorId: 'office_10',
        size: '超大型',
        purpose: '接待、休息与共享活动',
        description: '层高开阔，中央有一座可以更换主题的艺术装置。',
        adjacent: { office_open: '电梯相连' },
      }),
      office_open: room({
        name: '开放办公区',
        type: '办公空间',
        floorId: 'office_11',
        size: '超大型',
        purpose: '团队办公',
        description: '桌椅和网络已经就位，可以直接招募第一批团队。',
        adjacent: { office_lobby: '电梯相连', office_skyroom: '楼梯与电梯相连' },
      }),
      office_skyroom: room({
        name: '空中会议室',
        type: '会议空间',
        floorId: 'office_12',
        size: '大型',
        purpose: '会议、展示或改造成特殊空间',
        description: '整面落地窗外是城市天际线，室内尚未确定最终用途。',
        status: '空置',
        adjacent: { office_open: '楼梯与电梯相连' },
      }),
    },
  };
}

export function createDefaultLandlordState() {
  return {
    版本: '2.0',
    运行模式: '模拟',
    当前建筑ID: 'building_headquarters',
    用户: { 名称: '{{user}}', 物品栏: {} },
    建筑列表: {
      building_headquarters: createHeadquarters(),
      building_hospital_candidate: createHospitalCandidate(),
      building_office_candidate: createOfficeCandidate(),
    },
    人物列表: {},
    事件列表: {},
  };
}

export function cloneLandlordState(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
