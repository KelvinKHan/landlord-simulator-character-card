function takeoverDirections(building) {
  const shared = {
    hospital: [
      {
        id: 'healing-community',
        name: '治愈系生活医院',
        buildingName: '白塔治愈生活馆',
        description: '保留诊疗能力，同时把空置病房改造成康复、陪伴和跨世界居住空间。',
        highlight: '旧住院部将成为最温柔的康复生活区',
        summary: '医院将同时承担诊疗、生活与人物相遇的功能。',
        tags: ['生活化医疗', '柔和', '适合长期经营'],
        theme: { 主色: '#55B7A5', 辅色: '#F7D6E0', 纹理: 'healing-leaf' },
        opportunities: ['邀请特殊世界的治疗者', '改造空置病房', '建立屋顶疗愈花园'],
      },
      {
        id: 'multiverse-medical',
        name: '跨世界综合医院',
        buildingName: '万象联合医院',
        description: '为来自不同世界的种族和能力建立专属科室，让人物设定直接改变医院结构。',
        highlight: '每位新成员都可能带来一个前所未见的科室',
        summary: '医院成为不同世界医学、魔法与科技碰撞的核心舞台。',
        tags: ['跨世界', '科室扩张', '高自由度'],
        theme: { 主色: '#5B8DEF', 辅色: '#C4B5FD', 纹理: 'constellation' },
        opportunities: ['建立魔法诊疗科', '招募异世界医生', '处理特殊访客事件'],
      },
      {
        id: 'medical-residence',
        name: '医住一体社区',
        buildingName: '白塔医住社区',
        description: '把医疗、住宅与公共生活融合在同一栋建筑里，让病患、员工和租客自然产生联系。',
        highlight: '医院不再只有看病时才有人来',
        summary: '这里将成为一栋全天候活跃、关系密集的综合建筑。',
        tags: ['医住一体', '人物关系', '日常感'],
        theme: { 主色: '#3AAFA9', 辅色: '#FDE68A', 纹理: 'community-blocks' },
        opportunities: ['设置员工公寓', '开放共享厨房', '举办社区健康日'],
      },
    ],
    office: [
      {
        id: 'creative-tower',
        name: '跨世界创作者大厦',
        buildingName: '万象创作大厦',
        description: '把不同世界的创作者、研究者和奇人聚到同一栋楼，让每层都有完全不同的气质。',
        highlight: '顶层会议室将成为跨世界灵感碰撞现场',
        summary: '写字楼会围绕创作、合作和人物碰撞持续生长。',
        tags: ['创作', '跨世界团队', '轻经营'],
        theme: { 主色: '#6B8DC9', 辅色: '#F9A8D4', 纹理: 'creative-grid' },
        opportunities: ['招募第一批创作团队', '打造主题楼层', '举办公开展示日'],
      },
      {
        id: 'multiverse-agency',
        name: '万界事务所',
        buildingName: '云端万界事务所',
        description: '不同世界的委托、访客和员工都从这里进入，让写字楼成为故事的分发中心。',
        highlight: '共享大厅将出现来自不同世界的委托窗口',
        summary: '每位新成员都可能为建筑带来一条全新的业务线。',
        tags: ['委托中心', '访客流动', '世界碰撞'],
        theme: { 主色: '#7C6CE7', 辅色: '#67E8F9', 纹理: 'portal-lines' },
        opportunities: ['建立异世界接待部', '招募特殊顾问', '改造传送会议室'],
      },
      {
        id: 'life-service-hub',
        name: '生活服务中枢',
        buildingName: '云端生活服务中心',
        description: '把办公室改造成面向所有建筑的后勤、活动和生活服务总部。',
        highlight: '这里将协调公寓与未来建筑的日常需求',
        summary: '写字楼成为整个房东版图的温柔后勤中心。',
        tags: ['后勤', '多建筑联动', '生活感'],
        theme: { 主色: '#4F8A8B', 辅色: '#FBD46D', 纹理: 'service-map' },
        opportunities: ['设立活动策划部', '建立跨建筑配送', '开放公共休息层'],
      },
    ],
  };
  const buildingType = building.type ?? building.类型;
  const key = buildingType === '医院' ? 'hospital' : buildingType === '写字楼' ? 'office' : 'office';
  return shared[key];
}

function renovationPlans(building, space) {
  const accent = building.theme?.主色 ?? building.主题?.主色 ?? '#FF9EAA';
  const spaceName = space.name ?? space.名称 ?? '这个空间';
  return [
    {
      id: 'soft-story',
      name: '柔光故事场',
      style: '温柔现代',
      tagline: '让人物愿意在这里停下来聊天',
      palette: { 主色: '#FFF7F9', 点缀: accent, 木色: '#D7B89C' },
      materials: { 地面: '浅色木地板', 墙面: '细腻哑光墙面', 软装: '柔软织物' },
      furniture: { center: '围合式主家具', window: '窗边休息位', storage: '隐藏式收纳墙' },
      lighting: '2700K暖色分层灯光',
      atmosphere: '亲密、松弛、适合偶遇',
      resultDescription: `${spaceName}被改造成拥有柔和光线和围合座位的温柔空间，进入这里的人很自然地会放慢脚步。`,
      impacts: ['提升人物停留意愿', '适合日常互动', '夜间视觉更温暖'],
    },
    {
      id: 'world-collision',
      name: '万界拼贴',
      style: '跨世界折衷',
      tagline: '让不同来源的人都能留下自己的痕迹',
      palette: { 主色: '#232136', 点缀: '#C4A7E7', 高光: '#F6C177' },
      materials: { 地面: '深色石材与发光嵌条', 墙面: '可替换展示模块', 软装: '多文化纹样织物' },
      furniture: { center: '可重组模块家具', display: '世界收藏展示墙', corner: '小型交流角' },
      lighting: '可随人物来源变化的情景灯',
      atmosphere: '神秘、丰富、充满碰撞感',
      resultDescription: `${spaceName}拥有了像万花筒一样的跨世界陈设，每位新成员都能在这里找到熟悉又陌生的细节。`,
      impacts: ['强化世界观碰撞', '适合展示收藏', '可随新人物继续生长'],
    },
    {
      id: 'future-calm',
      name: '静谧未来',
      style: '轻未来主义',
      tagline: '有科技感，但不失去生活温度',
      palette: { 主色: '#F8FAFC', 点缀: '#6B8DC9', 光色: '#67E8F9' },
      materials: { 地面: '无缝浅灰地坪', 墙面: '微孔吸音板', 软装: '雾面科技织物' },
      furniture: { center: '悬浮感主家具', wall: '情景信息墙', hidden: '自动收纳模块' },
      lighting: '无主灯天光模拟系统',
      atmosphere: '清爽、安静、秩序感',
      resultDescription: `${spaceName}变得轻盈而安静，隐藏式设备与柔和的信息光带让空间像来自不遥远的未来。`,
      impacts: ['提高空间秩序感', '适合工作与专注', '形成明显科技气质'],
    },
  ];
}

function recruitmentCandidates(building) {
  const buildingType = building.type ?? building.类型;
  const role = buildingType === '医院' ? '员工' : buildingType === '写字楼' ? '成员' : '租客';
  const profession = buildingType === '医院' ? '跨界康复师' : buildingType === '写字楼' ? '奇想策划师' : '自由插画师';
  return [
    {
      id: `person_mock_${buildingType}_linxia`,
      name: '林夏',
      origin: '近未来都市',
      role,
      profession,
      appearance: '短发、浅色外套，随身带着一块会变化颜色的电子胸针。',
      personality: '聪明、松弛，面对陌生事物时总会先观察再给出意外的好主意。',
      firstThought: '这里比资料里写的更有生活气息，也许我会喜欢。',
      collision: '她习惯用技术解决问题，可能会被魔法或超自然租客彻底打乱思路。',
      quote: '先别急着规定它是什么，我们看看它还能变成什么。',
      tags: ['近未来', '创意', '适应力强'],
      visualIdentity: { 图标: 'spark', 主色: '#6B8DC9', 纹样: 'orbit' },
    },
    {
      id: `person_mock_${buildingType}_shaoqing`,
      name: '邵青',
      origin: '东方奇幻世界',
      role,
      profession: buildingType === '医院' ? '灵息医师' : buildingType === '写字楼' ? '异闻顾问' : '香药调配师',
      appearance: '墨色长发束在身后，衣袖间常带着淡淡草木香。',
      personality: '克制、温和，但对现代设备有旺盛而不肯承认的好奇心。',
      firstThought: '此处灵气稀薄，灯火却比夜明珠还要稳定。',
      collision: '会把现代设施理解成特殊法器，并慢慢发展出一套自己的使用方式。',
      quote: '若这扇门无需符箓便能自行开合，那确实很了不起。',
      tags: ['东方奇幻', '反差感', '温和'],
      visualIdentity: { 图标: 'leaf', 主色: '#55B7A5', 纹样: 'cloud' },
    },
    {
      id: `person_mock_${buildingType}_noa`,
      name: '诺娅',
      origin: '星际航行时代',
      role,
      profession: buildingType === '医院' ? '舰队急救官' : buildingType === '写字楼' ? '航线分析师' : '星图修复师',
      appearance: '银灰短发，眼睛像映着星点，行李只有一个小型金属箱。',
      personality: '直接、可靠，对普通生活用品反而缺乏常识。',
      firstThought: '重力稳定，空气质量良好。奇怪的是，这里居然没有值班表。',
      collision: '她会把公寓和其他建筑当成一艘结构松散但很有趣的飞船管理。',
      quote: '我可以接受没有舷窗，但至少告诉我厨房的紧急关闭按钮在哪里。',
      tags: ['星际', '可靠', '生活反差'],
      visualIdentity: { 图标: 'star', 主色: '#7C6CE7', 纹样: 'stars' },
    },
  ];
}

export const managementMockRecipes = Object.freeze({
  takeover: async ({ building }) => ({
    source: 'local-mock',
    buildingId: building.id,
    directions: takeoverDirections(building),
  }),
  renovation: async ({ building, space }) => ({
    source: 'local-mock',
    buildingId: building.id,
    spaceId: space.id,
    plans: renovationPlans(building, space),
  }),
  recruitment: async ({ building }) => ({
    source: 'local-mock',
    buildingId: building.id,
    candidates: recruitmentCandidates(building),
  }),
});
