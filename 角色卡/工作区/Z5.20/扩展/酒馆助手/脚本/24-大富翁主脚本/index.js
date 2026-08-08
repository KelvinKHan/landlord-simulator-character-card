// ==================== 大富翁模式 - 主脚本 ====================

// ==================== 常量 ====================
const MP_PREFIX = 'monopoly_';
const MP_PANEL_ID = 'monopoly-panel';
const MP_TOGGLE_ID = 'monopoly-toggle';
// ⬇️ 图床配置: 本地开发用localhost, 发布用HuggingFace
const _USE_HF = true; // 设为true切换到HuggingFace图床
const _HF_REPO = 'https://huggingface.co/datasets/KelvinKHan/monopoly-assets/resolve/main';
const ASSET_BASE = _USE_HF
    ? _HF_REPO + '/kenney_boardgame/PNG'
    : 'http://localhost:3456/pixel_assets/kenney_boardgame/PNG';
const PIXEL_ASSETS = {
    dice: n => `${ASSET_BASE}/Dice/dieWhite${n}.png`,
    diceRed: n => `${ASSET_BASE}/Dice/dieRed${n}.png`,
    piece: `${ASSET_BASE}/Pieces%20(Red)/pieceRed_border00.png`,
    chip: `${ASSET_BASE}/Chips/chipRedWhite.png`,
};

// ==================== 像素风建筑图片系统 ====================
const BLDG_IMG_BASE = _USE_HF
    ? _HF_REPO + '/buildings'
    : 'http://localhost:3456/pixel_assets/buildings';
// 节点ID → 建筑图片文件名（无扩展名）；缺失节点复用相近建筑
const NODE_BLDG_MAP = {
    0:  'bldg_00_start',          // 起点
    1:  'bldg_01_market',         // 市集
    2:  'bldg_02_garden',         // 庭园
    3:  'bldg_03_fate',           // 命运
    4:  'bldg_04_bathhouse',      // 浴场
    6:  'bldg_06_vacant',         // 空宅
    7:  'bldg_07_chance',         // 机会
    8:  'bldg_08_arena',          // 竞技场
    10: 'bldg_10_casino',         // 赌庄
    12: 'bldg_12_nightball',      // 夜宴
    13: 'bldg_13_finedine',       // 高级食肆
    14: 'bldg_07_chance',         // 机会(复用)
    15: 'bldg_15_academy',        // 书院
    16: 'bldg_16_auction',        // 拍卖行
    17: 'bldg_17_boudoir',        // 雅室
    18: 'bldg_03_fate',           // 命运(复用)
    19: 'bldg_19_condo',          // 雅居
    21: 'bldg_16_auction',        // 税所(复用拍卖行)
    24: 'bldg_24_redlight',       // 红坊
    26: 'bldg_03_fate',           // 命运(复用)
    27: 'bldg_27_escaperoom',     // 密室
    28: 'bldg_28_blackmarket',    // 黑市
    29: 'bldg_29_secretclub',     // 秘馆
    30: 'bldg_07_chance',         // 机会(复用)
    31: 'bldg_31_darkmanor',      // 暗宅
    32: 'bldg_32_infohouse',      // 情报屋
    34: 'bldg_32_infohouse',      // 逃生口(复用情报屋)
    36: 'bldg_36_boatparty',      // 船宴
    39: 'bldg_39_seabath',        // 海浴
    40: 'bldg_40_lighthouse',     // 灯塔
    41: 'bldg_41_exotictavern',   // 异域酒馆
    42: 'bldg_03_fate',           // 命运(复用)
    43: 'bldg_43_checkpoint',     // 关卡
    44: 'bldg_24_redlight',       // 密会所(复用红坊)
    45: 'bldg_46_shipyard',       // 海居(复用造船坊)
    47: 'bldg_46_shipyard',       // 码头(复用造船坊)
    49: 'bldg_03_fate',           // 占卜屋(复用命运)
    50: 'bldg_02_garden',         // 隐秘花园(复用庭园)
    51: 'bldg_32_infohouse',      // 迷宫通道(复用情报屋)
    56: 'bldg_23_tavern',         // 幽灵酒吧(复用酒肆)
    57: 'bldg_29_secretclub',     // 秘密分岔(复用秘馆)
    53: 'bldg_46_shipyard',       // 走私港(复用造船坊)
    54: 'bldg_17_boudoir',        // 幽会角(复用雅室)
    55: 'bldg_32_infohouse',      // 赏金猎人(复用情报屋)
    59: 'bldg_28_blackmarket',    // 幽暗集市(复用黑市)
};
// 建筑图片缓存（预加载后填入）
const _bldgImgCache = {};  // filename → Image对象
let _bldgImgsReady = false;
function preloadBuildingImages() {
    const unique = [...new Set(Object.values(NODE_BLDG_MAP))];
    let loaded = 0;
    const total = unique.length;
    unique.forEach(name => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { _bldgImgCache[name] = img; loaded++; if (loaded >= total) { _bldgImgsReady = true; requestCanvasRedraw(); } };
        img.onerror = () => { loaded++; if (loaded >= total) { _bldgImgsReady = true; requestCanvasRedraw(); } };
        img.src = `${BLDG_IMG_BASE}/${name}.png`;
    });
}
function getNodeBldgImg(nodeId) {
    const name = NODE_BLDG_MAP[nodeId];
    return name ? (_bldgImgCache[name] || null) : null;
}
// ==================== 用户头像（棋子用，IndexedDB存储） ====================
const AVATAR_DB_NAME = 'monopoly_assets';
const AVATAR_DB_STORE = 'avatars';
const AVATAR_DB_KEY = 'player_avatar';
let _userAvatarImg = null;

function _openAvatarDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(AVATAR_DB_NAME, 1);
        req.onupgradeneeded = (e) => { e.target.result.createObjectStore(AVATAR_DB_STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
function _createImg() {
    try { return getTargetDoc().createElement('img'); } catch(_) { return new Image(); }
}
async function loadUserAvatar() {
    try {
        const db = await _openAvatarDB();
        const tx = db.transaction(AVATAR_DB_STORE, 'readonly');
        const store = tx.objectStore(AVATAR_DB_STORE);
        const req = store.get(AVATAR_DB_KEY);
        req.onsuccess = () => {
            db.close();
            const dataUrl = req.result;
            if (!dataUrl) return;
            const img = _createImg();
            img.onload = () => { _userAvatarImg = img; console.log('[大富翁] 头像从IDB加载成功'); requestCanvasRedraw(); };
            img.src = dataUrl;
        };
        req.onerror = () => db.close();
    } catch (e) { console.warn('[大富翁] IndexedDB读取头像失败:', e); }
}
async function saveUserAvatar(dataUrl) {
    try {
        const db = await _openAvatarDB();
        const tx = db.transaction(AVATAR_DB_STORE, 'readwrite');
        tx.objectStore(AVATAR_DB_STORE).put(dataUrl, AVATAR_DB_KEY);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
    } catch (e) { console.warn('[大富翁] IndexedDB保存头像失败:', e); }
    const img = _createImg();
    img.onload = () => { _userAvatarImg = img; console.log('[大富翁] 头像保存并加载成功'); requestCanvasRedraw(); };
    img.src = dataUrl;
}
async function clearUserAvatar() {
    try {
        const db = await _openAvatarDB();
        const tx = db.transaction(AVATAR_DB_STORE, 'readwrite');
        tx.objectStore(AVATAR_DB_STORE).delete(AVATAR_DB_KEY);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
    } catch (e) { console.warn('[大富翁] IndexedDB删除头像失败:', e); }
    _userAvatarImg = null;
    requestCanvasRedraw();
}
// 保留颜色映射供面板UI使用
const EMOJI_TO_BLDG = {
    '🚩':'temple','🏪':'shop','🌳':'garden','🃏':'fortune','♨️':'bath',
    '🍜':'shop','🏡':'house','❓':'fortune','💪':'tower','🍸':'lounge',
    '🎰':'tower','🎭':'mansion','🪩':'lounge','🍷':'shop','📚':'house',
    '🔨':'govt','💄':'lounge','🏢':'tower','💕':'bath','📋':'govt',
    '🔧':'dark','🍺':'shop','🔞':'lounge','🔐':'dark','🕶️':'dark',
    '🪬':'dark','🏰':'mansion','🕵️':'dark','🧪':'house','🚪':'govt',
    '🌙':'dark','🚢':'dock','🦀':'dock','🌊':'bath','🗼':'tower',
    '🧜':'lounge','🛃':'govt','⛵':'dock','⚓':'dock',
    '🎯':'temple','💊':'house','💌':'fortune','💎':'tower',
    '📜':'fortune','🔮':'mansion','🗝️':'dark','🛡️':'govt',
    '🌹':'garden','📦':'dock','💜':'lounge','🎲':'fortune',
    '👻':'dark','🔥':'lounge','💰':'govt','💋':'lounge',
};
const BLDG_COLORS = {
    shop:'#E53935', house:'#43A047', bath:'#1E88E5', garden:'#66BB6A',
    temple:'#C62828', tower:'#FF8F00', dark:'#5C2D91', govt:'#546E7A',
    dock:'#6D4C41', fortune:'#FFB300', mansion:'#7B1FA2', lounge:'#E91E63',
};
function getBldgType(emoji) { return EMOJI_TO_BLDG[emoji] || 'house'; }
function getBldgColor(emoji) { return BLDG_COLORS[getBldgType(emoji)] || '#888'; }

// ==================== 地图数据（内联，无需外部加载） ====================

const TILE_TYPE = { FUNC: 'func', SCENE: 'scene', EROTIC: 'erotic', PROPERTY: 'property', EVENT: 'event' };
const EVENT_TYPE = { FATE: 'fate', CHANCE: 'chance' };
const FUNC_TYPE = { START: 'start', TAX: 'tax', SHOP: 'shop', ESCAPE: 'escape', CHECKPOINT: 'checkpoint', DOCK: 'dock' };
const ZONES = [
    { id: 1, name: '起步区', color: '#4CAF50' }, { id: 2, name: '繁华区', color: '#2196F3' },
    { id: 3, name: '暗巷区', color: '#9C27B0' }, { id: 4, name: '港湾区', color: '#FF9800' },
];
const OUTPOST_LEVELS = [
    { level: 0, name: '路人',   visitReq: 0,  investReq: 0,    discount: 1.0, dividendPerCycle: 0 },
    { level: 1, name: '常客',   visitReq: 3,  investReq: 500,  discount: 0.9, dividendPerCycle: 100 },
    { level: 2, name: 'VIP',    visitReq: 6,  investReq: 2000, discount: 0.7, dividendPerCycle: 200 },
    { level: 3, name: '合伙人', visitReq: 10, investReq: 5000, discount: 0,   dividendPerCycle: 300 },
];

const MAP_NODES = [
    // 主环: 起步区 (zone 1)
    { id: 0,  name: '起点',     type: TILE_TYPE.FUNC,     icon: '🚩', zone: 1, funcType: FUNC_TYPE.START, passBonus: 300, gx: 0, gy: 0 },
    { id: 1,  name: '市集',     type: TILE_TYPE.SCENE,    icon: '🏪', zone: 1, desc: '购物/偶遇/购买道具', gx: 1, gy: 0 },
    { id: 2,  name: '庭园',     type: TILE_TYPE.SCENE,    icon: '🌳', zone: 1, desc: '散步/约会/偶遇NPC', gx: 2, gy: 0 },
    { id: 3,  name: '命运',     type: TILE_TYPE.EVENT,    icon: '🃏', zone: 1, eventType: EVENT_TYPE.FATE, gx: 3, gy: 0 },
    { id: 4,  name: '浴场',     type: TILE_TYPE.EROTIC,   icon: '♨️', zone: 1, desc: '递进涩情', gx: 4, gy: 0 },
    { id: 6,  name: '空宅',     type: TILE_TYPE.PROPERTY, icon: '🏡', zone: 1, desc: '可购买的分基地', propertyCost: 2000, gx: 5, gy: 0 },
    { id: 7,  name: '机会',     type: TILE_TYPE.EVENT,    icon: '❓', zone: 1, eventType: EVENT_TYPE.CHANCE, gx: 6, gy: 0 },
    { id: 8,  name: '竞技场',   type: TILE_TYPE.SCENE,    icon: '💪', zone: 1, desc: '运动/挑战 ⚡岔路口', gx: 7, gy: 0 },
    { id: 10, name: '赌庄',     type: TILE_TYPE.SCENE,    icon: '🎰', zone: 1, desc: '小游戏赌筹码', gx: 8, gy: 0 },
    // 主环: 繁华区 (zone 2)
    { id: 12, name: '夜宴',     type: TILE_TYPE.EROTIC,   icon: '🪩', zone: 2, desc: '搭讪/舞会/包厢', gx: 9, gy: 0 },
    { id: 13, name: '高级食肆', type: TILE_TYPE.SCENE,    icon: '🍷', zone: 2, desc: '约会/高端社交', gx: 9, gy: 1 },
    { id: 14, name: '机会',     type: TILE_TYPE.EVENT,    icon: '❓', zone: 2, eventType: EVENT_TYPE.CHANCE, gx: 9, gy: 2 },
    { id: 15, name: '书院',     type: TILE_TYPE.SCENE,    icon: '📚', zone: 2, desc: '学习/安静社交', gx: 9, gy: 3 },
    { id: 16, name: '拍卖行',   type: TILE_TYPE.SCENE,    icon: '🔨', zone: 2, desc: '❗冒险路线汇入/竞价小游戏', gx: 9, gy: 4 },
    { id: 17, name: '雅室',     type: TILE_TYPE.EROTIC,   icon: '💄', zone: 2, desc: '中度涩情', gx: 9, gy: 5 },
    { id: 18, name: '命运',     type: TILE_TYPE.EVENT,    icon: '🃏', zone: 2, eventType: EVENT_TYPE.FATE, desc: '命运卡', gx: 9, gy: 6 },
    { id: 19, name: '雅居',     type: TILE_TYPE.PROPERTY, icon: '🏢', zone: 2, desc: '可购买的分基地', propertyCost: 4000, gx: 9, gy: 7 },
    { id: 21, name: '税所',     type: TILE_TYPE.FUNC,     icon: '📋', zone: 2, funcType: FUNC_TYPE.TAX, taxRate: 0.05, taxMin: 200, gx: 9, gy: 8 },
    // 主环: 暗巷区 (zone 3)
    { id: 24, name: '红坊',     type: TILE_TYPE.EROTIC,   icon: '🔞', zone: 3, desc: '重度涩情', gx: 9, gy: 9 },
    { id: 26, name: '命运',     type: TILE_TYPE.EVENT,    icon: '🃏', zone: 3, eventType: EVENT_TYPE.FATE, gx: 8, gy: 9 },
    { id: 27, name: '密室',     type: TILE_TYPE.SCENE,    icon: '🔐', zone: 3, desc: '解谜/挑战', gx: 7, gy: 9 },
    { id: 28, name: '黑市',     type: TILE_TYPE.FUNC,     icon: '🕶️', zone: 3, funcType: FUNC_TYPE.SHOP, gx: 6, gy: 9 },
    { id: 29, name: '秘馆',     type: TILE_TYPE.EROTIC,   icon: '🪬', zone: 3, desc: '中度涩情/角色扮演', gx: 5, gy: 9 },
    { id: 30, name: '机会',     type: TILE_TYPE.EVENT,    icon: '❓', zone: 3, eventType: EVENT_TYPE.CHANCE, gx: 4, gy: 9 },
    { id: 31, name: '暗宅',     type: TILE_TYPE.PROPERTY, icon: '🏰', zone: 3, desc: '可购买的分基地', propertyCost: 6000, gx: 3, gy: 9 },
    { id: 32, name: '情报屋',   type: TILE_TYPE.SCENE,    icon: '🕵️', zone: 3, desc: '获取线索/情报 ⚡岔路口', gx: 2, gy: 9 },
    { id: 34, name: '逃生口',   type: TILE_TYPE.FUNC,     icon: '🚪', zone: 3, funcType: FUNC_TYPE.ESCAPE, gx: 1, gy: 9 },
    // 主环: 港湾区 (zone 4)
    { id: 36, name: '船宴',     type: TILE_TYPE.EROTIC,   icon: '🚢', zone: 4, desc: '重度涩情/海上派对', gx: 0, gy: 9 },
    { id: 39, name: '海浴',     type: TILE_TYPE.EROTIC,   icon: '🌊', zone: 4, desc: '浴场升级版', gx: 0, gy: 8 },
    { id: 40, name: '灯塔',     type: TILE_TYPE.SCENE,    icon: '🗼', zone: 4, desc: '浪漫约会点', gx: 0, gy: 7 },
    { id: 41, name: '异域酒馆', type: TILE_TYPE.SCENE,    icon: '🧜', zone: 4, desc: '❗暗巷路线汇入/异域风格社交', gx: 0, gy: 6 },
    { id: 42, name: '命运',     type: TILE_TYPE.EVENT,    icon: '🃏', zone: 4, eventType: EVENT_TYPE.FATE, desc: '命运卡', gx: 0, gy: 5 },
    { id: 43, name: '关卡',     type: TILE_TYPE.FUNC,     icon: '🛃', zone: 4, funcType: FUNC_TYPE.CHECKPOINT, taxRate: 0.03, taxMin: 100, gx: 0, gy: 4 },
    { id: 44, name: '密会所',   type: TILE_TYPE.EROTIC,   icon: '🎭', zone: 4, desc: '终极涩情场所', gx: 0, gy: 3 },
    { id: 45, name: '海居',     type: TILE_TYPE.PROPERTY, icon: '⛵', zone: 4, desc: '可购买的分基地', propertyCost: 8000, gx: 0, gy: 2 },
    { id: 47, name: '码头',     type: TILE_TYPE.FUNC,     icon: '🚢', zone: 4, funcType: FUNC_TYPE.DOCK, gx: 0, gy: 1 },
    // 分支A: 冒险路线 (8→49→50→51→56→57→16)
    { id: 49, name: '占卜屋',   type: TILE_TYPE.SCENE,    icon: '🔮', zone: 2, desc: '偷看命运', gx: 7, gy: 1 },
    { id: 50, name: '隐秘花园', type: TILE_TYPE.EROTIC,   icon: '🌹', zone: 2, desc: '隐蔽的涩情场所', gx: 7, gy: 2 },
    { id: 51, name: '迷宫通道', type: TILE_TYPE.SCENE,    icon: '🚣', zone: 2, desc: '幽暗的地下通道', gx: 7, gy: 3 },
    { id: 56, name: '幽灵酒吧', type: TILE_TYPE.SCENE,    icon: '👻', zone: 2, desc: '神秘的地下酒吧', gx: 7, gy: 4 },
    { id: 57, name: '秘密分岔', type: TILE_TYPE.EROTIC,   icon: '🔥', zone: 2, desc: '隐私的地下场所', gx: 8, gy: 4 },
    // 分支B: 暗巷路线 (32→53→54→55→59→41)
    { id: 53, name: '走私港',   type: TILE_TYPE.SCENE,    icon: '📦', zone: 3, desc: '非法交易/暗巷命运', gx: 2, gy: 8 },
    { id: 54, name: '幽会角',   type: TILE_TYPE.EROTIC,   icon: '💜', zone: 3, desc: '隐秘涩情约会', gx: 2, gy: 7 },
    { id: 55, name: '赏金猎人', type: TILE_TYPE.SCENE,    icon: '💰', zone: 4, desc: '悬赏任务/线索', gx: 2, gy: 6 },
    { id: 59, name: '幽暗集市', type: TILE_TYPE.SCENE,    icon: '🌙', zone: 4, desc: '地下集市/稀有商品', gx: 1, gy: 6 },
];

const MAP_EDGES = [
    [0,1],[1,2],[2,3],[3,4],[4,6],[6,7],[7,8],[8,10],
    [10,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,21],
    [21,24],[24,26],[26,27],[27,28],[28,29],[29,30],[30,31],[31,32],[32,34],
    [34,36],[36,39],[39,40],[40,41],[41,42],[42,43],[43,44],[44,45],[45,47],
    [47,0],
    [8,49],[49,50],[50,51],[51,56],[56,57],[57,16],
    [32,53],[53,54],[54,55],[55,59],[59,41],
];

const TILES = MAP_NODES;

const FATE_CARDS = [
    { id: 'fate_jackpot',   name: '彩票中奖',   effect: { chips: 1500 },  type: 'positive', fallbackText: '恭喜！你中了彩票，获得1500筹码！' },
    { id: 'fate_patron',    name: '贵人相助',   effect: { investDiscount: 0.5, duration: 1 }, type: 'positive', fallbackText: '一位贵人愿意资助你，下次据点投资半价！' },
    { id: 'fate_teleport',  name: '传送门',     effect: { teleportRandom: true }, type: 'neutral', fallbackText: '你踏入了一个传送门，被随机传送到了另一个地方。' },
    { id: 'fate_encounter', name: '艳遇',       effect: { teleportErotic: true, freeOnce: true }, type: 'special', fallbackText: '命运之手将你带到了一个暧昧的场所...' },
    { id: 'fate_secret',    name: '神秘邀请函', effect: { triggerHiddenEvent: true }, type: 'special', fallbackText: '你收到了一封神秘的邀请函...' },
    { id: 'fate_tax',       name: '税务稽查',   effect: { taxPercent: 0.10 }, type: 'negative', fallbackText: '税务稽查来了！缴纳总资产的10%。' },
    { id: 'fate_storm',     name: '暴风雨',     effect: { chips: -800 }, type: 'negative', fallbackText: '暴风雨来袭，紧急避难花了不少钱！-800筹码。' },
    { id: 'fate_fame',      name: '口碑传播',   effect: { chips: 500 }, type: 'positive', fallbackText: '你的名声传开了，获得了一笔赞助！+500筹码' },
    { id: 'fate_windfall',  name: '意外之财',   effect: { chips: 800 }, type: 'positive', fallbackText: '路边捡到了一袋筹码，+800！' },
    { id: 'fate_oldfriend', name: '老朋友',     effect: { chips: 500, triggerOldFriend: true }, type: 'positive', fallbackText: '一位曾经认识的NPC找上了你，带来了礼物和消息。' },
];

const CHANCE_CARDS = [
    { id: 'chance_invest',  name: '投资机会', options: [
        { label: '投资1000（60%概率得2500）', effect: { gamble: { cost: 1000, reward: 2500, chance: 0.6 } } },
        { label: '放弃', effect: {} },
    ], type: 'decision', fallbackText: '一个投资机会摆在你面前...' },
    { id: 'chance_tempt',   name: '诱惑之门', options: [
        { label: '进入（触发涩情事件，消费500）', effect: { chips: -500, triggerErotic: true } },
        { label: '走开', effect: {} },
    ], type: 'decision', fallbackText: '你看到了一扇半掩的门，里面传来暧昧的声音...' },
    { id: 'chance_gamble',  name: '赌徒挑战', options: [
        { label: '和庄家玩一局', effect: { triggerMiniGame: 'blackjack' } },
        { label: '拒绝', effect: {} },
    ], type: 'decision', fallbackText: '一个赌徒向你发起了挑战...' },
    { id: 'chance_beauty',  name: '美人的请求', options: [
        { label: '帮忙（-300筹码，好感+后续）', effect: { chips: -300, triggerFollowUp: true } },
        { label: '拒绝', effect: {} },
    ], type: 'decision', fallbackText: '一位美丽的陌生人向你求助...' },
    { id: 'chance_buyout',  name: '据点并购', options: [
        { label: '花2000立即提升当前据点1级', effect: { chips: -2000, upgradeCurrentOutpost: 1 } },
        { label: '放弃', effect: {} },
    ], type: 'decision', fallbackText: '有人提议你收购附近的一个据点...' },
];

const ITEMS = {
    '指定骰':     { price: 500, desc: '下次可选择骰子点数',       icon: '🎯' },
    '传送卷轴':   { price: 400, desc: '随机传送到一个格子',       icon: '📜' },
    '翻倍水晶':   { price: 500, desc: '下次正面收益翻倍',         icon: '💎' },
    '护盾':       { price: 300, desc: '下次负面效果免除',         icon: '🛡️' },
    'VIP邀请函':  { price: 800, desc: '任意涩情地点解锁VIP场景',  icon: '💌' },
    '红酒':       { price: 150, desc: '涩情地点使用，提升场景尺度', icon: '🍷' },
    '命运之眼':   { price: 200, desc: '偷看下一张卡牌',           icon: '🔮' },
    '神秘药水':   { price: 600, desc: '涩情场景中使用，触发特殊效果', icon: '💊', blackmarket: true },
    '万能钥匙':   { price: 1000, desc: '解锁任意据点的隐藏房间',     icon: '🗝️', blackmarket: true },
    '变装道具':   { price: 400, desc: '涩情场景中切换角色扮演主题',   icon: '🎭', blackmarket: true },
};

const DIVIDEND_CYCLE = 5;

// --- 节点索引与邻接表 ---
const _nodeMap = new Map();
for (const node of MAP_NODES) _nodeMap.set(node.id, node);
const _adjList = new Map();
for (const [from, to] of MAP_EDGES) {
    if (!_adjList.has(from)) _adjList.set(from, []);
    _adjList.get(from).push(to);
}

function getTile(id) { return _nodeMap.get(id) || null; }
function getTileZone(id) { const t = getTile(id); return t ? ZONES.find(z => z.id === t.zone) || null : null; }
function getNextNodes(nodeId) { return _adjList.get(nodeId) || []; }
function isBranchNode(nodeId) { return getNextNodes(nodeId).length > 1; }

function walkSteps(startId, steps) {
    if (steps <= 0) return { paths: [[startId]], needsChoice: false, choiceAt: null };
    let current = startId;
    const walked = [current];
    for (let i = 0; i < steps; i++) {
        const nexts = getNextNodes(current);
        if (nexts.length === 0) { break; }
        else if (nexts.length === 1) { current = nexts[0]; walked.push(current); }
        else {
            const remainingSteps = steps - i;
            const branches = nexts.map(nextId => {
                const sub = walkSteps(nextId, remainingSteps - 1);
                return { firstNode: nextId, ...sub, walkedBefore: [...walked] };
            });
            return { paths: branches, needsChoice: true, choiceAt: current, stepsWalked: i, walkedBefore: [...walked] };
        }
    }
    return { paths: [walked], needsChoice: false, choiceAt: null };
}

function walkAlongPath(startId, steps, chosenNextAtBranch) {
    const walked = [startId]; let current = startId;
    for (let i = 0; i < steps; i++) {
        const nexts = getNextNodes(current);
        if (nexts.length === 0) break;
        if (nexts.length === 1) { current = nexts[0]; }
        else { current = (chosenNextAtBranch && chosenNextAtBranch[current] !== undefined) ? chosenNextAtBranch[current] : nexts[0]; }
        walked.push(current);
    }
    return walked;
}

function checkPassedStart(walkPath) { return walkPath.slice(1).includes(0); }
function getAllNodes() { return MAP_NODES; }
function getAllEdges() { return MAP_EDGES; }

function getOutpostLevel(outpostData) {
    if (!outpostData) return OUTPOST_LEVELS[0];
    return OUTPOST_LEVELS[outpostData.等级] || OUTPOST_LEVELS[0];
}

function canUpgradeOutpost(outpostData, chips) {
    if (!outpostData) return { canUpgrade: true, nextLevel: OUTPOST_LEVELS[1] };
    const currentLevel = outpostData.等级 || 0;
    if (currentLevel >= 3) return { canUpgrade: false, reason: '已达最高等级' };
    const nextLevel = OUTPOST_LEVELS[currentLevel + 1];
    const meetsVisits = outpostData.光顾次数 >= nextLevel.visitReq;
    const meetsInvest = (outpostData.投资额 || 0) >= nextLevel.investReq;
    const canAfford = chips >= (nextLevel.investReq - (outpostData.投资额 || 0));
    return { canUpgrade: meetsVisits || canAfford, nextLevel, meetsVisits, meetsInvest, investNeeded: Math.max(0, nextLevel.investReq - (outpostData.投资额 || 0)) };
}

function drawFateCard() { return FATE_CARDS[Math.floor(Math.random() * FATE_CARDS.length)]; }
function drawChanceCard() { return CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)]; }

// ==================== MVU 状态管理（官方API） ====================
// 参考: https://github.com/StageDog/tavern_resource/.cursor/rules/mvu变量框架.mdc
// 读取: Mvu.getMvuData({type:'message', message_id:-1}) → _.get(vars, 'stat_data')
// 写入: Mvu.replaceMvuData(vars, {type:'message', message_id:-1})

const DEFAULT_MONOPOLY = { 筹码: 5000, 回合: 0, 位置: 0, 据点: {}, 队伍: [], 道具: {}, 最近事件: [] };

function _getMessageOption() {
    return { type: 'message', message_id: -1 };
}

function _readMvuVars() {
    try {
        const Mvu = window.parent?.Mvu;
        if (!Mvu?.getMvuData) return null;
        return Mvu.getMvuData(_getMessageOption());
    } catch (e) { return null; }
}

function _writeMvuVars(vars) {
    try {
        const Mvu = window.parent?.Mvu;
        if (!Mvu?.replaceMvuData) {
            console.warn('[大富翁] Mvu.replaceMvuData 不可用');
            return false;
        }
        Mvu.replaceMvuData(vars, _getMessageOption());
        return true;
    } catch (e) {
        console.warn('[大富翁] writeMvuVars failed:', e);
        return false;
    }
}

function getMonopolyState() {
    const vars = _readMvuVars();
    const data = _.get(vars, 'stat_data', {});
    return data.大富翁 || { ...DEFAULT_MONOPOLY };
}

function getSubBases() {
    const vars = _readMvuVars();
    const data = _.get(vars, 'stat_data', {});
    return data.分基地 || {};
}

function getTenantList() {
    const vars = _readMvuVars();
    const data = _.get(vars, 'stat_data', {});
    return data.租客列表 || {};
}

function updateState(updater) {
    const vars = _readMvuVars();
    if (!vars) { console.warn('[大富翁] updateState: MVU变量不可用'); return; }
    // 确保 stat_data.大富翁 存在
    if (!_.has(vars, 'stat_data.大富翁')) {
        _.set(vars, 'stat_data.大富翁', { ...DEFAULT_MONOPOLY });
    }
    const monopolyData = _.get(vars, 'stat_data.大富翁');
    updater(monopolyData);
    // 写回
    _writeMvuVars(vars);
}

function updateSubBases(updater) {
    const vars = _readMvuVars();
    if (!vars) return;
    if (!_.has(vars, 'stat_data.分基地')) {
        _.set(vars, 'stat_data.分基地', {});
    }
    updater(_.get(vars, 'stat_data.分基地'));
    _writeMvuVars(vars);
}

// ==================== 骰子 ====================
function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

// ==================== Canvas 棋盘渲染引擎（2.5D等轴方块） ====================
// 菱形格子边挨边，3D凸起方块（顶面+侧面），emoji在格子上

// --- 相机状态 ---
const camera = { x: 0, y: 0, zoom: 1, minZoom: 0.2, maxZoom: 3 };
let isDragging = false, dragStart = { x: 0, y: 0 }, cameraStart = { x: 0, y: 0 };
let canvasEl = null, canvasCtx = null;
let _canvasW = 0, _canvasH = 0;
let _animPlayerPos = null; // {wx, wy} 世界坐标
let _highlightNodes = [];
let _lastCanvasState = null;
let manualZoneOverride = false; // 手动切换区域视角时为true，掷骰后自动重置
let _canvasEverInited = false;   // 模块级：canvas是否已首次初始化过
let _canvasNeedFirstCenter = true; // 模块级：是否需要首次居中

// 等轴绘制常量
const ISO_HW = 32;       // 菱形半宽（世界坐标）
const ISO_HH = 16;       // 菱形半高
const BLOCK_DEPTH = 10;  // 方块侧面高度
const HIT_RADIUS = 24;   // 命中检测半径
const MAP_PADDING = 60;  // 视口边缘留白

// Retro-Futurism 霓虹暗色主题（方便创意工坊换肤）
const TILE_COLOR = { top: '#3A5F8E', left: '#2D4F75', right: '#335580', stroke: '#6BA8E0', glow: 'rgba(107,168,224,0.25)' };
const TILE_COLOR_BRANCH = { top: '#2A6B6B', left: '#1E5A5A', right: '#236363', stroke: '#5CD6D6', glow: 'rgba(92,214,214,0.25)' };

// 网格坐标 → 等轴世界坐标
function gridToWorld(gx, gy) {
    return {
        wx: (gx - gy) * ISO_HW,
        wy: (gx + gy) * ISO_HH,
    };
}

// 世界坐标 → 屏幕像素
function worldToScreen(wx, wy) {
    return {
        sx: (wx + camera.x) * camera.zoom + _canvasW / 2,
        sy: (wy + camera.y) * camera.zoom + _canvasH / 2,
    };
}
function screenToWorld(sx, sy) {
    return {
        wx: (sx - _canvasW / 2) / camera.zoom - camera.x,
        wy: (sy - _canvasH / 2) / camera.zoom - camera.y,
    };
}

// 节点 → 屏幕坐标（便捷）
function nodeToScreen(node) {
    const { wx, wy } = gridToWorld(node.gx, node.gy);
    return worldToScreen(wx, wy);
}

// 命中测试
function hitTestNode(sx, sy) {
    if (!MAP_NODES) return null;
    const { wx, wy } = screenToWorld(sx, sy);
    const r2 = HIT_RADIUS * HIT_RADIUS;
    // 从前到后（gy大的在前面），倒序检查
    const sorted = [...MAP_NODES].sort((a, b) => (b.gx + b.gy) - (a.gx + a.gy));
    for (const n of sorted) {
        const nw = gridToWorld(n.gx, n.gy);
        const dx = wx - nw.wx, dy = wy - nw.wy;
        if (dx * dx + dy * dy <= r2) return n;
    }
    return null;
}

function centerOnNode(nodeId) {
    const node = getTile(nodeId);
    if (!node) return;
    const { wx, wy } = gridToWorld(node.gx, node.gy);
    camera.x = -wx;
    camera.y = -wy;
    if (canvasEl) requestCanvasRedraw();
}

function fitAllNodes() {
    if (!MAP_NODES || MAP_NODES.length === 0) return;
    let minWx = Infinity, maxWx = -Infinity, minWy = Infinity, maxWy = -Infinity;
    for (const n of MAP_NODES) {
        const { wx, wy } = gridToWorld(n.gx, n.gy);
        if (wx < minWx) minWx = wx;
        if (wx > maxWx) maxWx = wx;
        if (wy < minWy) minWy = wy;
        if (wy > maxWy) maxWy = wy;
    }
    const mapW = maxWx - minWx + MAP_PADDING * 2;
    const mapH = maxWy - minWy + MAP_PADDING * 2 + BLOCK_DEPTH * 2;
    camera.zoom = Math.min(_canvasW / mapW, _canvasH / mapH, camera.maxZoom);
    camera.zoom = Math.max(camera.zoom, camera.minZoom);
    camera.x = -(minWx + maxWx) / 2;
    camera.y = -(minWy + maxWy) / 2;
}

// --- 绘制调度 ---
let _redrawScheduled = false;
function requestCanvasRedraw() {
    if (_redrawScheduled) return;
    _redrawScheduled = true;
    requestAnimationFrame(() => {
        _redrawScheduled = false;
        drawCanvas(_lastCanvasState || getMonopolyState());
    });
}

// 计算节点“外侧”方向（建筑物放置位置）
function getOutsideDir(node) {
    const { gx, gy } = node;
    if (gy === 0)  return { dx: 0, dy: -1 };  // 顶排→上
    if (gx === 9)  return { dx: 1, dy: 0 };   // 右列→右
    if (gy === 9)  return { dx: 0, dy: 1 };   // 底排→下
    if (gx === 0)  return { dx: -1, dy: 0 };  // 左列→左
    // 分支B桥接(gx=1,内部)→上，避免与gx=2/gx=0节点重叠
    if (node.id >= 48 && gx === 1 && gy > 0 && gy < 9) return { dx: 0, dy: -1 };
    // 分支A桥接(gx=8,内部)→下，避免与gx=7/gx=9节点重叠
    if (node.id >= 48 && gx === 8 && gy > 0 && gy < 9) return { dx: 0, dy: 1 };
    // 分支A(gx=7)→左侧, 分支B(gx=2)→右侧
    if (gx >= 7) return { dx: -1, dy: 0 };
    if (gx <= 2) return { dx: 1, dy: 0 };
    return { dx: 0, dy: -1 };
}

// --- 主绘制 ---
function drawCanvas(state) {
    if (!canvasCtx || !MAP_NODES || !MAP_EDGES) return;
    _lastCanvasState = state;
    const ctx = canvasCtx;
    const w = _canvasW, h = _canvasH;

    const dpr = window.devicePixelRatio || 1;
    if (canvasEl.width !== w * dpr || canvasEl.height !== h * dpr) {
        canvasEl.width = w * dpr;
        canvasEl.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, w, h);

    // 背景 — 深空霓虹
    const bgGrad = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h / 2, Math.max(w, h));
    bgGrad.addColorStop(0, '#F5ECD0');
    bgGrad.addColorStop(0.6, '#EDE3C4');
    bgGrad.addColorStop(1, '#E0D5B0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const subBases = getSubBases();
    const playerPos = state.位置 || 0;
    const zm = camera.zoom;
    const hw = ISO_HW * zm;   // 屏幕半宽
    const hh = ISO_HH * zm;   // 屏幕半高
    const bd = BLOCK_DEPTH * zm; // 屏幕侧面高

    // === 分支路径高亮连接线 ===
    ctx.save();
    for (const [fromId, toId] of MAP_EDGES) {
        if (fromId < 48 && toId < 48) continue; // 只画分支相关边
        const fromN = getTile(fromId), toN = getTile(toId);
        if (!fromN || !toN) continue;
        const f = nodeToScreen(fromN), t = nodeToScreen(toN);

        // 霓虹发光底层
        ctx.beginPath();
        ctx.moveTo(f.sx, f.sy); ctx.lineTo(t.sx, t.sy);
        ctx.strokeStyle = 'rgba(0,206,209,0.1)';
        ctx.lineWidth = 16 * zm; ctx.lineCap = 'round';
        ctx.setLineDash([]); ctx.stroke();

        // 青色虚线主体
        ctx.beginPath();
        ctx.moveTo(f.sx, f.sy); ctx.lineTo(t.sx, t.sy);
        ctx.strokeStyle = 'rgba(0,255,255,0.6)';
        ctx.lineWidth = 2 * zm;
        ctx.setLineDash([6 * zm, 4 * zm]); ctx.stroke();

        // 方向箭头
        const mx = (f.sx + t.sx) / 2, my = (f.sy + t.sy) / 2;
        const ang = Math.atan2(t.sy - f.sy, t.sx - f.sx);
        const as = 5 * zm;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(ang) * as, my + Math.sin(ang) * as);
        ctx.lineTo(mx + Math.cos(ang + 2.5) * as, my + Math.sin(ang + 2.5) * as);
        ctx.lineTo(mx + Math.cos(ang - 2.5) * as, my + Math.sin(ang - 2.5) * as);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,255,255,0.85)';
        ctx.fill();
    }
    ctx.setLineDash([]);
    // 分支入口标签（已移除文字，保留数据备用）
    const branchLabels = [];
    for (const bl of branchLabels) {
        const n = getTile(bl.nodeId);
        if (!n) continue;
        const { sx: bsx, sy: bsy } = nodeToScreen(n);
        const lfs = Math.max(8, 10 * zm);
        ctx.font = `bold ${lfs}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,20,20,0.75)';
        const tw3 = ctx.measureText(bl.text).width + 8;
        const blx = bsx, bly = bsy - hh - 12 * zm;
        const brx = blx - tw3 / 2, bry = bly - lfs / 2 - 2, brw = tw3, brh = lfs + 4;
        ctx.beginPath();
        ctx.moveTo(brx + 3, bry);
        ctx.lineTo(brx + brw - 3, bry);
        ctx.quadraticCurveTo(brx + brw, bry, brx + brw, bry + 3);
        ctx.lineTo(brx + brw, bry + brh - 3);
        ctx.quadraticCurveTo(brx + brw, bry + brh, brx + brw - 3, bry + brh);
        ctx.lineTo(brx + 3, bry + brh);
        ctx.quadraticCurveTo(brx, bry + brh, brx, bry + brh - 3);
        ctx.lineTo(brx, bry + 3);
        ctx.quadraticCurveTo(brx, bry, brx + 3, bry);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#00FFFF';
        ctx.shadowColor = 'rgba(0,255,255,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(bl.text, blx, bly);
        ctx.shadowBlur = 0;
    }
    ctx.restore();

    // z排序：gx+gy 小的先画（在后面）
    const sortedNodes = [...MAP_NODES].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    const levelIcons = ['', '⭐', '💎', '👑'];

    for (const node of sortedNodes) {
        const { sx, sy } = nodeToScreen(node);

        // 视口裁剪
        if (sx + hw + bd < 0 || sx - hw > w || sy + hh + bd * 2 < 0 || sy - hh - bd > h) continue;

        const isPlayer = node.id === playerPos;
        const isHighlight = _highlightNodes.includes(node.id);
        const outpost = state.据点?.[String(node.id)];
        const level = outpost ? outpost.等级 : 0;
        const zc = node.id >= 48 ? TILE_COLOR_BRANCH : TILE_COLOR;
        const isOwned = node.type === TILE_TYPE?.PROPERTY && subBases[node.name];

        ctx.save();

        // ---- 方块霓虹投影 ----
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(sx, sy - hh + 3 * zm);
        ctx.lineTo(sx + hw, sy + 3 * zm);
        ctx.lineTo(sx, sy + hh + bd + 5 * zm);
        ctx.lineTo(sx - hw, sy + bd + 3 * zm);
        ctx.closePath();
        ctx.fillStyle = zc.glow || '#000';
        ctx.fill();
        ctx.restore();

        // ---- 左侧面 ----
        ctx.beginPath();
        ctx.moveTo(sx - hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx, sy + hh + bd);
        ctx.lineTo(sx - hw, sy + bd);
        ctx.closePath();
        ctx.fillStyle = zc.left;
        ctx.fill();
        ctx.strokeStyle = zc.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // ---- 右侧面 ----
        ctx.beginPath();
        ctx.moveTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx, sy + hh + bd);
        ctx.lineTo(sx + hw, sy + bd);
        ctx.closePath();
        ctx.fillStyle = zc.right;
        ctx.fill();
        ctx.strokeStyle = zc.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // ---- 顶面（菱形） ----
        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.fillStyle = zc.top;
        ctx.fill();
        ctx.strokeStyle = zc.stroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 顶面高光（左上三角）+ 霓虹边缘
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx - hw, sy);
        ctx.lineTo(sx, sy);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.restore();

        // 霓虹边缘辉光
        ctx.save();
        ctx.shadowColor = zc.glow || 'transparent';
        ctx.shadowBlur = 8 * zm;
        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        ctx.strokeStyle = zc.stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();

        // ---- 分支格子青色辉光描边 ----
        if (node.id >= 48) {
            ctx.save();
            ctx.shadowColor = 'rgba(0,255,255,0.5)';
            ctx.shadowBlur = 10 * zm;
            ctx.beginPath();
            ctx.moveTo(sx, sy - hh);
            ctx.lineTo(sx + hw, sy);
            ctx.lineTo(sx, sy + hh);
            ctx.lineTo(sx - hw, sy);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        }

        // ---- 当前位置/高亮 ----
        if (isPlayer) {
            ctx.beginPath();
            ctx.moveTo(sx, sy - hh - 3 * zm);
            ctx.lineTo(sx + hw + 3 * zm, sy);
            ctx.lineTo(sx, sy + hh + 3 * zm);
            ctx.lineTo(sx - hw - 3 * zm, sy);
            ctx.closePath();
            ctx.shadowColor = 'rgba(124,58,237,0.9)';
            ctx.shadowBlur = 18 * zm;
            ctx.strokeStyle = '#A78BFA';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        if (isHighlight) {
            ctx.beginPath();
            ctx.moveTo(sx, sy - hh - 2 * zm);
            ctx.lineTo(sx + hw + 2 * zm, sy);
            ctx.lineTo(sx, sy + hh + 2 * zm);
            ctx.lineTo(sx - hw - 2 * zm, sy);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0,255,255,0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 等级光晕
        if (level > 0) {
            const gc = ['', 'rgba(251,191,36,0.6)', 'rgba(129,140,248,0.6)', 'rgba(244,114,182,0.7)'];
            ctx.beginPath();
            ctx.moveTo(sx, sy - hh - (2 + level) * zm);
            ctx.lineTo(sx + hw + (2 + level) * zm, sy);
            ctx.lineTo(sx, sy + hh + (2 + level) * zm);
            ctx.lineTo(sx - hw - (2 + level) * zm, sy);
            ctx.closePath();
            ctx.strokeStyle = gc[level] || '';
            ctx.lineWidth = 1.5 + level * 0.5;
            ctx.stroke();
        }

        // 事件/功能图标 → 印章效果（等轴变换压在格子面上）
        const isBuilding = node.type === TILE_TYPE.SCENE || node.type === TILE_TYPE.EROTIC || node.type === TILE_TYPE.PROPERTY;
        if (!isBuilding) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.transform(1, 0.5, -1, 0.5, 0, 0);
            ctx.globalAlpha = 0.88;
            const emojiSize = Math.max(14, 22 * zm);
            ctx.font = `${emojiSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.icon, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }

    // ========== 第二遍: 建筑/图标/标记（始终在所有格子上层） ==========
    for (const node of sortedNodes) {
        const { sx, sy } = nodeToScreen(node);
        if (sx + hw + bd < 0 || sx - hw > w || sy + hh + bd * 2 < 0 || sy - hh - bd > h) continue;

        const isBuilding = node.type === TILE_TYPE.SCENE || node.type === TILE_TYPE.EROTIC || node.type === TILE_TYPE.PROPERTY;
        if (!isBuilding) continue; // 非建筑已在第一遍画过图标

        const bldgImg = getNodeBldgImg(node.id);
        const dir = getOutsideDir(node);
        const offScale = 1.04;
        const { wx: nwx, wy: nwy } = gridToWorld(node.gx, node.gy);
        const bWx = nwx + (dir.dx - dir.dy) * ISO_HW * offScale;
        const bWy = nwy + (dir.dx + dir.dy) * ISO_HH * offScale;
        const bs = worldToScreen(bWx, bWy);

        if (bldgImg) {
            // 建筑立式图片
            ctx.fillStyle = 'rgba(124,58,237,0.12)';
            ctx.beginPath();
            ctx.ellipse(bs.sx, bs.sy + 2 * zm, 8 * zm, 4 * zm, 0, 0, Math.PI * 2);
            ctx.fill();
            const imgH = 68 * zm;
            const imgW = imgH;
            ctx.drawImage(bldgImg, bs.sx - imgW / 2, bs.sy - imgH + 20 * zm, imgW, imgH);
        } else {
            // 无图片建筑: emoji立式
            ctx.fillStyle = 'rgba(124,58,237,0.15)';
            ctx.beginPath();
            ctx.ellipse(bs.sx, bs.sy + 3 * zm, 9 * zm, 3.5 * zm, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = `${Math.max(16, 24 * zm)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.icon, bs.sx, bs.sy - 5 * zm);
        }

        // 标记图标
        const outpost = state.据点?.[String(node.id)];
        const level = outpost ? outpost.等级 : 0;
        const isOwned = node.type === TILE_TYPE?.PROPERTY && subBases[node.name];
        if (level > 0) {
            ctx.font = `${10 * zm}px serif`;
            ctx.textBaseline = 'bottom';
            ctx.textAlign = 'center';
            ctx.fillText(levelIcons[level], sx + hw * 0.5, sy - hh - 2 * zm);
        }
        if (isOwned) {
            ctx.font = `${9 * zm}px serif`;
            ctx.textBaseline = 'bottom';
            ctx.textAlign = 'center';
            ctx.fillText('🏠', sx - hw * 0.5, sy - hh - 2 * zm);
        }
        if (isBranchNode && isBranchNode(node.id)) {
            ctx.font = `${10 * zm}px serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText('⚡', sx + hw * 0.7, sy - hh * 0.3);
        }
    }

    // === 玩家棋子（正方形头像） ===
    const playerNode = getTile(playerPos);
    if (playerNode) {
        const pw = _animPlayerPos || gridToWorld(playerNode.gx, playerNode.gy);
        const { sx, sy } = worldToScreen(pw.wx, pw.wy);
        const sz = hw * 0.75;
        const pulse = Math.sin(Date.now() / 400) * 0.04 + 1;
        const psz = sz * pulse;
        const pieceY = sy - hh * 0.8;

        ctx.save();

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 * zm, psz * 0.6, psz * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // 正方形背景+头像
        const x0 = sx - psz, y0 = pieceY - psz;
        const side = psz * 2;
        const radius = 4 * zm;

        if (_userAvatarImg) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x0, y0, side, side, radius);
            ctx.clip();
            ctx.drawImage(_userAvatarImg, x0, y0, side, side);
            ctx.restore();
        } else {
            const pg = ctx.createLinearGradient(x0, y0, x0 + side, y0 + side);
            pg.addColorStop(0, '#6BA8E0');
            pg.addColorStop(1, '#3A5F8E');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.roundRect(x0, y0, side, side, radius);
            ctx.fill();
        }

        // 描边 + 辉光
        ctx.beginPath();
        ctx.roundRect(x0, y0, side, side, radius);
        ctx.shadowColor = 'rgba(107,168,224,0.8)';
        ctx.shadowBlur = 10 * zm;
        ctx.strokeStyle = '#A0C8F0';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore();
    }
}

// --- Canvas 事件绑定 ---
function setupCanvasEvents(canvas) {
    // 鼠标/触控拖拽
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX - rect.left, y: e.changedTouches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // 双指缩放状态
    let pinchStartDist = 0, pinchStartZoom = 1;

    const onDown = (e) => {
        isDragging = true;
        dragStart = getPos(e);
        cameraStart = { x: camera.x, y: camera.y };
        e.preventDefault();
    };
    const onMove = (e) => {
        if (!isDragging) return;
        const pos = getPos(e);
        const dx = (pos.x - dragStart.x) / camera.zoom;
        const dy = (pos.y - dragStart.y) / camera.zoom;
        camera.x = cameraStart.x + dx;
        camera.y = cameraStart.y + dy;
        requestCanvasRedraw();
        e.preventDefault();
    };
    const onUp = (e) => {
        if (!isDragging) return;
        const pos = getPos(e);
        const dist = Math.abs(pos.x - dragStart.x) + Math.abs(pos.y - dragStart.y);
        isDragging = false;
        // 短距离视为点击
        if (dist < 5) {
            const node = hitTestNode(pos.x, pos.y);
            if (node) onNodeClick(node);
        }
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', () => { isDragging = false; });
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // 双指缩放开始
            isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDist = Math.sqrt(dx * dx + dy * dy);
            pinchStartZoom = camera.zoom;
            e.preventDefault();
            return;
        }
        onDown(e);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStartDist > 0) {
            // 双指缩放中
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = dist / pinchStartDist;
            camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, pinchStartZoom * scale));
            requestCanvasRedraw();
            e.preventDefault();
            return;
        }
        onMove(e);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) pinchStartDist = 0;
        onUp(e);
    });

    // 滚轮缩放
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        camera.zoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, camera.zoom * factor));
        requestCanvasRedraw();
    }, { passive: false });
}

// 节点点击：当前位置可操作，非当前位置只能查看信息
function onNodeClick(node) {
    if (!node) return;
    const state = getMonopolyState();
    const isCurrentTile = (state.位置 || 0) === node.id;

    if (isCurrentTile && (node.type === TILE_TYPE.SCENE || node.type === TILE_TYPE.EROTIC)) {
        // 当前位置：完整场景面板（可进入/升级/招募）
        showScenePanel(node, state);
    } else if (node.type === TILE_TYPE.SCENE || node.type === TILE_TYPE.EROTIC) {
        // 非当前位置：只读信息面板（可查看据点等级/升级进度，不可操作）
        showTileInfoPanel(node, state);
    } else {
        // 其他格子类型：日志中显示简要信息
        addLog(`📍 ${node.icon} ${node.name}${node.desc ? '：' + node.desc : ''}`);
    }
}

// 只读信息面板：查看格子信息和据点进度，不能操作
function showTileInfoPanel(tile, state) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const outpost = state.据点?.[String(tile.id)] || { 光顾次数: 0, 投资额: 0, 等级: 0 };
    const levelInfo = getOutpostLevel(outpost);
    const upgradeInfo = canUpgradeOutpost(outpost, state.筹码 || 0);

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:320px;">`;
    html += `<div class="mp-scene-header">${tile.icon} ${tile.name}</div>`;
    html += `<div class="mp-scene-desc">${tile.desc || '一个有趣的地方'}</div>`;

    // 据点信息
    html += `<div class="mp-outpost-info">`;
    html += `<div class="mp-outpost-level">`;
    html += `<span class="mp-outpost-badge mp-outpost-lv${outpost.等级 || 0}">${levelInfo.name}</span>`;
    html += `<span style="font-size:11px;color:#6B7280;">Lv.${outpost.等级 || 0}</span>`;
    html += `</div>`;
    html += `<div class="mp-outpost-stats">`;
    html += `<span>👣 光顾 ${outpost.光顾次数 || 0}次</span>`;
    html += `<span>💰 已投资 ${outpost.投资额 || 0}</span>`;
    if (levelInfo.dividendPerCycle > 0) html += `<span>📈 分红 ${levelInfo.dividendPerCycle}/周期</span>`;
    if (levelInfo.discount > 0 && levelInfo.discount < 1) html += `<span>🏷️ ${Math.round(levelInfo.discount * 10)}折优惠</span>`;
    else if (levelInfo.discount === 0) html += `<span>🏷️ 免费消费</span>`;
    html += `</div>`;

    // 升级进度（只读）
    if (upgradeInfo.canUpgrade && upgradeInfo.nextLevel) {
        const next = upgradeInfo.nextLevel;
        const visitProgress = Math.min(outpost.光顾次数 || 0, next.visitReq);
        const investProgress = Math.min(outpost.投资额 || 0, next.investReq);
        html += `<div class="mp-outpost-upgrade">`;
        html += `<div style="font-size:12px;font-weight:700;margin-bottom:6px;">⬆️ 升级到 ${next.name} (Lv.${next.level})</div>`;
        html += `<div class="mp-progress-row">`;
        html += `<span class="mp-progress-label">👣 光顾</span>`;
        html += `<div class="mp-progress-bar"><div class="mp-progress-fill" style="width:${Math.round(visitProgress / next.visitReq * 100)}%;"></div></div>`;
        html += `<span class="mp-progress-text">${visitProgress}/${next.visitReq}</span>`;
        html += `</div>`;
        html += `<div class="mp-progress-row">`;
        html += `<span class="mp-progress-label">💰 投资</span>`;
        html += `<div class="mp-progress-bar"><div class="mp-progress-fill mp-progress-fill-gold" style="width:${Math.round(investProgress / next.investReq * 100)}%;"></div></div>`;
        html += `<span class="mp-progress-text">${investProgress}/${next.investReq}</span>`;
        html += `</div>`;
        html += `</div>`;
    } else if (outpost.等级 >= 3) {
        html += `<div style="text-align:center;padding:6px;font-size:11px;color:#F59E0B;">👑 已达最高等级：合伙人</div>`;
    }
    html += `</div>`;

    // 提示：需要到达才能操作
    html += `<div style="text-align:center;padding:8px;font-size:11px;color:#9CA3AF;border-top:1px solid #E5E7EB;margin-top:8px;">📍 需要到达此格子才能进入场景或升级</div>`;

    html += `<div class="mp-scene-options">`;
    html += `<button class="mp-btn" data-action="info-close">关闭</button>`;
    html += `</div></div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (btn && btn.dataset.action === 'info-close') overlay.remove();
    });
}

// ==================== 棋盘HTML渲染（包裹Canvas） ====================
function renderBoard(state) {
    let html = '';

    // 统计栏
    html += `<div class="mp-board-stats">
        <span class="mp-stats-item"><img src="${PIXEL_ASSETS.chip}" style="width:14px;height:14px;image-rendering:pixelated;vertical-align:-2px;"> ${state.筹码 || 0}</span>
        <span class="mp-stats-item">🎲 第${state.回合 || 0}回合</span>
        <button class="mp-canvas-btn" onclick="window._mpAction('zoom-out')" title="缩小">➖</button>
        <button class="mp-canvas-btn" onclick="window._mpAction('zoom-in')" title="放大">➕</button>
        <button class="mp-canvas-btn" onclick="window._mpAction('fit-map')" title="适配地图">🗺️</button>
        <button class="mp-canvas-btn" onclick="window._mpAction('center-player')" title="居中玩家">📍</button>
        <button class="mp-canvas-btn" onclick="window._mpAction('close')" title="关闭面板" style="margin-left:4px;background:rgba(239,68,68,0.2);color:#F87171;">✕</button>
    </div>`;

    // Canvas容器
    html += `<div class="mp-canvas-wrap"><canvas id="mp-graph-canvas"></canvas></div>`;

    return html;
}

// 停止Canvas动画循环（关闭面板/清理时调用，防止后台空转浪费性能）
function _stopCanvasAnimation() {
    if (canvasEl && canvasEl._cleanup) {
        canvasEl._cleanup();
        canvasEl._cleanup = null;
        console.log('[大富翁] Canvas动画循环已停止');
    }
}

// 初始化Canvas（renderPanel之后调用）
function initCanvasAfterRender() {
    const doc = getTargetDoc();
    const cvs = doc.getElementById('mp-graph-canvas');
    if (!cvs) return;

    // 清理上一个Canvas的动画循环
    if (canvasEl && canvasEl._cleanup) canvasEl._cleanup();

    canvasEl = cvs;
    canvasCtx = cvs.getContext('2d');

    // 设置尺寸
    const wrap = cvs.parentElement;
    _canvasW = wrap.clientWidth || 380;
    _canvasH = wrap.clientHeight || 400;
    cvs.style.width = _canvasW + 'px';
    cvs.style.height = _canvasH + 'px';

    // 首次初始化时适配并居中，后续重渲染保留用户视角
    if (!_canvasEverInited) {
        fitAllNodes();
        _canvasEverInited = true;
    }

    // 绑定事件
    setupCanvasEvents(cvs);

    // 绘制
    const state = getMonopolyState();
    drawCanvas(state);

    if (_canvasNeedFirstCenter) {
        _canvasNeedFirstCenter = false;
        centerOnNode(state.位置 || 0);
        drawCanvas(state);
    }

    // 持续动画（玩家脉冲）
    let animLoop;
    const animate = () => {
        drawCanvas(_lastCanvasState || state);
        animLoop = requestAnimationFrame(animate);
    };
    animate();

    // 清理函数
    cvs._cleanup = () => { cancelAnimationFrame(animLoop); };
}

// ==================== 状态栏渲染 ====================
function renderStatus(state) {
    const tile = getTile(state.位置 || 0);

    // 计算租客总数（租客列表 + 分基地住户去重）
    const _tList = getTenantList();
    let _tenantCount = Object.keys(_tList).length;
    try {
        const _vars = _readMvuVars();
        const _sbData = _vars ? _.get(_vars, 'stat_data.分基地', {}) : {};
        const _seen = new Set(Object.keys(_tList));
        for (const [, base] of Object.entries(_sbData)) {
            for (const r of (base.住户 || [])) { if (!_seen.has(r)) { _seen.add(r); _tenantCount++; } }
        }
    } catch(e) {}

    // 收集激活中的buff
    const buffs = [];
    if (activeBuffs.指定骰) buffs.push({ icon: '🎯', name: '指定骰' });
    if (activeBuffs.翻倍水晶) buffs.push({ icon: '💎', name: '翻倍水晶' });
    if (activeBuffs.护盾) buffs.push({ icon: '🛡️', name: '护盾' });
    if (activeBuffs.VIP邀请函) buffs.push({ icon: '💌', name: 'VIP邀请函' });
    if (activeBuffs.红酒) buffs.push({ icon: '🍷', name: '红酒' });
    if (activeBuffs.命运之眼) buffs.push({ icon: '🔮', name: '命运之眼' });
    if (activeBuffs.神秘药水) buffs.push({ icon: '💊', name: '神秘药水' });
    if (activeBuffs.万能钥匙) buffs.push({ icon: '🗝️', name: '万能钥匙' });
    if (activeBuffs.变装道具) buffs.push({ icon: '🎭', name: '变装道具' });
    if (activeBuffs.免费体验) buffs.push({ icon: '🌟', name: '免费体验' });
    if (activeBuffs.投资折扣) buffs.push({ icon: '🤝', name: '投资半价' });

    const eroticLevel = state.涩情浓度 ?? 2;
    const eroticIcons = ['🚫', '🌸', '💋', '🔥', '🔞'];
    const eroticNames = ['关闭', '轻度', '中度', '重度', '极限'];
    const eroticIndicator = `<span class="mp-buff-tag" title="涩情浓度: ${eroticNames[eroticLevel]}" style="cursor:pointer;" onclick="window._mpAction('settings')">${eroticIcons[eroticLevel]}</span>`;

    return `<div class="mp-status">
        <div class="mp-status-cards" style="grid-template-columns:repeat(3,1fr);">
            <div class="mp-stat-card mp-stat-chips">
                <div class="mp-stat-icon"><img src="${PIXEL_ASSETS.chip}" style="width:18px;height:18px;image-rendering:pixelated;" draggable="false"></div>
                <div class="mp-stat-val">${state.筹码 || 0}</div>
                <div class="mp-stat-label">筹码</div>
            </div>
            <div class="mp-stat-card mp-stat-pos">
                <div class="mp-stat-icon">${tile?.icon || '📍'}</div>
                <div class="mp-stat-val" style="font-size:11px;">${tile?.name || '起点'}</div>
                <div class="mp-stat-label">位置</div>
            </div>
            <div class="mp-stat-card mp-stat-party">
                <div class="mp-stat-icon">👥</div>
                <div class="mp-stat-val">${_tenantCount}人</div>
                <div class="mp-stat-label">租客</div>
            </div>
        </div>
        <div class="mp-buff-bar">${buffs.map(b => `<span class="mp-buff-tag" title="${b.name}">${b.icon}</span>`).join('')}${eroticIndicator}</div>
    </div>`;
}

// ==================== 操作按钮渲染 ====================
function renderActions(state) {
    let html = '<div class="mp-actions">';
    if (_devMode) {
        html += `<div style="display:flex;gap:4px;align-items:center;">`;
        html += `<input type="number" id="mp-dev-steps" min="1" max="99" value="1" style="width:56px;padding:6px 8px;border:1.5px solid #7C3AED;border-radius:8px;font-size:13px;text-align:center;background:#1A1A2E;color:#E5E7EB;" />`;
        html += `<button class="mp-btn mp-btn-primary mp-btn-roll" onclick="window._mpAction('dev-move')" style="flex:1;">🛠️ 前进指定步数</button>`;
        html += `</div>`;
    } else {
        html += `<button class="mp-btn mp-btn-primary mp-btn-roll" onclick="window._mpAction('roll')">🎲 掷骰子</button>`;
    }
    html += `<button class="mp-btn mp-btn-ghost" onclick="window._mpAction('party')">👥 租客</button>`;
    html += `<button class="mp-btn mp-btn-ghost" onclick="window._mpAction('items')">🎒 道具</button>`;
    html += `<button class="mp-btn mp-btn-ghost" onclick="window._mpAction('recruit-npc')">🫂 招募</button>`;
    html += `<button class="mp-btn mp-btn-ghost" onclick="window._mpAction('sub-bases')">🏠 房产</button>`;
    html += `<button class="mp-btn mp-btn-ghost" onclick="window._mpAction('settings')">⚙️</button>`;
    // 重新进入该地点：仅当有上次场景提示词时显示
    if (_lastScenePrompt) {
        html += `<button class="mp-btn mp-btn-secondary" onclick="window._mpAction('reinject-scene')" style="width:100%;margin-top:4px;">🔄 重新进入该地点</button>`;
    }
    html += '</div>';
    return html;
}

// ==================== 骰子动画（像素骰子图片版） ====================
function renderDiceAnimation(value, callback) {
    const doc = getTargetDoc();

    function makeDiceImg(face) {
        return `<img src="${PIXEL_ASSETS.dice(face)}" style="width:80px;height:80px;image-rendering:pixelated;" draggable="false">`;
    }

    // 面板内overlay（相对面板定位）
    const panel = doc.getElementById(MP_PANEL_ID);
    const overlay = doc.createElement('div');
    overlay.id = 'mp-dice-overlay';
    overlay.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.7);z-index:20;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    `;

    // 骰子容器
    const diceBox = doc.createElement('div');
    diceBox.style.cssText = `
        width:100px;height:100px;background:#FFF;border-radius:16px;
        box-shadow:0 8px 30px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        transition:transform 0.1s;image-rendering:pixelated;
    `;
    diceBox.innerHTML = makeDiceImg(1);

    // 结果文字
    const resultText = doc.createElement('div');
    resultText.style.cssText = 'color:#FFF;font-size:24px;font-weight:800;opacity:0;transition:opacity 0.3s;text-shadow:0 2px 8px rgba(0,0,0,0.5);';

    overlay.appendChild(diceBox);
    overlay.appendChild(resultText);
    (panel || doc.body).appendChild(overlay);

    // 翻滚动画（setInterval切换骰子图片+CSS旋转）
    let count = 0;
    const maxCount = 15;
    const interval = setInterval(() => {
        count++;
        const randomFace = Math.floor(Math.random() * 6) + 1;
        diceBox.innerHTML = makeDiceImg(randomFace);

        // 随机旋转和位移
        const angle = (Math.random() - 0.5) * 30;
        const bounce = Math.sin(count * 0.5) * 10;
        const scale = 1 + Math.sin(count * 0.3) * 0.1;
        diceBox.style.transform = `rotate(${angle}deg) translateY(${bounce}px) scale(${scale})`;

        if (count >= maxCount) {
            clearInterval(interval);
            // 显示最终结果
            diceBox.innerHTML = makeDiceImg(value);
            diceBox.style.transform = 'rotate(0deg) translateY(0) scale(1.15)';
            resultText.textContent = `🎲 ${value} 点`;
            resultText.style.opacity = '1';

            // 停留后消失
            setTimeout(() => {
                overlay.style.transition = 'opacity 0.3s';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                    callback?.();
                }, 300);
            }, 1000);
        }
    }, 80);
}

// ==================== 主面板渲染 ====================
function renderPanel() {
    const state = getMonopolyState();
    isMoving = false; // 安全重置，防止动画异常卡死

    const panel = getTargetDoc().getElementById(MP_PANEL_ID);
    if (!panel) return;

    panel.innerHTML = `
        <div class="mp-header">
            <span class="mp-title">Monopoly</span>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="mp-header-close" onclick="window._mpAction('close')">✕</button>
            </div>
        </div>
        ${renderStatus(state)}
        ${renderBoard(state)}
        ${renderActions(state)}
        <div class="mp-log" id="mp-log"></div>
    `;

    // 初始化Canvas棋盘
    setTimeout(() => {
        initCanvasAfterRender();
    }, 30);

    // 首次进入时显示教程引导
    if (!tutorialShown && (state.回合 || 0) === 0) {
        tutorialShown = true;
        showTutorialOverlay();
    }
}

// ==================== 日志 ====================
function addLog(text) {
    const log = getTargetDoc().getElementById('mp-log');
    if (!log) return;
    const entry = getTargetDoc().createElement('div');
    entry.className = 'mp-log-entry';
    entry.textContent = `[回合${getMonopolyState().回合}] ${text}`;
    log.prepend(entry);
    // 保留最近20条
    while (log.children.length > 20) log.removeChild(log.lastChild);
}

// ==================== 开发者模式 ====================
let _devMode = false;
try { _devMode = localStorage.getItem(MP_PREFIX + 'devMode') === 'true'; } catch(e) {}

// ==================== 核心游戏逻辑：掷骰子+移动 ====================
let isMoving = false; // 防止移动动画期间重复掷骰
let tutorialShown = false; // 教程引导是否已显示

async function handleRoll() {
    console.log('[大富翁] handleRoll called, isMoving=', isMoving);
    if (isMoving) {
        console.warn('[大富翁] 正在移动中，忽略掷骰');
        return;
    }

    // 检查数据是否加载
    if (typeof walkSteps !== 'function') {
        console.error('[大富翁] walkSteps 未加载，数据加载可能失败');
        addLog('⚠️ 数据未加载，请刷新页面');
        return;
    }

    manualZoneOverride = false; // 掷骰后自动跟随玩家位置

    // 新回合开始：清理上一轮残留的场景指令
    clearSceneLore().catch(() => {});
    _pendingSceneLore = false;
    if (_sceneLoreSafetyTimer) { clearTimeout(_sceneLoreSafetyTimer); _sceneLoreSafetyTimer = null; }

    // 指定骰buff：弹出选择面板
    if (activeBuffs.指定骰) {
        activeBuffs.指定骰 = false;
        showDiceSelectPanel();
        return;
    }

    try {
        executeMove(rollDice());
    } catch (e) {
        console.error('[大富翁] handleRoll 异常:', e);
        isMoving = false;
        addLog('⚠️ 掷骰出错，请重试');
    }
}

// 指定骰选择面板
function showDiceSelectPanel() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:300px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">🎯</div>`;
    html += `<div class="mp-scene-header">指定骰</div>`;
    html += `<div class="mp-scene-desc">选择你想要的点数</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0;">`;
    for (let i = 1; i <= 6; i++) {
        html += `<button class="mp-btn mp-btn-primary" data-action="dice-pick" data-dice="${i}" style="font-size:20px;padding:12px;font-weight:800;">${i}</button>`;
    }
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    doc.getElementById('mp-scene-overlay').addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action="dice-pick"]');
        if (!btn) return;
        const dice = parseInt(btn.dataset.dice);
        doc.getElementById('mp-scene-overlay')?.remove();
        addLog(`🎯 指定骰：选择了 ${dice} 点`);
        executeMove(dice);
    });
}

// 确保玩家位置在有效节点上
function validatePlayerPos() {
    const state = getMonopolyState();
    const pos = state.位置 || 0;
    if (!getTile(pos)) {
        console.warn(`[大富翁] 位置 ${pos} 无效，重置到0`);
        updateState(s => { s.位置 = 0; });
        return 0;
    }
    return pos;
}

// 公共移动逻辑（掷骰和指定骰共用）— 图结构版
function executeMove(dice) {
    const oldPos = validatePlayerPos();

    console.log('[大富翁] executeMove: dice=', dice, 'oldPos=', oldPos);

    // 先更新回合
    updateState(s => { s.回合 = (s.回合 || 0) + 1; });

    // 骰子动画 → 图结构移动
    renderDiceAnimation(dice, () => {
        const safePos = validatePlayerPos(); // 再次确认位置有效
        console.log('[大富翁] 骰子动画结束，开始移动逻辑, safePos=', safePos);
        try {
            addLog(`掷出 ${dice} 点`);

            // 使用图结构寻路
            const result = walkSteps(safePos, dice);
            console.log('[大富翁] walkSteps result:', JSON.stringify(result));

            if (result.needsChoice) {
                // 遇到岔路口，先播放走到岔路口的动画，再让玩家选择
                isMoving = true;
                const walkedBefore = result.walkedBefore.slice(1); // 去掉起始位置
                const prePathPassedStart = checkPassedStart(result.walkedBefore);
                console.log('[大富翁] 需要选择岔路, walkedBefore:', walkedBefore, 'prePathPassedStart:', prePathPassedStart);
                animateGraphMovement(walkedBefore, 0, () => {
                    isMoving = false;
                    // 显示岔路选择UI
                    const remainSteps = dice - result.stepsWalked;
                    showBranchChoicePanel(result.choiceAt, remainSteps, result.paths, prePathPassedStart);
                });
            } else {
                // 无岔路，直接走
                const path = result.paths[0];
                const steps = path.slice(1); // 去掉起始位置
                const passedStart = checkPassedStart(path);
                console.log('[大富翁] 直接走, steps:', steps, 'passedStart:', passedStart);

                isMoving = true;
                animateGraphMovement(steps, 0, () => {
                    console.log('[大富翁] 移动动画完成, newPos:', path[path.length - 1]);
                    isMoving = false;
                    const newPos = path[path.length - 1];
                    finishMovement(newPos, passedStart);
                });
            }
        } catch (e) {
            console.error('[大富翁] executeMove 回调异常:', e);
            isMoving = false;
            addLog('⚠️ 移动出错: ' + e.message);
            renderPanel();
        }
    });
}

// 岔路口选择后继续移动
function continueMoveAfterChoice(chosenNextId, remainSteps, prePathPassedStart = false) {
    try {
        // 从选择的下一个节点开始继续走
        const subResult = walkSteps(chosenNextId, remainSteps - 1);

        if (subResult.needsChoice) {
            // 又遇到岔路（极少见，但要处理）
            const walkedBefore = subResult.walkedBefore.slice(1);
            const combinedPassedStart = prePathPassedStart || checkPassedStart(subResult.walkedBefore);
            isMoving = true;
            animateGraphMovement([chosenNextId, ...walkedBefore], 0, () => {
                isMoving = false;
                const newRemain = remainSteps - 1 - subResult.stepsWalked;
                showBranchChoicePanel(subResult.choiceAt, newRemain, subResult.paths, combinedPassedStart);
            });
        } else {
            const path = [chosenNextId, ...subResult.paths[0].slice(1)];
            const fullPath = path;
            isMoving = true;
            animateGraphMovement(fullPath, 0, () => {
                isMoving = false;
                const newPos = fullPath[fullPath.length - 1];
                // 检查是否经过起点（合并岔路前+岔路后两段路径）
                const passedStart = prePathPassedStart || fullPath.includes(0);
                finishMovement(newPos, passedStart);
            });
        }
    } catch (e) {
        console.error('[大富翁] continueMoveAfterChoice 异常:', e);
        isMoving = false;
        addLog('⚠️ 移动出错: ' + e.message);
        renderPanel();
    }
}

// 移动完成后的结算
function finishMovement(newPos, passedStart) {
    const tile = getTile(newPos);
    addLog(`到达 ${tile?.icon} ${tile?.name}`);

    // 更新玩家位置
    updateState(s => { s.位置 = newPos; });

    // 经过起点奖励
    if (passedStart && newPos !== 0) {
        const startTile = getTile(0);
        let bonus = startTile?.passBonus || 300;
        if (activeBuffs.翻倍水晶) {
            bonus *= 2;
            activeBuffs.翻倍水晶 = false;
            addLog(`💎 翻倍水晶生效！起点奖励翻倍！`);
        }
        updateState(s => { s.筹码 = (s.筹码 || 0) + bonus; });
        addLog(`经过起点，+${bonus}筹码`);
    }

    // 检查分红结算
    checkDividends(getMonopolyState());

    renderPanel();
    handleTileLanding(newPos);
}

// ==================== 岔路选择面板 ====================
function showBranchChoicePanel(branchNodeId, remainSteps, branches, prePathPassedStart = false) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const branchNode = getTile(branchNodeId);
    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">⚡</div>`;
    html += `<div class="mp-scene-header">岔路口</div>`;
    html += `<div class="mp-scene-desc">在 ${branchNode?.icon} ${branchNode?.name} 遇到分叉，还剩 ${remainSteps} 步，选择方向：</div>`;
    html += `<div class="mp-scene-options">`;

    for (const branch of branches) {
        const firstNode = getTile(branch.firstNode);
        // 预览目的地
        let destNode = firstNode;
        if (!branch.needsChoice && branch.paths && branch.paths[0]) {
            const destPath = branch.paths[0];
            destNode = getTile(destPath[destPath.length - 1]) || firstNode;
        }
        html += `<button class="mp-btn mp-btn-primary" data-action="branch-choose" data-next="${branch.firstNode}" data-remain="${remainSteps}" style="text-align:left;">`;
        html += `<div style="font-size:13px;font-weight:700;">${firstNode?.icon} ${firstNode?.name} 方向</div>`;
        if (destNode && destNode.id !== firstNode?.id) {
            html += `<div style="font-size:10px;opacity:0.8;">→ 最终到达 ${destNode.icon} ${destNode.name}</div>`;
        }
        html += `</button>`;
    }

    html += `</div></div></div>`;
    panel.insertAdjacentHTML('beforeend', html);

    doc.getElementById('mp-scene-overlay').addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action="branch-choose"]');
        if (!btn) return;
        const nextId = parseInt(btn.dataset.next);
        const remain = parseInt(btn.dataset.remain);
        doc.getElementById('mp-scene-overlay')?.remove();

        const nextNode = getTile(nextId);
        addLog(`⚡ 选择了 ${nextNode?.icon} ${nextNode?.name} 方向`);
        continueMoveAfterChoice(nextId, remain, prePathPassedStart);
    });

    // 高亮分支节点
    _highlightNodes = branches.map(b => b.firstNode);
    requestCanvasRedraw();
}

// ==================== 逐格移动动画（图结构版） ====================
function animateGraphMovement(nodeIds, index, callback) {
    if (index >= nodeIds.length) {
        _animPlayerPos = null;
        _highlightNodes = [];
        callback();
        return;
    }

    const nodeId = nodeIds[index];
    const node = getTile(nodeId);
    const isLast = index === nodeIds.length - 1;

    // 更新位置
    updateState(s => { s.位置 = nodeId; });

    // 平滑动画：插值玩家位置
    if (node) {
        const _aw = gridToWorld(node.gx, node.gy);
        _animPlayerPos = { wx: _aw.wx, wy: _aw.wy };
        // 摄像头跟随
        centerOnNode(nodeId);
    }

    // 高亮经过的节点
    if (!isLast) {
        _highlightNodes = [nodeId];
    }

    requestCanvasRedraw();

    // 延迟后移动到下一步
    const delay = isLast ? 120 : 200;
    setTimeout(() => animateGraphMovement(nodeIds, index + 1, callback), delay);
}

// ==================== 格子着陆处理 ====================
function handleTileLanding(tileId) {
    const tile = getTile(tileId);
    if (!tile) return;

    switch (tile.type) {
        case TILE_TYPE.FUNC:
            handleFuncTile(tile);
            break;
        case TILE_TYPE.EVENT:
            handleEventTile(tile);
            break;
        case TILE_TYPE.SCENE:
        case TILE_TYPE.EROTIC:
            // 特殊格子特判：触发小游戏
            if (tile.id === 10 || tile.id === 25) {
                showCasinoMenu(tile);
            } else if (tile.id === 16) {
                showAuctionGame(tile);
            } else if (tile.id === 27) {
                showPuzzleRoom(tile);
            } else {
                handleSceneTile(tile);
            }
            break;
        case TILE_TYPE.PROPERTY:
            handlePropertyTile(tile);
            break;
    }
}

// ==================== 功能格处理 ====================
function handleFuncTile(tile) {
    const state = getMonopolyState();

    switch (tile.funcType) {
        case FUNC_TYPE.TAX:
        case FUNC_TYPE.CHECKPOINT: {
            const tax = Math.max(tile.taxMin || 100, Math.floor((state.筹码 || 0) * (tile.taxRate || 0.05)));
            updateState(s => { s.筹码 = Math.max(0, (s.筹码 || 0) - tax); });
            addLog(`${tile.name}：缴税 ${tax} 筹码`);
            renderPanel();
            break;
        }
        case FUNC_TYPE.ESCAPE:
            updateState(s => { s.位置 = 0; });
            addLog(`${tile.name}：传送回起点`);
            renderPanel();
            break;
        case FUNC_TYPE.DOCK:
            updateState(s => { s.位置 = 0; });
            addLog(`${tile.name}：传送回起点`);
            renderPanel();
            break;
        case FUNC_TYPE.SHOP:
            addLog(`${tile.name}：欢迎光临！`);
            showShopPanel(tile);
            break;
        default:
            break;
    }
}

// ==================== 事件格处理 ====================
function handleEventTile(tile) {
    if (tile.eventType === EVENT_TYPE.FATE) {
        const card = drawFateCard();
        // 命运之眼 buff：抽卡时消耗并提示
        if (activeBuffs.命运之眼) {
            const peeked = activeBuffs.命运之眼;
            activeBuffs.命运之眼 = null;
            addLog(`🔮 命运之眼失效（上次看到的是${peeked.name}，实际抽到${card.name}）`);
        }
        addLog(`🃏 命运卡：${card.name}`);
        showFateCardPanel(card);
    } else if (tile.eventType === EVENT_TYPE.CHANCE) {
        const card = drawChanceCard();
        addLog(`❓ 机会卡：${card.name}`);
        showChanceCardPanel(card);
    }
}

// ==================== 命运卡面板 ====================
function showFateCardPanel(card) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const typeColors = { positive: '#10B981', negative: '#EF4444', neutral: '#6B7280', special: '#8B5CF6' };
    const typeLabels = { positive: '🍀 好运', negative: '💀 厄运', neutral: '🌀 中立', special: '✨ 特殊' };
    const color = typeColors[card.type] || '#6B7280';
    const label = typeLabels[card.type] || '🃏 命运';

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:320px;">`;
    html += `<div style="font-size:48px;margin-bottom:8px;">🃏</div>`;
    html += `<div class="mp-scene-header">${card.name}</div>`;
    html += `<div style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;color:#FFF;background:${color};margin-bottom:10px;">${label}</div>`;
    html += `<div class="mp-scene-desc">${card.fallbackText}</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:6px;width:100%;">`;
    html += `<button class="mp-btn mp-btn-primary" data-action="fate-confirm" style="width:100%;">✅ 确认</button>`;
    html += `<button class="mp-btn mp-btn-ghost" data-action="fate-narrate" style="width:100%;font-size:11px;">📖 让AI讲这个故事</button>`;
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    doc.getElementById('mp-scene-overlay').addEventListener('click', async function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'fate-confirm') {
            applyCardEffect(card.effect);
            doc.getElementById('mp-scene-overlay')?.remove();
            renderPanel();
        } else if (btn.dataset.action === 'fate-narrate') {
            applyCardEffect(card.effect);
            doc.getElementById('mp-scene-overlay')?.remove();

            // 注入卡牌叙事指令到ChatLore
            const state = getMonopolyState();
            const cardPrompt = buildCardNarrativePrompt('命运卡', card, state);
            const injected = await injectSceneLore(cardPrompt);
            if (injected) {
                const trigMsg = `*突然发生了一件意想不到的事——${card.name}！*`;
                fillInputBox(trigMsg);
                addLog(`📖 命运卡叙事已注入，请发送消息触发AI描写`);
                togglePanel(false, true);
                markPendingSceneLore(cardPrompt, trigMsg);
            }
        }
    });
}

// ==================== 机会卡选项面板 ====================
function showChanceCardPanel(card) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div style="font-size:48px;margin-bottom:8px;">❓</div>`;
    html += `<div class="mp-scene-header">${card.name}</div>`;
    html += `<div class="mp-scene-desc">${card.fallbackText}</div>`;

    // 选项列表
    html += `<div class="mp-scene-options">`;
    if (card.options && card.options.length > 0) {
        card.options.forEach((opt, idx) => {
            const hasGamble = opt.effect?.gamble;
            const chipsCost = opt.effect?.chips < 0 ? Math.abs(opt.effect.chips) : 0;
            const state = getMonopolyState();
            const canAfford = chipsCost === 0 || (state.筹码 || 0) >= chipsCost;
            const gambleCost = hasGamble ? opt.effect.gamble.cost : 0;
            const canAffordGamble = !hasGamble || (state.筹码 || 0) >= gambleCost;
            const disabled = !canAfford || !canAffordGamble;

            html += `<button class="mp-btn ${idx === 0 ? 'mp-btn-primary' : 'mp-btn-secondary'} mp-chance-opt" data-action="chance-pick" data-idx="${idx}" ${disabled ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="width:100%;text-align:left;padding:10px 14px;">`;
            html += `<div style="font-weight:700;font-size:13px;">${opt.label}</div>`;
            if (disabled && (chipsCost > 0 || gambleCost > 0)) {
                html += `<div style="font-size:10px;color:#FCA5A5;margin-top:2px;">筹码不足</div>`;
            }
            html += `</button>`;
        });
    }
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    doc.getElementById('mp-scene-overlay').addEventListener('click', async function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;

        if (btn.dataset.action !== 'chance-pick') return;

        const idx = parseInt(btn.dataset.idx);
        const option = card.options[idx];
        if (!option) return;

        addLog(`选择了：${option.label}`);

        // 处理赌博类效果
        let gambleResult = null;
        if (option.effect?.gamble) {
            const g = option.effect.gamble;
            const state = getMonopolyState();
            if ((state.筹码 || 0) >= g.cost) {
                const won = Math.random() < g.chance;
                if (won) {
                    updateState(s => { s.筹码 = (s.筹码 || 0) - g.cost + g.reward; });
                    addLog(`🎉 赌赢了！花 ${g.cost} 赢得 ${g.reward} 筹码！`);
                    gambleResult = 'win';
                } else {
                    updateState(s => { s.筹码 = Math.max(0, (s.筹码 || 0) - g.cost); });
                    addLog(`💸 赌输了！损失 ${g.cost} 筹码。`);
                    gambleResult = 'lose';
                }
            } else {
                addLog(`⚠️ 筹码不足！需要 ${g.cost} 筹码`);
            }
            // 赌博选项也可能附带其他效果（如chips/triggerFollowUp），一并应用
            const otherEffect = { ...option.effect };
            delete otherEffect.gamble;
            if (Object.keys(otherEffect).length > 0) applyCardEffect(otherEffect);
        } else {
            applyCardEffect(option.effect);
        }

        // 替换内容为结果+AI叙事按钮
        const overlayEl = doc.getElementById('mp-scene-overlay');
        if (overlayEl) {
            const cardEl = overlayEl.querySelector('.mp-scene-card');
            if (cardEl) {
                let resultHtml = `<div style="font-size:48px;margin-bottom:8px;">✅</div>`;
                resultHtml += `<div class="mp-scene-header">选择完毕</div>`;
                resultHtml += `<div class="mp-scene-desc">${option.label}</div>`;
                resultHtml += `<div style="display:flex;flex-direction:column;gap:6px;width:100%;">`;
                resultHtml += `<button class="mp-btn mp-btn-primary" data-action="chance-done" style="width:100%;">✅ 继续</button>`;
                resultHtml += `<button class="mp-btn mp-btn-ghost" data-action="chance-narrate" style="width:100%;font-size:11px;">📖 让AI讲这个故事</button>`;
                resultHtml += `</div>`;
                cardEl.innerHTML = resultHtml;

                // 重新绑定新按钮事件
                cardEl.addEventListener('click', async function(e2) {
                    const btn2 = e2.target.closest('[data-action]');
                    if (!btn2) return;
                    if (btn2.dataset.action === 'chance-done') {
                        overlayEl.remove();
                        renderPanel();
                    } else if (btn2.dataset.action === 'chance-narrate') {
                        overlayEl.remove();
                        const state = getMonopolyState();
                        const cardPrompt = buildCardNarrativePrompt('机会卡', card, state, option, gambleResult);
                        const injected = await injectSceneLore(cardPrompt);
                        if (injected) {
                            const trigMsg = `*一个选择摆在我面前——${card.name}，我选择了${option.label}*`;
                            fillInputBox(trigMsg);
                            addLog(`📖 机会卡叙事已注入，请发送消息触发AI描写`);
                            togglePanel(false, true);
                            markPendingSceneLore(cardPrompt, trigMsg);
                        }
                    }
                });
                return; // 不关闭overlay
            }
        }

        doc.getElementById('mp-scene-overlay')?.remove();
        renderPanel();
    });
}

// ==================== 商店面板 ====================
function showShopPanel(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const state = getMonopolyState();
    const ownedItems = state.道具 || {};

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:360px;">`;
    html += `<div class="mp-scene-header">${tile.icon} ${tile.name}</div>`;
    html += `<div class="mp-scene-desc">当前筹码: 💰 ${state.筹码 || 0}</div>`;

    const hasBlackmarket = true; // 所有道具始终可用

    html += `<div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;margin:8px 0;">`;
    for (const [name, item] of Object.entries(ITEMS)) {
        // 黑市限定道具：需要暗巷区解锁
        if (item.blackmarket && !hasBlackmarket) continue;
        const owned = ownedItems[name] || 0;
        const canAfford = (state.筹码 || 0) >= item.price;
        html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:10px;">`;
        html += `<div style="font-size:22px;flex-shrink:0;">${item.icon}</div>`;
        html += `<div style="flex:1;min-width:0;">`;
        html += `<div style="font-size:12px;font-weight:700;">${name}${owned > 0 ? ` <span style="color:#6B7280;font-weight:400;">×${owned}</span>` : ''}</div>`;
        html += `<div style="font-size:10px;color:#9CA3AF;">${item.desc}</div>`;
        html += `</div>`;
        html += `<button class="mp-btn ${canAfford ? 'mp-btn-primary' : ''}" data-action="shop-buy" data-item="${name}" ${canAfford ? '' : 'disabled style="opacity:0.4;cursor:not-allowed;"'} style="padding:4px 10px;font-size:11px;flex-shrink:0;">`;
        html += `💰${item.price}`;
        html += `</button>`;
        html += `</div>`;
    }
    html += `</div>`;

    html += `<button class="mp-btn" data-action="scene-skip" style="width:100%;">离开商店</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    doc.getElementById('mp-scene-overlay').addEventListener('click', function handler(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'shop-buy') {
            const itemName = btn.dataset.item;
            const item = ITEMS[itemName];
            if (!item) return;
            const currentState = getMonopolyState();
            if ((currentState.筹码 || 0) >= item.price) {
                updateState(s => {
                    s.筹码 = (s.筹码 || 0) - item.price;
                    if (!s.道具) s.道具 = {};
                    s.道具[itemName] = (s.道具[itemName] || 0) + 1;
                });
                addLog(`🛒 购买了 ${item.icon} ${itemName}（-${item.price}筹码）`);
                // 刷新商店面板
                doc.getElementById('mp-scene-overlay')?.remove();
                renderPanel();
                showShopPanel(tile);
            }
        } else if (btn.dataset.action === 'scene-skip') {
            doc.getElementById('mp-scene-overlay')?.remove();
        }
    });
}

// ==================== 赌场菜单（选择游戏） ====================
function showCasinoMenu(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const isUnderground = tile.id === 25;
    const state = getMonopolyState();

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:300px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">${isUnderground ? '🃏' : '🎰'}</div>`;
    html += `<div class="mp-scene-header">${tile.name}</div>`;
    html += `<div style="font-size:11px;color:#6B7280;margin-bottom:12px;">当前筹码: 💰 ${state.筹码 || 0}</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
    html += `<button class="mp-btn mp-btn-primary" data-action="casino-pick-dice" style="width:100%;padding:10px;">🎲 骰子比大小</button>`;
    html += `<button class="mp-btn mp-btn-primary" data-action="casino-pick-slots" style="width:100%;padding:10px;">🎰 老虎机</button>`;
    html += `<button class="mp-btn" data-action="casino-menu-leave" style="width:100%;">🚶 离开</button>`;
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    doc.getElementById('mp-scene-overlay').addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'casino-pick-dice') {
            doc.getElementById('mp-scene-overlay')?.remove();
            showCasinoDiceGame(tile);
        } else if (btn.dataset.action === 'casino-pick-slots') {
            doc.getElementById('mp-scene-overlay')?.remove();
            showSlotMachine(tile);
        } else if (btn.dataset.action === 'casino-menu-leave') {
            doc.getElementById('mp-scene-overlay')?.remove();
            addLog(`🚶 离开了${tile.name}`);
        }
    });
}

// ==================== 老虎机小游戏 ====================
function showSlotMachine(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const state = getMonopolyState();
    const isUnderground = tile.id === 25;
    const betOptions = isUnderground ? [300, 600, 1000] : [100, 300, 500];

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:320px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">🎰</div>`;
    html += `<div class="mp-scene-header">老虎机</div>`;
    html += `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">当前筹码: 💰 ${state.筹码 || 0}</div>`;

    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    for (const bet of betOptions) {
        const canAfford = (state.筹码 || 0) >= bet;
        html += `<button class="mp-btn ${canAfford ? 'mp-btn-primary' : ''}" data-action="slot-spin" data-bet="${bet}" ${canAfford ? '' : 'disabled'} style="width:100%;padding:8px 16px;font-size:14px;font-weight:700;${canAfford ? '' : 'opacity:0.4;cursor:not-allowed;'}">`;
        html += `投入 💰 ${bet}`;
        html += `</button>`;
    }
    html += `<button class="mp-btn" data-action="slot-back" style="width:100%;">↩ 返回</button>`;
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    const cardEl = overlay.querySelector('.mp-scene-card');

    overlay.addEventListener('click', function handler(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'slot-back') {
            overlay.remove();
            showCasinoMenu(tile);
            return;
        }

        if (btn.dataset.action === 'slot-again') {
            overlay.remove();
            showSlotMachine(tile);
            return;
        }

        if (btn.dataset.action === 'slot-leave') {
            overlay.remove();
            renderPanel();
            return;
        }

        if (btn.dataset.action === 'slot-spin') {
            const bet = parseInt(btn.dataset.bet);
            updateState(s => { s.筹码 = (s.筹码 || 0) - bet; });

            // 老虎机符号和赔率
            const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍀'];
            const weights = [30, 25, 20, 15, 5, 5]; // 权重
            const totalWeight = weights.reduce((a, b) => a + b, 0);

            const spinOne = () => {
                let r = Math.random() * totalWeight;
                for (let i = 0; i < symbols.length; i++) {
                    r -= weights[i];
                    if (r <= 0) return { symbol: symbols[i], idx: i };
                }
                return { symbol: symbols[0], idx: 0 };
            };

            const r1 = spinOne(), r2 = spinOne(), r3 = spinOne();

            let resultHtml = `<div style="font-size:24px;margin-bottom:4px;">🎰</div>`;
            resultHtml += `<div class="mp-scene-header">老虎机</div>`;
            resultHtml += `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">赌注: ${bet} 筹码</div>`;

            // 显示结果
            resultHtml += `<div style="display:flex;gap:8px;justify-content:center;margin:12px 0;">`;
            [r1, r2, r3].forEach(r => {
                resultHtml += `<div style="width:60px;height:60px;border:3px solid #E5E7EB;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;background:#FFF;">${r.symbol}</div>`;
            });
            resultHtml += `</div>`;

            // 判定赔率
            let multiplier = 0;
            let winLabel = '';
            if (r1.symbol === r2.symbol && r2.symbol === r3.symbol) {
                // 三连
                if (r1.symbol === '7️⃣') { multiplier = 10; winLabel = '🎇 JACKPOT！三个7！'; }
                else if (r1.symbol === '💎') { multiplier = 7; winLabel = '💎💎💎 钻石三连！'; }
                else if (r1.symbol === '🍀') { multiplier = 8; winLabel = '🍀🍀🍀 幸运三连！'; }
                else { multiplier = 5; winLabel = `${r1.symbol}${r2.symbol}${r3.symbol} 三连！`; }
            } else if (r1.symbol === r2.symbol || r2.symbol === r3.symbol || r1.symbol === r3.symbol) {
                multiplier = 2;
                winLabel = '两个相同！';
            }

            let winAmount = Math.floor(bet * multiplier);
            if (winAmount > 0) {
                if (activeBuffs.翻倍水晶) {
                    winAmount *= 2;
                    activeBuffs.翻倍水晶 = false;
                    addLog(`💎 翻倍水晶生效！奖金翻倍！`);
                }
                updateState(s => { s.筹码 = (s.筹码 || 0) + winAmount; });
                resultHtml += `<div style="font-size:16px;font-weight:800;color:#10B981;margin:8px 0;">🎉 ${winLabel} +${winAmount} 筹码</div>`;
                addLog(`🎰 老虎机：${r1.symbol}${r2.symbol}${r3.symbol}，赢了 ${winAmount}！`);
            } else {
                if (activeBuffs.护盾) {
                    activeBuffs.护盾 = false;
                    updateState(s => { s.筹码 = (s.筹码 || 0) + bet; }); // 退回赌注
                    resultHtml += `<div style="font-size:16px;font-weight:800;color:#F59E0B;margin:8px 0;">🛡️ 护盾生效！退回赌注</div>`;
                    addLog(`🎰 老虎机：${r1.symbol}${r2.symbol}${r3.symbol}，护盾抵消！`);
                } else {
                    resultHtml += `<div style="font-size:16px;font-weight:800;color:#EF4444;margin:8px 0;">💨 没有中奖... -${bet} 筹码</div>`;
                    addLog(`🎰 老虎机：${r1.symbol}${r2.symbol}${r3.symbol}，没中...`);
                }
            }

            resultHtml += `<div style="font-size:11px;color:#6B7280;">当前筹码: 💰 ${getMonopolyState().筹码 || 0}</div>`;
            resultHtml += `<div style="display:flex;gap:6px;margin-top:8px;">`;
            resultHtml += `<button class="mp-btn mp-btn-primary" data-action="slot-again" style="flex:1;">🎰 再来</button>`;
            resultHtml += `<button class="mp-btn" data-action="slot-leave" style="flex:1;">🚶 离开</button>`;
            resultHtml += `</div>`;

            cardEl.innerHTML = resultHtml;
        }
    });
}

// ==================== 赌场小游戏：骰子比大小 ====================
function showCasinoDiceGame(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const state = getMonopolyState();
    const isUnderground = tile.id === 25;
    const bets = isUnderground ? [200, 1000, 2000] : [100, 500, 1000];

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div style="font-size:48px;margin-bottom:8px;">🎲</div>`;
    html += `<div class="mp-scene-header">${tile.icon} ${tile.name}</div>`;
    html += `<div class="mp-scene-desc">骰子比大小！双方各掷一骰，点数大赢。</div>`;
    html += `<div style="font-size:12px;color:#6B7280;margin-bottom:8px;">当前筹码: 💰 ${state.筹码 || 0}</div>`;

    html += `<div style="font-size:11px;font-weight:700;color:#6B7280;margin-bottom:6px;">选择赌注：</div>`;
    html += `<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">`;
    for (const bet of bets) {
        const canAfford = (state.筹码 || 0) >= bet;
        html += `<button class="mp-btn ${canAfford ? 'mp-btn-primary' : ''}" data-action="casino-bet" data-bet="${bet}" ${canAfford ? '' : 'disabled'} style="padding:8px 16px;font-size:14px;font-weight:700;${canAfford ? '' : 'opacity:0.4;cursor:not-allowed;'}">`;
        html += `💰 ${bet}`;
        html += `</button>`;
    }
    html += `</div>`;
    html += `<button class="mp-btn mp-btn-ghost" data-action="casino-leave" style="width:100%;margin-top:10px;font-size:11px;">🚶 离开赌场</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;

        if (btn.dataset.action === 'casino-leave') {
            overlay.remove();
            addLog(`离开了${tile.name}`);
            renderPanel();
            return;
        }

        if (btn.dataset.action === 'casino-again') {
            overlay.remove();
            showCasinoMenu(tile);
            return;
        }

        if (btn.dataset.action === 'casino-bet') {
            const bet = parseInt(btn.dataset.bet);
            const currentState = getMonopolyState();
            if ((currentState.筹码 || 0) < bet) return;

            const playerRoll = Math.floor(Math.random() * 6) + 1;
            const houseRoll = Math.floor(Math.random() * 6) + 1;

            const cardEl = overlay.querySelector('.mp-scene-card');
            if (!cardEl) return;

            let resultHtml = `<div style="font-size:14px;font-weight:700;margin-bottom:12px;">🎲 骰子比大小</div>`;
            resultHtml += `<div style="display:flex;justify-content:center;gap:24px;margin:16px 0;">`;
            resultHtml += `<div style="text-align:center;">`;
            resultHtml += `<div style="font-size:10px;color:#6B7280;margin-bottom:4px;">你</div>`;
            resultHtml += `<div style="font-size:48px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;background:#FFF;border:2px solid #E5E7EB;border-radius:12px;">${playerRoll}</div>`;
            resultHtml += `</div>`;
            resultHtml += `<div style="display:flex;align-items:center;font-size:24px;font-weight:900;color:#9CA3AF;">VS</div>`;
            resultHtml += `<div style="text-align:center;">`;
            resultHtml += `<div style="font-size:10px;color:#6B7280;margin-bottom:4px;">庄家</div>`;
            resultHtml += `<div style="font-size:48px;width:64px;height:64px;display:flex;align-items:center;justify-content:center;background:#FFF;border:2px solid #E5E7EB;border-radius:12px;">${houseRoll}</div>`;
            resultHtml += `</div></div>`;

            if (playerRoll > houseRoll) {
                let winAmount = bet;
                if (activeBuffs.翻倍水晶) {
                    winAmount *= 2;
                    activeBuffs.翻倍水晶 = false;
                    addLog(`💎 翻倍水晶生效！赢得筹码翻倍！`);
                }
                updateState(s => { s.筹码 = (s.筹码 || 0) + winAmount; });
                resultHtml += `<div style="font-size:18px;font-weight:800;color:#10B981;margin:8px 0;">🎉 你赢了！+${winAmount} 筹码${winAmount > bet ? '（翻倍！）' : ''}</div>`;
                addLog(`🎲 ${tile.name}：${playerRoll} vs ${houseRoll}，赢了 ${winAmount}！`);
            } else if (playerRoll < houseRoll) {
                if (activeBuffs.护盾) {
                    activeBuffs.护盾 = false;
                    resultHtml += `<div style="font-size:18px;font-weight:800;color:#F59E0B;margin:8px 0;">🛡️ 护盾生效！免除损失！</div>`;
                    addLog(`🎲 ${tile.name}：${playerRoll} vs ${houseRoll}，输了但护盾抵消！`);
                } else {
                    updateState(s => { s.筹码 = Math.max(0, (s.筹码 || 0) - bet); });
                    resultHtml += `<div style="font-size:18px;font-weight:800;color:#EF4444;margin:8px 0;">💸 你输了！-${bet} 筹码</div>`;
                    addLog(`🎲 ${tile.name}：${playerRoll} vs ${houseRoll}，输了 ${bet}...`);
                }
            } else {
                resultHtml += `<div style="font-size:18px;font-weight:800;color:#F59E0B;margin:8px 0;">🤝 平局！退回赌注</div>`;
                addLog(`🎲 ${tile.name}：${playerRoll} vs ${houseRoll}，平局！`);
            }

            const newChips = getMonopolyState().筹码 || 0;
            resultHtml += `<div style="font-size:11px;color:#6B7280;">当前筹码: 💰 ${newChips}</div>`;
            resultHtml += `<div style="display:flex;gap:6px;margin-top:12px;">`;
            resultHtml += `<button class="mp-btn mp-btn-primary" data-action="casino-again" style="flex:1;">🎲 再来一局</button>`;
            resultHtml += `<button class="mp-btn" data-action="casino-leave" style="flex:1;">🚶 离开</button>`;
            resultHtml += `</div>`;

            cardEl.innerHTML = resultHtml;
        }
    });
}

// ==================== 21点小游戏 ====================
function showBlackjackGame() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const state = getMonopolyState();
    const bet = 500;
    if ((state.筹码 || 0) < bet) {
        addLog(`⚠️ 筹码不足${bet}，无法参加21点！`);
        return;
    }
    updateState(s => { s.筹码 = (s.筹码 || 0) - bet; });

    // 简化牌组：A=1或11, 2-10面值, JQK=10
    const drawCard = () => {
        const faces = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        const suits = ['♠','♥','♦','♣'];
        const face = faces[Math.floor(Math.random() * 13)];
        const suit = suits[Math.floor(Math.random() * 4)];
        let value = parseInt(face) || (face === 'A' ? 11 : 10);
        return { face, suit, value, display: `${suit}${face}` };
    };

    const calcHand = (hand) => {
        let total = hand.reduce((s, c) => s + c.value, 0);
        let aces = hand.filter(c => c.face === 'A').length;
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
    };

    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];

    const renderBJState = (reveal) => {
        const pTotal = calcHand(playerHand);
        const dTotal = reveal ? calcHand(dealerHand) : '?';
        let html = `<div style="font-size:36px;margin-bottom:4px;">🃏</div>`;
        html += `<div class="mp-scene-header">21点</div>`;
        html += `<div style="font-size:11px;color:#6B7280;margin-bottom:8px;">赌注: ${bet} 筹码</div>`;

        // 庄家手牌
        html += `<div style="margin:8px 0;">`;
        html += `<div style="font-size:10px;color:#6B7280;margin-bottom:4px;">庄家 ${reveal ? '(' + dTotal + ')' : ''}</div>`;
        html += `<div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">`;
        dealerHand.forEach((c, i) => {
            const hidden = !reveal && i > 0;
            const color = (c.suit === '♥' || c.suit === '♦') ? '#EF4444' : '#1F2937';
            html += `<div style="width:40px;height:56px;border:2px solid #E5E7EB;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;background:#FFF;color:${hidden ? '#E5E7EB' : color};">${hidden ? '🂠' : c.display}</div>`;
        });
        html += `</div></div>`;

        // 玩家手牌
        html += `<div style="margin:8px 0;">`;
        html += `<div style="font-size:10px;color:#6B7280;margin-bottom:4px;">你 (${pTotal})</div>`;
        html += `<div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">`;
        playerHand.forEach(c => {
            const color = (c.suit === '♥' || c.suit === '♦') ? '#EF4444' : '#1F2937';
            html += `<div style="width:40px;height:56px;border:2px solid #E5E7EB;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;background:#FFF;color:${color};">${c.display}</div>`;
        });
        html += `</div></div>`;

        return html;
    };

    const showResult = (cardEl) => {
        // 庄家自动补牌到17+
        while (calcHand(dealerHand) < 17) dealerHand.push(drawCard());
        const pTotal = calcHand(playerHand);
        const dTotal = calcHand(dealerHand);

        let resultHtml = renderBJState(true);
        let winAmount = 0;

        if (pTotal > 21) {
            resultHtml += `<div style="font-size:16px;font-weight:800;color:#EF4444;margin:8px 0;">💥 爆牌！你输了！</div>`;
            addLog(`🃏 21点：爆牌(${pTotal})，输了 ${bet}！`);
        } else if (dTotal > 21) {
            winAmount = bet * 2;
            resultHtml += `<div style="font-size:16px;font-weight:800;color:#10B981;margin:8px 0;">🎉 庄家爆牌！你赢了！+${winAmount} 筹码</div>`;
            addLog(`🃏 21点：庄家爆牌(${dTotal})，赢了 ${winAmount}！`);
        } else if (pTotal > dTotal) {
            winAmount = bet * 2;
            resultHtml += `<div style="font-size:16px;font-weight:800;color:#10B981;margin:8px 0;">🎉 你赢了！${pTotal} vs ${dTotal}，+${winAmount} 筹码</div>`;
            addLog(`🃏 21点：${pTotal} vs ${dTotal}，赢了 ${winAmount}！`);
        } else if (pTotal < dTotal) {
            resultHtml += `<div style="font-size:16px;font-weight:800;color:#EF4444;margin:8px 0;">💸 你输了！${pTotal} vs ${dTotal}</div>`;
            addLog(`🃏 21点：${pTotal} vs ${dTotal}，输了 ${bet}！`);
        } else {
            winAmount = bet;
            resultHtml += `<div style="font-size:16px;font-weight:800;color:#F59E0B;margin:8px 0;">🤝 平局！退回赌注</div>`;
            addLog(`🃏 21点：${pTotal} vs ${dTotal}，平局！`);
        }

        if (winAmount > 0) {
            if (activeBuffs.翻倍水晶 && winAmount > bet) {
                winAmount *= 2;
                activeBuffs.翻倍水晶 = false;
                addLog(`💎 翻倍水晶生效！奖金翻倍！`);
            }
            updateState(s => { s.筹码 = (s.筹码 || 0) + winAmount; });
        }

        resultHtml += `<div style="font-size:11px;color:#6B7280;">当前筹码: 💰 ${getMonopolyState().筹码 || 0}</div>`;
        resultHtml += `<button class="mp-btn" data-action="bj-leave" style="width:100%;margin-top:8px;">关闭</button>`;
        cardEl.innerHTML = resultHtml;
    };

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:320px;">`;
    html += renderBJState(false);

    // 初始检查Blackjack
    if (calcHand(playerHand) === 21) {
        html += `<div style="font-size:16px;font-weight:800;color:#10B981;margin:8px 0;">🎉 Blackjack！</div>`;
    }

    html += `<div style="display:flex;gap:6px;margin-top:8px;">`;
    html += `<button class="mp-btn mp-btn-primary" data-action="bj-hit" style="flex:1;">🃏 要牌</button>`;
    html += `<button class="mp-btn" data-action="bj-stand" style="flex:1;">✋ 停牌</button>`;
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    const cardEl = overlay.querySelector('.mp-scene-card');

    // 事件监听必须在早期return之前注册，否则showResult渲染的关闭按钮无法响应
    overlay.addEventListener('click', function handler(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'bj-hit') {
            playerHand.push(drawCard());
            const pTotal = calcHand(playerHand);
            if (pTotal >= 21) {
                showResult(cardEl);
            } else {
                let newHtml = renderBJState(false);
                newHtml += `<div style="display:flex;gap:6px;margin-top:8px;">`;
                newHtml += `<button class="mp-btn mp-btn-primary" data-action="bj-hit" style="flex:1;">🃏 要牌</button>`;
                newHtml += `<button class="mp-btn" data-action="bj-stand" style="flex:1;">✋ 停牌</button>`;
                newHtml += `</div>`;
                cardEl.innerHTML = newHtml;
            }
        } else if (btn.dataset.action === 'bj-stand') {
            showResult(cardEl);
        } else if (btn.dataset.action === 'bj-leave') {
            overlay.remove();
            renderPanel();
        }
    });

    // 初始Blackjack直接结算（事件监听已注册，showResult渲染的关闭按钮可正常响应）
    if (calcHand(playerHand) === 21) {
        setTimeout(() => showResult(cardEl), 800);
    }
}

// ==================== 拍卖行小游戏 ====================
function showAuctionGame(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const state = getMonopolyState();

    // 随机生成拍卖品
    const auctionItems = [
        { name: '古董花瓶', icon: '🏺', baseValue: 600, desc: '看起来有些年头了' },
        { name: '神秘卷轴', icon: '📜', baseValue: 800, desc: '上面写着看不懂的符文' },
        { name: '宝石项链', icon: '💎', baseValue: 1200, desc: '闪闪发光的宝石' },
        { name: '魔法书', icon: '📕', baseValue: 500, desc: '散发着微弱的光芒' },
        { name: '黄金面具', icon: '🎭', baseValue: 1000, desc: '做工精致的面具' },
        { name: '稀有药材', icon: '🌿', baseValue: 400, desc: '散发着奇异的香气' },
    ];
    const item = auctionItems[Math.floor(Math.random() * auctionItems.length)];
    // 实际价值在基础价值的50%-200%之间波动
    const actualValue = Math.floor(item.baseValue * (0.5 + Math.random() * 1.5));

    // NPC出价（逐轮递增）
    let currentBid = Math.floor(item.baseValue * 0.3);
    let round = 1;
    const maxRounds = 4;
    let playerBid = 0;

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">${item.icon}</div>`;
    html += `<div class="mp-scene-header">🔨 拍卖行</div>`;
    html += `<div style="font-size:12px;color:#6B7280;margin-bottom:4px;">拍品: ${item.name}</div>`;
    html += `<div style="font-size:11px;color:#9CA3AF;margin-bottom:12px;">${item.desc}</div>`;
    html += `<div id="auction-status" style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">当前出价: 💰 ${currentBid}（NPC）</div>`;
    html += `<div style="font-size:10px;color:#6B7280;margin-bottom:8px;">你的筹码: ${state.筹码 || 0} | 第${round}/${maxRounds}轮</div>`;

    // 出价选项：当前价+100/+300/+500，或放弃
    const bids = [200, 400, 600];
    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    for (const add of bids) {
        const myBid = currentBid + add;
        const canAfford = (state.筹码 || 0) >= myBid;
        html += `<button class="mp-btn ${canAfford ? 'mp-btn-primary' : ''}" data-action="auction-bid" data-bid="${myBid}" ${canAfford ? '' : 'disabled'} style="width:100%;${canAfford ? '' : 'opacity:0.4;cursor:not-allowed;'}">出价 💰 ${myBid}（+${add}）</button>`;
    }
    html += `<button class="mp-btn" data-action="auction-pass" style="width:100%;">🚶 放弃竞拍</button>`;
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function handler(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'auction-pass') {
            addLog(`🔨 ${tile.name}：你放弃了竞拍 ${item.name}`);
            overlay.remove();
            renderPanel();
            return;
        }

        if (btn.dataset.action === 'auction-bid') {
            playerBid = parseInt(btn.dataset.bid);
            round++;

            if (round > maxRounds) {
                // 最终轮：玩家获得拍品
                updateState(s => { s.筹码 = (s.筹码 || 0) - playerBid; });
                let resultHtml = `<div style="font-size:36px;margin-bottom:4px;">${item.icon}</div>`;
                resultHtml += `<div class="mp-scene-header">🎉 恭喜中标！</div>`;
                resultHtml += `<div style="font-size:12px;color:#6B7280;margin:8px 0;">${item.name} 花费 ${playerBid} 筹码</div>`;

                // 揭示实际价值
                const profit = actualValue - playerBid;
                const profitColor = profit >= 0 ? '#10B981' : '#EF4444';
                resultHtml += `<div style="font-size:11px;color:#6B7280;">鉴定价值: 💰 ${actualValue}</div>`;
                resultHtml += `<div style="font-size:14px;font-weight:800;color:${profitColor};margin:8px 0;">${profit >= 0 ? `📈 赚了 +${profit} 筹码！` : `📉 亏了 ${profit} 筹码...`}</div>`;

                if (profit > 0) {
                    updateState(s => { s.筹码 = (s.筹码 || 0) + actualValue; });
                    resultHtml += `<div style="font-size:11px;color:#6B7280;">转手卖出获得 ${actualValue} 筹码</div>`;
                    addLog(`🔨 ${tile.name}：拍得 ${item.name}，转手赚了 ${profit}！`);
                } else {
                    updateState(s => { s.筹码 = (s.筹码 || 0) + actualValue; });
                    resultHtml += `<div style="font-size:11px;color:#6B7280;">转手只卖了 ${actualValue} 筹码</div>`;
                    addLog(`🔨 ${tile.name}：拍得 ${item.name}，转手亏了 ${-profit}...`);
                }

                resultHtml += `<div style="font-size:11px;color:#6B7280;margin-top:4px;">当前筹码: 💰 ${getMonopolyState().筹码 || 0}</div>`;
                resultHtml += `<button class="mp-btn" data-action="auction-close" style="width:100%;margin-top:8px;">关闭</button>`;
                overlay.querySelector('.mp-scene-card').innerHTML = resultHtml;
                return;
            }

            // NPC决定是否跟价（越贵越可能放弃）
            const npcGiveUp = Math.random() < (playerBid / (item.baseValue * 2.5));
            if (npcGiveUp) {
                // NPC放弃
                updateState(s => { s.筹码 = (s.筹码 || 0) - playerBid; });
                let resultHtml = `<div style="font-size:36px;margin-bottom:4px;">${item.icon}</div>`;
                resultHtml += `<div class="mp-scene-header">🎉 NPC放弃！你中标了！</div>`;
                resultHtml += `<div style="font-size:12px;color:#6B7280;margin:8px 0;">${item.name} 花费 ${playerBid} 筹码</div>`;

                const profit = actualValue - playerBid;
                const profitColor = profit >= 0 ? '#10B981' : '#EF4444';
                resultHtml += `<div style="font-size:11px;color:#6B7280;">鉴定价值: 💰 ${actualValue}</div>`;
                resultHtml += `<div style="font-size:14px;font-weight:800;color:${profitColor};margin:8px 0;">${profit >= 0 ? `📈 赚了 +${profit} 筹码！` : `📉 亏了 ${profit} 筹码...`}</div>`;

                if (profit > 0) {
                    updateState(s => { s.筹码 = (s.筹码 || 0) + actualValue; });
                    addLog(`🔨 ${tile.name}：拍得 ${item.name}，转手赚了 ${profit}！`);
                } else {
                    updateState(s => { s.筹码 = (s.筹码 || 0) + actualValue; });
                    addLog(`🔨 ${tile.name}：拍得 ${item.name}，转手亏了 ${-profit}...`);
                }

                resultHtml += `<div style="font-size:11px;color:#6B7280;margin-top:4px;">当前筹码: 💰 ${getMonopolyState().筹码 || 0}</div>`;
                resultHtml += `<button class="mp-btn" data-action="auction-close" style="width:100%;margin-top:8px;">关闭</button>`;
                overlay.querySelector('.mp-scene-card').innerHTML = resultHtml;
                return;
            }

            // NPC跟价
            currentBid = playerBid + Math.floor(100 + Math.random() * 300);
            const curState = getMonopolyState();
            let roundHtml = `<div style="font-size:36px;margin-bottom:4px;">${item.icon}</div>`;
            roundHtml += `<div class="mp-scene-header">🔨 拍卖行</div>`;
            roundHtml += `<div style="font-size:12px;color:#6B7280;margin-bottom:4px;">拍品: ${item.name}</div>`;
            roundHtml += `<div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">NPC加价至: 💰 ${currentBid}</div>`;
            roundHtml += `<div style="font-size:10px;color:#6B7280;margin-bottom:8px;">你的筹码: ${curState.筹码 || 0} | 第${round}/${maxRounds}轮</div>`;

            const newBids = [200, 400, 600];
            roundHtml += `<div style="display:flex;flex-direction:column;gap:4px;">`;
            for (const add of newBids) {
                const myBid = currentBid + add;
                const canAfford = (curState.筹码 || 0) >= myBid;
                roundHtml += `<button class="mp-btn ${canAfford ? 'mp-btn-primary' : ''}" data-action="auction-bid" data-bid="${myBid}" ${canAfford ? '' : 'disabled'} style="width:100%;${canAfford ? '' : 'opacity:0.4;cursor:not-allowed;'}">出价 💰 ${myBid}（+${add}）</button>`;
            }
            roundHtml += `<button class="mp-btn" data-action="auction-pass" style="width:100%;">🚶 放弃竞拍</button>`;
            roundHtml += `</div>`;
            overlay.querySelector('.mp-scene-card').innerHTML = roundHtml;
        }

        if (btn.dataset.action === 'auction-close') {
            overlay.remove();
            renderPanel();
        }
    });
}

// ==================== 密室解谜小游戏 ====================
function showPuzzleRoom(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    // 谜题池
    const puzzles = [
        { q: '一个房间有3扇门：一扇后面是宝藏，一扇后面是怪物，一扇后面是空房间。你选哪扇？',
          options: ['左门', '中门', '右门'], correct: Math.floor(Math.random() * 3) },
        { q: '石碑上刻着：我越洗越脏，不洗有人吃。我是什么？',
          options: ['水', '碗', '手'], correct: 0 },
        { q: '密室墙上有4个符号按钮：🔴🔵🟢🟡。线索说"血月之后是碧海"。按什么顺序？',
          options: ['🔴🔵🟢🟡', '🟡🔴🔵🟢', '🔴🔵'], correct: 2 },
        { q: '地上有个天平，左边放了3个金币，右边放了1个金币和一把钥匙。要平衡需要？',
          options: ['左边减2个金币', '右边加2个金币', '取走钥匙'], correct: 1 },
        { q: '门上刻着数字：2, 4, 8, 16, ?。缺失的数字是？',
          options: ['24', '32', '20'], correct: 1 },
        { q: '房间里有根蜡烛、一盏油灯和一个壁炉。你只有一根火柴。先点什么？',
          options: ['蜡烛', '油灯', '火柴'], correct: 2 },
    ];

    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
    const reward = 600 + Math.floor(Math.random() * 400);

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">🔐</div>`;
    html += `<div class="mp-scene-header">密室解谜</div>`;
    html += `<div style="font-size:12px;color:#374151;margin:8px 0;line-height:1.5;">${puzzle.q}</div>`;
    html += `<div style="font-size:10px;color:#10B981;margin-bottom:8px;">奖励: 💰 ${reward}</div>`;

    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    puzzle.options.forEach((opt, i) => {
        html += `<button class="mp-btn mp-btn-primary" data-action="puzzle-answer" data-idx="${i}" style="width:100%;text-align:left;padding:8px 12px;font-size:12px;">${String.fromCharCode(65 + i)}. ${opt}</button>`;
    });
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function handler(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'puzzle-answer') {
            const idx = parseInt(btn.dataset.idx);
            const isCorrect = idx === puzzle.correct;

            let resultHtml = `<div style="font-size:36px;margin-bottom:4px;">${isCorrect ? '🎉' : '💀'}</div>`;
            resultHtml += `<div class="mp-scene-header">${isCorrect ? '解谜成功！' : '解谜失败...'}</div>`;

            if (isCorrect) {
                let finalReward = reward;
                if (activeBuffs.翻倍水晶) {
                    finalReward *= 2;
                    activeBuffs.翻倍水晶 = false;
                    addLog(`💎 翻倍水晶生效！奖金翻倍！`);
                }
                updateState(s => { s.筹码 = (s.筹码 || 0) + finalReward; });
                resultHtml += `<div style="font-size:14px;font-weight:800;color:#10B981;margin:8px 0;">+${finalReward} 筹码</div>`;
                addLog(`🔐 ${tile.name}：解谜成功！+${finalReward}筹码`);
            } else {
                const penalty = 300;
                if (activeBuffs.护盾) {
                    activeBuffs.护盾 = false;
                    resultHtml += `<div style="font-size:14px;font-weight:800;color:#F59E0B;margin:8px 0;">🛡️ 护盾抵消了惩罚！</div>`;
                    addLog(`🔐 ${tile.name}：解谜失败，但护盾抵消了惩罚！`);
                } else {
                    updateState(s => { s.筹码 = Math.max(0, (s.筹码 || 0) - penalty); });
                    resultHtml += `<div style="font-size:14px;font-weight:800;color:#EF4444;margin:8px 0;">陷阱触发！-${penalty} 筹码</div>`;
                    addLog(`🔐 ${tile.name}：解谜失败，-${penalty}筹码`);
                }
                resultHtml += `<div style="font-size:11px;color:#6B7280;margin:4px 0;">正确答案: ${String.fromCharCode(65 + puzzle.correct)}. ${puzzle.options[puzzle.correct]}</div>`;
            }

            resultHtml += `<div style="font-size:11px;color:#6B7280;margin-top:4px;">当前筹码: 💰 ${getMonopolyState().筹码 || 0}</div>`;
            resultHtml += `<button class="mp-btn" data-action="puzzle-close" style="width:100%;margin-top:8px;">关闭</button>`;
            overlay.querySelector('.mp-scene-card').innerHTML = resultHtml;
        }

        if (btn.dataset.action === 'puzzle-close') {
            overlay.remove();
            renderPanel();
        }
    });
}

// ==================== 卡牌效果应用 ====================
function applyCardEffect(effect) {
    if (!effect) return;

    // 护盾buff：免除负面效果
    const isNegative = (effect.chips && effect.chips < 0) || effect.taxPercent;
    if (isNegative && activeBuffs.护盾) {
        activeBuffs.护盾 = false;
        addLog(`🛡️ 护盾生效！负面效果已免除！`);
        return;
    }

    // 翻倍水晶buff：正面筹码收益翻倍
    let chipsAmount = effect.chips || 0;
    if (chipsAmount > 0 && activeBuffs.翻倍水晶) {
        chipsAmount *= 2;
        activeBuffs.翻倍水晶 = false;
        addLog(`💎 翻倍水晶生效！筹码收益翻倍！`);
    }

    // 预计算税额（避免在updateState回调内部无法传出值）
    let taxPaid = 0;
    if (effect.taxPercent) {
        const preState = getMonopolyState();
        taxPaid = Math.floor((preState.筹码 || 0) * effect.taxPercent);
    }

    updateState(s => {
        if (chipsAmount) s.筹码 = Math.max(0, (s.筹码 || 0) + chipsAmount);
        if (taxPaid > 0) s.筹码 = Math.max(0, (s.筹码 || 0) - taxPaid);
        if (effect.teleportRandom) {
            const randomNode = MAP_NODES[Math.floor(Math.random() * MAP_NODES.length)];
            s.位置 = randomNode.id;
        }
    });
    if (taxPaid > 0) addLog(`缴税 ${taxPaid} 筹码`);
    if (effect.teleportRandom) {
        const newPos = getMonopolyState().位置;
        addLog(`传送到 ${getTile(newPos)?.name}`);
        renderPanel();
        setTimeout(() => handleTileLanding(newPos), 300);
    }
    // 触发小游戏
    if (effect.triggerMiniGame === 'blackjack') {
        setTimeout(() => showBlackjackGame(), 300);
    }

    // 投资折扣buff（贵人相助）
    if (effect.investDiscount) {
        activeBuffs.投资折扣 = true;
        addLog(`🤝 贵人相助！下次据点投资半价！`);
        renderPanel();
    }

    // freeOnce: 免费体验一次（艳遇卡）
    if (effect.freeOnce) {
        activeBuffs.免费体验 = true;
        addLog(`🌟 这次是免费体验！`);
    }

    // 传送到随机涩情格（艳遇）
    if (effect.teleportErotic) {
        const state = getMonopolyState();
        const eroticTiles = MAP_NODES.filter(t => t.type === TILE_TYPE.EROTIC);
        if (eroticTiles.length > 0) {
            const target = eroticTiles[Math.floor(Math.random() * eroticTiles.length)];
            updateState(s => { s.位置 = target.id; });
            addLog(`💕 艳遇！被传送到 ${target.icon} ${target.name}`);
            renderPanel();
            setTimeout(() => handleTileLanding(target.id), 300);
        }
    }

    // 触发涩情事件（诱惑之门）
    if (effect.triggerErotic) {
        const state = getMonopolyState();
        const currentTile = getTile(state.位置 || 0);
        const eroticTiles = MAP_NODES.filter(t => t.type === TILE_TYPE.EROTIC);
        if (eroticTiles.length > 0) {
            const target = eroticTiles[Math.floor(Math.random() * eroticTiles.length)];
            updateState(s => { s.位置 = target.id; });
            addLog(`🚪 诱惑之门将你带到了 ${target.icon} ${target.name}`);
            renderPanel();
            setTimeout(() => showScenePanel(target, getMonopolyState()), 300);
        }
    }

    // 升级据点（据点并购）——从已访问据点中选等级最高且可升级的
    if (effect.upgradeCurrentOutpost) {
        const state = getMonopolyState();
        const outposts = state.据点 || {};
        // 找到所有可升级的据点（场景格/涩情格，等级<4）
        let bestTarget = null;
        let bestLevel = -1;
        for (const [nodeId, data] of Object.entries(outposts)) {
            const tile = getTile(parseInt(nodeId));
            if (!tile || (tile.type !== TILE_TYPE.SCENE && tile.type !== TILE_TYPE.EROTIC)) continue;
            const lvl = data.等级 || 0;
            if (lvl >= 4) continue; // 已满级
            if (lvl > bestLevel) {
                bestLevel = lvl;
                bestTarget = { nodeId, tile, data, level: lvl };
            }
        }
        if (bestTarget) {
            const newLevel = Math.min(4, bestTarget.level + effect.upgradeCurrentOutpost);
            updateState(s => {
                if (!s.据点) s.据点 = {};
                if (!s.据点[bestTarget.nodeId]) s.据点[bestTarget.nodeId] = { 光顾次数: 0, 投资额: 0, 等级: 0 };
                s.据点[bestTarget.nodeId].等级 = newLevel;
            });
            const levelName = getOutpostLevel({ 等级: newLevel }).name;
            addLog(`🏗️ 据点并购！${bestTarget.tile.name} 升级为 ${levelName}(Lv.${newLevel})！`);
            renderPanel();
        } else {
            addLog(`⚠️ 没有可升级的据点，并购无效。需要先光顾过场景格。`);
        }
    }

    // 神秘邀请函：触发隐藏事件（纯机械奖励，叙事由"让AI描写"按钮统一处理）
    if (effect.triggerHiddenEvent) {
        const rewards = [
            { chips: 2000, desc: '密室宝藏' },
            { chips: 1000, desc: '名流晚宴' },
            { chips: 500, desc: '神秘商人', items: { '万能钥匙': 1 } },
        ];
        const reward = rewards[Math.floor(Math.random() * rewards.length)];
        updateState(s => {
            s.筹码 = (s.筹码 || 0) + (reward.chips || 0);
            if (reward.items) {
                if (!s.道具) s.道具 = {};
                for (const [name, count] of Object.entries(reward.items)) {
                    s.道具[name] = (s.道具[name] || 0) + count;
                }
            }
        });
        addLog(`📜 神秘邀请函·${reward.desc}`);
        if (reward.chips) addLog(`+${reward.chips} 筹码`);
        if (reward.items) addLog(`获得道具: ${Object.keys(reward.items).join('、')}`);
        renderPanel();
    }

    // 美人的请求：设置buff，下次到达场景格时融入场景描写
    if (effect.triggerFollowUp) {
        activeBuffs.美人请求 = true;
        addLog(`💝 美人的请求：一位神秘美人记住了你的好意，下次到达场景格时她会再次出现...`);
        renderPanel();
    }

    // 老朋友：纯机械奖励（筹码已在effect.chips中处理），叙事由"让AI描写"统一处理
    // triggerOldFriend 标记不再需要额外逻辑，奖励已由上面的 chips 分支处理
}

// ==================== ChatLore 操作 ====================
async function ensureChatLore() {
    try {
        const fn = (typeof getOrCreateChatWorldbook === 'function') ? getOrCreateChatWorldbook : window.parent.getOrCreateChatWorldbook;
        return await fn('current');
    } catch (e) { return null; }
}

async function injectSceneLore(text) {
    const loreName = await ensureChatLore();
    if (!loreName) { addLog('⚠️ 无法注入场景指令'); return false; }
    const updateWB = (typeof updateWorldbookWith === 'function') ? updateWorldbookWith : window.parent.updateWorldbookWith;
    await updateWB(loreName, function(entries) {
        const idx = entries.findIndex(e => e.name === '[场景设定]');
        const entry = {
            name: '[场景设定]',
            content: text,
            enabled: true,
            strategy: { type: 'constant', keys: ['场景设定'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
            position: { type: 'at_depth', role: 'system', depth: 0, order: 900 },
            probability: 100,
        };
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        return entries;
    });
    return true;
}

async function clearSceneLore() {
    const loreName = await ensureChatLore();
    if (!loreName) return;
    const deleteWB = (typeof deleteWorldbookEntries === 'function') ? deleteWorldbookEntries : window.parent.deleteWorldbookEntries;
    if (deleteWB) {
        await deleteWB(loreName, e =>
            e.name === '[场景设定]' || e.name === '[场景氛围指导]' || e.name === '[当前状态]' ||
            e.name === '[大富翁·场景指令]' || e.name === '[大富翁·涩情指导]'  // 兼容旧版条目
        );
    }
}

// ==================== 场景Lore自动清理系统 ====================
// AI回复完成后自动清理ChatLore。如需重新生成，面板提供"重新进入该地点"按钮重新注入。
let _pendingSceneLore = false;       // 是否有待清理的场景lore
let _lastScenePrompt = null;         // 上次注入的场景提示词（用于重新注入）
let _lastSceneTriggerMsg = null;     // 上次的触发消息文本
let _sceneAutoCleanListenerReady = false;

function setupSceneAutoCleanListener() {
    if (_sceneAutoCleanListenerReady) return;
    try {
        // 优先使用 SillyTavern 的全局事件系统 eventOn + tavern_events（与其他脚本一致）
        const _eventOn = (typeof eventOn === 'function') ? eventOn :
            (window.parent && typeof window.parent.eventOn === 'function') ? window.parent.eventOn : null;
        const _tavern_events = (typeof tavern_events !== 'undefined') ? tavern_events :
            (window.parent && window.parent.tavern_events) ? window.parent.tavern_events : null;

        if (_eventOn && _tavern_events && _tavern_events.MESSAGE_RECEIVED) {
            _eventOn(_tavern_events.MESSAGE_RECEIVED, onAIResponseAutoClean);
            _sceneAutoCleanListenerReady = true;
            console.log('[大富翁] 已注册 MESSAGE_RECEIVED 监听（场景lore自动清理）');
        } else {
            // 回退：尝试 eventSource.on
            const es = (window.parent && window.parent.eventSource) ||
                (typeof eventSource !== 'undefined' ? eventSource : null);
            if (es && es.on) {
                es.on('MESSAGE_RECEIVED', onAIResponseAutoClean);
                _sceneAutoCleanListenerReady = true;
                console.log('[大富翁] 已注册 eventSource.on MESSAGE_RECEIVED 监听（回退方案）');
            } else {
                console.warn('[大富翁] 事件系统不可用，场景lore清理将依赖安全超时');
            }
        }
    } catch (e) {
        console.warn('[大富翁] 注册场景自动清理监听失败:', e);
    }
}

function onAIResponseAutoClean() {
    if (!_pendingSceneLore) return;
    _pendingSceneLore = false;
    // AI已回复，自动清理ChatLore（提示词已随prompt发出，不再需要）
    clearSceneLore().catch(() => {});
    if (_sceneLoreSafetyTimer) { clearTimeout(_sceneLoreSafetyTimer); _sceneLoreSafetyTimer = null; }

    // 分基地招募：解析AI回复中的TenantLore标签，提取NPC名并写入分基地住户
    if (activeBuffs._recruitTargetBase) {
        const targetBase = activeBuffs._recruitTargetBase;
        activeBuffs._recruitTargetBase = false;
        try {
            // 从最新AI消息中提取 <TenantLore name="xxx">
            const chatEl = window.parent.document.querySelector('#chat .mes:last-child .mes_text');
            const aiText = chatEl?.textContent || chatEl?.innerText || '';
            const nameMatch = aiText.match(/TenantLore\s+name\s*=\s*"([^"]+)"/);
            if (nameMatch && nameMatch[1]) {
                const npcName = nameMatch[1].trim();
                updateSubBases(bases => {
                    if (bases[targetBase]) {
                        if (!bases[targetBase].住户) bases[targetBase].住户 = [];
                        if (!bases[targetBase].住户.includes(npcName)) {
                            bases[targetBase].住户.push(npcName);
                        }
                    }
                });
                addLog(`🏡 ${npcName} 已分配到分基地「${targetBase}」`);
                console.log(`[大富翁] 招募完成：${npcName} → ${targetBase}`);
            }
        } catch (e) {
            console.warn('[大富翁] 分基地招募NPC名解析失败:', e);
        }
    }

    addLog('🧹 AI已回复，场景指令已自动清理');
    console.log('[大富翁] AI回复完成，自动清理场景lore');
}

// ==================== 聊天切换监听 ====================
// 切换聊天时重置所有内存状态，从新聊天的MVU加载数据
let _chatChangeListenerReady = false;

function setupChatChangeListener() {
    if (_chatChangeListenerReady) return;
    try {
        const _eventOn = (typeof eventOn === 'function') ? eventOn :
            (window.parent && typeof window.parent.eventOn === 'function') ? window.parent.eventOn : null;
        const _tavern_events = (typeof tavern_events !== 'undefined') ? tavern_events :
            (window.parent && window.parent.tavern_events) ? window.parent.tavern_events : null;

        if (_eventOn && _tavern_events && _tavern_events.CHAT_CHANGED) {
            _eventOn(_tavern_events.CHAT_CHANGED, onChatChanged);
            _chatChangeListenerReady = true;
            console.log('[大富翁] 已注册 CHAT_CHANGED 监听（聊天隔离）');
        } else {
            console.warn('[大富翁] CHAT_CHANGED 事件不可用，聊天切换时数据可能不隔离');
        }
    } catch (e) {
        console.warn('[大富翁] 注册 CHAT_CHANGED 监听失败:', e);
    }
}

function onChatChanged() {
    console.log('[大富翁] 检测到聊天切换，重置内存状态');

    // 1. 从新聊天的MVU加载buff
    _loadBuffsFromMvu();

    // 2. 重置场景lore相关状态
    _pendingSceneLore = false;
    _lastScenePrompt = null;
    _lastSceneTriggerMsg = null;
    if (_sceneLoreSafetyTimer) { clearTimeout(_sceneLoreSafetyTimer); _sceneLoreSafetyTimer = null; }

    // 3. 清空日志（新聊天不应该看到旧聊天的日志）
    if (typeof _logEntries !== 'undefined' && Array.isArray(_logEntries)) {
        _logEntries.length = 0;
    }

    // 4. 如果面板正在显示，刷新面板（显示新聊天的数据）
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (panel && panel.style.display !== 'none') {
        renderPanel();
    }
}

// 标记有待清理的场景lore + 保存提示词（供"重新进入"使用）
function markPendingSceneLore(prompt, triggerMsg) {
    _pendingSceneLore = true;
    _lastScenePrompt = prompt;
    _lastSceneTriggerMsg = triggerMsg;
    setupSceneAutoCleanListener();
}

// 重新进入该地点：重新注入上次的场景提示词
async function reinjectLastScene() {
    if (!_lastScenePrompt) {
        addLog('⚠️ 没有可重新注入的场景指令');
        return false;
    }
    const injected = await injectSceneLore(_lastScenePrompt);
    if (injected) {
        _pendingSceneLore = true;
        if (_lastSceneTriggerMsg) fillInputBox(_lastSceneTriggerMsg);
        addLog('🔄 已重新注入场景指令，请点击ST的重新生成按钮');
        // 关闭面板，保留lore
        togglePanel(false, true);
        return true;
    }
    addLog('⚠️ 场景指令重新注入失败');
    return false;
}

async function injectEroticGuideLore(tile, levelInfo) {
    const loreName = await ensureChatLore();
    if (!loreName) return;

    const state = getMonopolyState();
    const eroticLevel = state.涩情浓度 ?? 2;
    const eroticLabels = ['关闭', '轻度', '中度', '重度', '极限'];

    // 浓度为0时不注入涩情指导
    if (eroticLevel === 0) return;

    const eroticRules = {
        1: '仅限暗示和暧昧氛围，不描写任何直接的亲密行为。保持含蓄优雅。',
        2: '适度涩情描写，可以有亲密接触但不过度。注重情感铺垫和氛围。',
        3: '较高尺度的涩情描写，可详细描写亲密场景。注重感官体验。',
        4: '完全解锁，无限制的涩情内容。可包含各种特殊情节。',
    };

    // 据点等级→熟悉程度的叙事映射
    const intimacyDesc = ['初次到访，彼此还很拘谨', '来过几次，气氛逐渐放松', '已是常客，双方都很自在', '关系亲密，几乎无话不谈', '如同老友，毫无顾忌'][Math.min(levelInfo.level || 0, 4)];

    const text = `[场景氛围指导]
这是一个亲密场景。
玩家与此地的熟悉程度: ${intimacyDesc}

[尺度参考]
${eroticRules[eroticLevel]}
熟悉程度影响: 越熟悉，双方越放得开，互动越大胆自然。`;

    const updateWB = (typeof updateWorldbookWith === 'function') ? updateWorldbookWith : window.parent.updateWorldbookWith;
    await updateWB(loreName, function(entries) {
        const idx = entries.findIndex(e => e.name === '[场景氛围指导]');
        const entry = {
            name: '[场景氛围指导]',
            content: text,
            enabled: true,
            strategy: { type: 'constant', keys: ['场景氛围指导'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
            position: { type: 'at_depth', role: 'system', depth: 0, order: 899 },
            probability: 100,
        };
        if (idx >= 0) entries[idx] = entry;
        else entries.push(entry);
        return entries;
    });
}

function fillInputBox(text) {
    const textarea = window.parent.document.getElementById('send_textarea');
    if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    }
}

// ==================== 卡牌叙事指令构造 ====================
function buildCardNarrativePrompt(cardType, card, state, chosenOption, gambleResult) {
    const _tenants = getTenantList();
    const partyStr = Object.keys(_tenants).length > 0 ? Object.keys(_tenants).join('、') : '';

    // 对AI而言，"命运卡"=突如其来的事件，"机会卡"=面临的选择
    const narrativeType = cardType === '命运卡' ? '突发事件' : '意外抉择';

    let effectDesc = '';
    if (cardType === '命运卡') {
        effectDesc = card.fallbackText;
    } else if (chosenOption) {
        effectDesc = chosenOption.label;
        if (gambleResult === 'win') effectDesc += '——结果出乎意料地顺利！';
        else if (gambleResult === 'lose') effectDesc += '——然而事与愿违……';
    }

    return `[场景设定]
类型: ${narrativeType}
事件: ${card.name}
发生了什么: ${effectDesc}
${partyStr ? '同行者: ' + partyStr : ''}
不要输出变量更新。`;
}

// ==================== 场景氛围数据 ====================
// 每个格子的详细氛围描写，让AI有丰富的场景上下文
const SCENE_ATMOSPHERES = {
    1:  '露天市集，摊位密密麻麻。空气里混着烤肉的焦香、香料的辛辣和新鲜水果的甜腻。商贩的叫卖声此起彼伏，人群川流不息，偶尔有街头艺人在角落表演。',
    2:  '静谧的中式庭园，曲径通幽。假山嶙峋，流水淙淙，翠竹掩映着石亭。偶有鸟鸣打破宁静，落花随风飘入池塘。',
    4:  '氤氲缭绕的传统浴场，温泉池散发着袅袅热气。昏黄的灯笼映在雾气中，营造出朦胧暧昧的氛围。木质更衣室散发着桧木的清香。',
    8:  '开阔的露天竞技场，沙地上尘土飞扬。围栏外挤满了下注的观众，擂台上的比武正酣。角落有教练指导新手，气氛热血沸腾。',
    10: '金碧辉煌的赌庄大厅，水晶吊灯璀璨夺目。骰子碰撞声、筹码堆叠声和欢呼声交织。荷官们面无表情地发牌，贵宾区有红绒绳隔开。',
    12: '灯红酒绿的夜宴会场，巨大的水晶球在天花板缓缓旋转，投下斑斓光影。DJ台播放着低沉撩人的音乐，舞池中身影交错。VIP包厢里传出隐约笑声和碰杯声。',
    13: '装潢考究的高端食肆，水晶杯和银质餐具在烛光下闪烁。身着燕尾服的侍者无声穿梭，每道菜都是艺术品。落地窗外是城市的璀璨夜景。',
    15: '古色古香的书院，满架藏书散发着纸墨清香。窗外是修竹掩映的庭院，安静得只听见翻书声和偶尔的茶杯轻放声。阳光透过花窗落下斑驳光影。',
    16: '富丽堂皇的拍卖大厅，红绒座椅排列整齐。拍卖台上聚光灯亮起，身着华服的竞拍者们矜持地举起号牌。空气中弥漫着金钱与欲望的气息。',
    17: '精心布置的私密雅室，层层纱帐低垂，鎏金香炉中青烟袅袅。厚厚的波斯地毯，低矮的软榻，暗红色的灯光让人不自觉放松警惕。',
    24: '深巷尽头的隐秘红坊，大红灯笼摇曳在门楣。推开雕花木门，浓郁的花香扑面而来。绸缎帷幕后传出丝竹声，这里是欲望最不加掩饰的领地。',
    27: '阴暗的地下密室，粗糙的石墙上刻满了奇怪的符号和箭头。火把在铁架上噼啪作响，机关暗门随处可见，空气中有尘土和铁锈的味道。',
    29: '装饰诡异的秘馆，墙上挂满了精致的面具和华丽的戏服。镜面走廊让空间变得迷幻，每个房间都有不同的主题——这里是角色扮演的乐园。',
    32: '隐蔽的情报屋，烟雾缭绕的小隔间里，低声交谈的人影若隐若现。墙上贴满了各种告示和暗号，每条信息都明码标价。',
    36: '停泊在港口的豪华游轮，甲板上灯火通明。海风拂面，远处是城市的万家灯火。船舱内的派对正酣——香槟塔、爵士乐和翩翩起舞的人群。',
    39: '面朝大海的天然岩浴，海浪拍打礁石的声响伴着温泉的热气。星空下的露天浴场，温热的泉水映着月光，远处的灯塔有节奏地闪烁。',
    40: '矗立在海角的古老灯塔，锈迹斑斑的螺旋铁梯通向塔顶。从观景台望去，整片海岸线和星空尽收眼底。海风很大，但夜景绝美——远近闻名的约会圣地。',
    41: '风格迥异的异域酒馆，天花板上挂满各国航海图和异域面具。一个满脸刀疤的老水手在吧台调酒，酒比他的故事还烈。墙角的留声机放着陌生旋律。',
    44: '极为隐秘的高端密会所，厚重的隔音门后是截然不同的世界。奢华至极的内饰，每个包间都有独立的控温和灯光系统，所有感官在这里都会被放大。',
    49: '幽暗神秘的占卜屋，水晶球散发着幽蓝微光。塔罗牌散落在天鹅绒桌布上，干花和蜡烛的气味缠绕。女占卜师的眼睛像猫一样在暗处发亮。',
    50: '高墙环绕的秘密花园，疯长的藤蔓几乎完全遮住了入口。穿过花丛隧道，里面别有洞天——石凉亭、绳秋千、铺满花瓣的草地，是完全与世隔绝的私密空间。',
    51: '幽暗的地下迷宫通道，墙壁上的火把投下摇曳的影子。空气潮湿阴冷，岔路口的石碑上刻着神秘的指引。远处传来流水声，不知通向何方。',
    53: '码头角落的走私据点，木箱和铁桶堆积如山。几个面色阴沉的人在油灯下清点货物，空气中弥漫着咸腥和机油味。所有交易都用暗号进行。',
    54: '隐蔽在暗巷深处的幽会角落，层层纱帘和银铃铛将外面的喧嚣隔绝。蜡烛的暖光透过帘缝，里面铺着厚厚的绒毯和靠枕——为私密约会而生的空间。',
    55: '赏金猎人的营地，粗木桌上摊着地图和通缉令。武器架上摆着弓弩和短刀，一群彪悍的人围坐在篝火旁讨论目标。刀光火影间充满冒险的气息。',
    56: '地下空间改造的幽灵酒吧，墙壁和天花板画满了荧光骷髅和鬼火。紫外线灯下所有人的白衣都在发光。诡异的电子乐和特效鸡尾酒是这里的招牌。',
    57: '酒吧后门的一道暗门，知道入口的人寥寥无几。推开门是另一个世界——低矮的天花板、昏暗的暖光、柔软的地面。这里没有身份，没有规则，只有此刻。',
    59: '月光下的地下集市，摊位上摆满了地面上绝对找不到的东西。每个摊主都戴着面具不问来路，稀有药材、禁书、奇巧淫技——只要你开得起价。',
};

// 等级→场景体验差异（正经场景）
const LEVEL_SCENE_FLAVOR = [
    // Lv0: 初来乍到
    '这是玩家第一次来这里。一切都很新鲜，但也很陌生。周围的人用审视的目光打量着这个新面孔。玩家需要自己摸索这里的规矩。',
    // Lv1: 初识
    '玩家来过这里几次了。有几个工作人员已经认出了他，会主动点头招呼。玩家开始了解这里的门道，但还有很多地方没去过。',
    // Lv2: 常客
    '玩家是这里的常客了。工作人员看到他就会露出熟络的笑容，不用问就知道他的偏好。一些平时不对外开放的区域也向他敞开了门。',
    // Lv3: 深交
    '玩家在这里已经如鱼得水。老板会亲自出来招呼，给他留最好的位置。这里的每个人都知道他的名字，有什么内部消息也会第一时间告诉他。',
    // Lv4: 合伙人
    '玩家几乎是这里的半个主人。他有专属的VIP通道和贵宾区，甚至参与了一些经营决策。所有人对他都恭恭敬敬，这里就是他的第二个家。',
];

// 等级→涩情场景体验差异
const LEVEL_EROTIC_FLAVOR = [
    // Lv0: 初来乍到
    '这是玩家第一次踏入这种地方。空气中的暧昧氛围让他有些紧张和不知所措。这里的人看出他是新人，态度可能是热情引导，也可能是居高临下。',
    // Lv1: 初识
    '玩家已经来过几次了。最初的紧张已经消退，取而代之的是好奇和期待。这里的人开始记住他的样子，接待也更加自然。',
    // Lv2: 常客
    '玩家是这里的老熟客了。不用多说，对方就知道他喜欢什么。双方的互动更加坦率和直接，少了很多客套的试探。一些私密的"特别服务"也向他开放了。',
    // Lv3: 深交
    '玩家和这里的人已经建立了深厚的信任和默契。不再是简单的服务关系，而是更像朋友甚至恋人。互动充满了独属于老情人的默契和大胆。',
    // Lv4: 合伙人
    '玩家已经是这里最特殊的存在。他可以提出任何要求，对方也会毫无保留地配合。双方之间早已超越了身体的亲密，有一种深入灵魂的了解和信赖。',
];

// 融合光顾次数+据点等级→不矛盾的熟悉度描述
// visits=实际来过几次, lvl=据点等级(可通过投资提升), isErotic=是否涩情场景
function buildFamiliarityFlavor(visits, lvl, isErotic) {
    // 来访描述
    let visitDesc = '';
    if (visits <= 1) visitDesc = '第一次来';
    else if (visits <= 3) visitDesc = `来过${visits}次`;
    else if (visits <= 8) visitDesc = `来过${visits}次，算是熟面孔`;
    else visitDesc = `来过${visits}次，对这里了如指掌`;

    // 等级与来访次数一致时，直接用原有的等级描述
    if (lvl === 0 && visits <= 1) return isErotic ? LEVEL_EROTIC_FLAVOR[0] : LEVEL_SCENE_FLAVOR[0];
    if (lvl === 1 && visits >= 2 && visits <= 3) return isErotic ? LEVEL_EROTIC_FLAVOR[1] : LEVEL_SCENE_FLAVOR[1];
    if (lvl === 2 && visits >= 4 && visits <= 8) return isErotic ? LEVEL_EROTIC_FLAVOR[2] : LEVEL_SCENE_FLAVOR[2];
    if (lvl >= 3 && visits >= 9) return isErotic ? LEVEL_EROTIC_FLAVOR[Math.min(lvl, 4)] : LEVEL_SCENE_FLAVOR[Math.min(lvl, 4)];

    // 等级高于来访暗示的熟悉度→通过投资/人脉获得了地位
    if (lvl > 0 && visits <= 1) {
        const statusDesc = ['', '有人提前打过招呼', '私下里已经成为了贵宾', '背后有深厚的人脉关系', '实际上是这里的幕后投资人'][Math.min(lvl, 4)];
        if (isErotic) {
            return `玩家${visitDesc}。虽然人还没来过，但${statusDesc}。这里的人早就接到了通知，对他格外殷勤和热情。初次见面却有一种微妙的"久仰大名"的亲近感。`;
        }
        return `玩家${visitDesc}。虽然是新面孔，但${statusDesc}。工作人员一见面就认出了他的身份，态度恭敬而热络，引领他去了专属区域。`;
    }

    if (lvl > 0 && visits >= 2 && visits <= 3) {
        const statusDesc = ['', '', '已经是这里的VIP了', '和这里的管理层关系很深', '几乎是半个老板了'][Math.min(lvl, 4)];
        if (isErotic) {
            return `玩家${visitDesc}，但${statusDesc}。来的次数不多，但每次都会得到最好的招待。双方虽然还在互相了解，但地位上的优势让互动更加大胆直接。`;
        }
        return `玩家${visitDesc}，但${statusDesc}。虽然还在熟悉这里的一切，但所到之处都享受着特殊待遇。`;
    }

    // 来访多但等级低→常来但没有深入投资
    if (lvl === 0 && visits >= 2) {
        if (isErotic) {
            return `玩家${visitDesc}。虽然来过不少次，但一直是普通客人的身份。这里的人对他有印象，但还没有特别的关系。每次来都是随缘的态度。`;
        }
        return `玩家${visitDesc}。虽然经常来，但始终是个普通访客。工作人员认得他的脸，会客气地打招呼，但也仅此而已。`;
    }

    // 兜底：直接用等级描述
    return isErotic ? LEVEL_EROTIC_FLAVOR[Math.min(lvl, 4)] : LEVEL_SCENE_FLAVOR[Math.min(lvl, 4)];
}

// 同伴互动指导模板（selectedMembers: string[]）
function buildCompanionGuidance(selectedMembers, tenants, isErotic) {
    if (!selectedMembers || selectedMembers.length === 0) {
        return isErotic
            ? '玩家选择独自前来。请安排场地内的原有角色（如服务员、常客等）与玩家互动，自由发挥创造对象。'
            : '玩家独自一人。描写他独自探索和体验的过程，可以安排路人或工作人员的有趣互动。';
    }
    if (selectedMembers.length === 1) {
        const name = selectedMembers[0];
        const info = tenants?.[name];
        const charDesc = info ? `（${info.年龄 || '?'}岁，${info.职业 || '未知'}，性格${info.性格 || '未知'}）` : '';
        if (isErotic) {
            return `玩家选择和${name}${charDesc}一起进入。两人独处，其他同伴不在场。
请根据${name}的性格特点决定她的反应——是主动还是害羞，是热情还是矜持。
两人的互动应该自然升温，节奏不要太急。`;
        } else {
            return `玩家带着${name}${charDesc}一起来了。两人一起体验这个场所。
请让${name}的言行符合她的性格——她对这里的反应、她和玩家之间的互动，都应该鲜活自然。`;
        }
    }
    // 多人同行
    const descs = selectedMembers.map(name => {
        const info = tenants?.[name];
        return info ? `${name}（${info.职业 || '未知'}，${info.性格 || ''}）` : name;
    });
    if (isErotic) {
        return `玩家带着${descs.join('、')}一起来了。这是多人共处的场景。
请让每个同伴都有符合各自性格的反应和互动——有的可能主动大胆，有的可能害羞旁观。
角色之间也可以有互动和微妙的竞争关系。氛围应该暧昧而热闹。`;
    } else {
        return `玩家带着${descs.join('、')}一起来了。
请让每个人都有自己独特的反应和言行，展现不同的性格。同伴之间也可以有有趣的互动和化学反应。`;
    }
}

// ==================== 场景指令构造 ====================
function buildScenePrompt(tile, state, selectedMembers, allowNpcEncounter = true) {
    const outpost = state.据点?.[String(tile.id)] || {};
    const levelInfo = getOutpostLevel(outpost);
    const lvl = Math.min(outpost.等级 || 0, 4);
    const tenants = _readMvuVars();
    const tenantData = tenants ? _.get(tenants, 'stat_data.租客列表', {}) : {};

    const isErotic = tile.type === TILE_TYPE.EROTIC;

    // 检查道具buff
    const hasVIP = activeBuffs.VIP邀请函;
    const hasWine = activeBuffs.红酒;
    const hasPotion = activeBuffs.神秘药水;
    const hasKey = activeBuffs.万能钥匙;
    const hasCostume = activeBuffs.变装道具;
    const hasFree = isErotic && activeBuffs.免费体验;
    const hasBeauty = activeBuffs._美人邂逅本次;
    if (hasVIP) { activeBuffs.VIP邀请函 = false; addLog(`💌 VIP邀请函已使用`); }
    if (hasWine) { activeBuffs.红酒 = false; addLog(`🍷 红酒已使用`); }
    if (hasPotion) { activeBuffs.神秘药水 = false; addLog(`💊 神秘药水已使用`); }
    if (hasKey) { activeBuffs.万能钥匙 = false; addLog(`🗝️ 万能钥匙已使用`); }
    if (hasCostume) { activeBuffs.变装道具 = false; addLog(`🎭 变装道具已使用`); }
    if (hasFree) { activeBuffs.免费体验 = false; addLog(`🌟 免费体验已使用`); }
    if (hasBeauty) { activeBuffs._美人邂逅本次 = false; }

    // buff→叙事化情境描述（AI不知道这是"道具"）
    const situationHints = [];
    if (hasBeauty) situationHints.push('玩家刚到这里，一位之前帮助过的美丽陌生人意外出现了。她对玩家心存感激，主动前来道谢，气氛暧昧而温馨。请在场景中自然融入这段浪漫的再次邂逅。');
    if (isErotic && hasVIP) situationHints.push('玩家手持一张神秘的VIP邀请函，被引导进入了更私密、更高级的区域。');
    if (isErotic && hasWine) situationHints.push('玩家此刻微醺，酒精让他更加大胆和放松，感官也更敏锐。');
    if (isErotic && hasPotion) situationHints.push('玩家之前喝下了一瓶来路不明的药水，身体正在产生奇妙的变化——皮肤变得敏感，体温升高。');
    if (hasKey) situationHints.push('玩家偶然获得了一把万能钥匙，打开了一扇通常不对外开放的门，进入了一个隐秘的空间。');
    if (isErotic && hasCostume) situationHints.push('玩家带来了一套变装道具，提议来一场角色扮演（护士/女仆/制服等，自由发挥主题）。');
    if (hasFree) situationHints.push('这是一次完全偶然的邂逅——玩家原本只是路过，却被意外邀请进来体验。');

    // 场景氛围（优先使用专属描写，否则用tile.desc）
    const atmosphere = SCENE_ATMOSPHERES[tile.id] || tile.desc || '一个值得探索的有趣地方。';

    // 融合光顾次数+据点等级→一段不矛盾的熟悉度描述
    const visits = outpost.光顾次数 || 0;
    const familiarityFlavor = buildFamiliarityFlavor(visits, lvl, isErotic);

    // 同伴互动指导
    const companionGuide = buildCompanionGuidance(selectedMembers, tenantData, isErotic);

    return `[场景设定]
地点: ${tile.name}
氛围: ${atmosphere}

[场景过渡]
玩家正在前往${tile.name}。请先描写前往的过程（路上的见闻、氛围变化、内心期待等），然后自然过渡到到达后的场景。不要一开始就写"已经到了"或"走进了"，要有一个自然的过渡感。

[玩家与此地]
${familiarityFlavor}

[同伴情况]
${companionGuide}
${situationHints.length > 0 ? '\n[特殊情境]\n' + situationHints.join('\n') : ''}
${isErotic && (state.涩情浓度 ?? 2) > 0 ? `\n[亲密尺度]\n偏好: ${['关闭','轻度暗示','适度描写','较高尺度','完全解锁'][state.涩情浓度 ?? 2]}。请结合玩家与此地的熟悉程度自然决定具体尺度——初次到访应含蓄克制，关系深厚则可以大胆直接。` : ''}
${!allowNpcEncounter ? `\n[注意]\n玩家不希望在这次场景中遇到新角色。不要引入任何有名字的NPC，不要安排偶遇或搭讪。${selectedMembers && selectedMembers.length > 0 ? `专注与${selectedMembers.join('、')}的互动。` : '专注环境体验和内心感受。'}` : ''}
不要输出变量更新。`;
}

// ==================== 场景格处理 ====================
function handleSceneTile(tile) {
    const state = getMonopolyState();
    const outpost = state.据点?.[String(tile.id)] || { 光顾次数: 0, 投资额: 0, 等级: 0 };

    // 增加光顾次数
    const newVisits = (outpost.光顾次数 || 0) + 1;
    const eventText = `第${state.回合 || 0}回合: 到达 ${tile.icon} ${tile.name}`;
    updateState(s => {
        if (!s.据点) s.据点 = {};
        s.据点[String(tile.id)] = { ...outpost, 光顾次数: newVisits };
        s.最近事件 = [...(s.最近事件 || []), eventText].slice(-5);
    });

    const levelInfo = getOutpostLevel(outpost);
    addLog(`到达 ${tile.icon} ${tile.name} (${levelInfo.name}, 第${newVisits}次光顾)`);

    // 美人请求buff：消耗并标记，实际效果融入buildScenePrompt的场景描写
    if (activeBuffs.美人请求) {
        activeBuffs.美人请求 = false;
        activeBuffs._美人邂逅本次 = true; // 临时flag，buildScenePrompt中消耗
        addLog(`💝 那位神秘美人出现了！`);
    }

    // 先刷新面板基础UI，再显示场景overlay（避免renderPanel销毁overlay）
    renderPanel();
    showScenePanel(tile, getMonopolyState());
}

// ==================== 场景交互面板（含据点投资） ====================
function showScenePanel(tile, state) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    // 移除已有的overlay
    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const isErotic = tile.type === TILE_TYPE.EROTIC;

    // requireParty检查：需要有租客才能进入
    if (tile.requireParty) {
        const tenantCheck = getTenantList();
        if (Object.keys(tenantCheck).length === 0) {
            addLog(`⚠️ ${tile.name} 需要有租客才能进入！先招募NPC吧。`);
            return;
        }
    }

    const outpost = state.据点?.[String(tile.id)] || { 光顾次数: 0, 投资额: 0, 等级: 0 };
    const levelInfo = getOutpostLevel(outpost);
    const upgradeInfo = canUpgradeOutpost(outpost, state.筹码 || 0);

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div class="mp-scene-header">${tile.icon} ${tile.name}</div>`;
    html += `<div class="mp-scene-desc">${tile.desc || '一个有趣的地方'}</div>`;

    // ---- 据点信息区 ----
    html += `<div class="mp-outpost-info">`;
    html += `<div class="mp-outpost-level">`;
    html += `<span class="mp-outpost-badge mp-outpost-lv${outpost.等级 || 0}">${levelInfo.name}</span>`;
    html += `<span style="font-size:11px;color:#6B7280;">Lv.${outpost.等级 || 0}</span>`;
    html += `</div>`;
    html += `<div class="mp-outpost-stats">`;
    html += `<span>👥 租客 ${Object.keys(getTenantList()).length}人</span>`;
    html += `<span>💰 已投资 ${outpost.投资额 || 0}</span>`;
    if (levelInfo.dividendPerCycle > 0) {
        html += `<span>📈 分红 ${levelInfo.dividendPerCycle}/周期</span>`;
    }
    if (levelInfo.discount > 0 && levelInfo.discount < 1) {
        html += `<span>🏷️ ${Math.round(levelInfo.discount * 10)}折优惠</span>`;
    } else if (levelInfo.discount === 0) {
        html += `<span>🏷️ 免费消费</span>`;
    }
    html += `</div>`;

    // ---- 升级进度 ----
    if (upgradeInfo.canUpgrade && upgradeInfo.nextLevel) {
        const next = upgradeInfo.nextLevel;
        const visitProgress = Math.min(outpost.光顾次数 || 0, next.visitReq);
        const investProgress = Math.min(outpost.投资额 || 0, next.investReq);
        html += `<div class="mp-outpost-upgrade">`;
        html += `<div style="font-size:12px;font-weight:700;margin-bottom:6px;">⬆️ 升级到 ${next.name} (Lv.${next.level})</div>`;
        // 光顾进度条
        html += `<div class="mp-progress-row">`;
        html += `<span class="mp-progress-label">👥 租客</span>`;
        html += `<div class="mp-progress-bar"><div class="mp-progress-fill" style="width:${Math.round(visitProgress / next.visitReq * 100)}%;"></div></div>`;
        html += `<span class="mp-progress-text">${visitProgress}/${next.visitReq}</span>`;
        html += `</div>`;
        // 投资进度条
        html += `<div class="mp-progress-row">`;
        html += `<span class="mp-progress-label">💰 投资</span>`;
        html += `<div class="mp-progress-bar"><div class="mp-progress-fill mp-progress-fill-gold" style="width:${Math.round(investProgress / next.investReq * 100)}%;"></div></div>`;
        html += `<span class="mp-progress-text">${investProgress}/${next.investReq}</span>`;
        html += `</div>`;
        // 投资按钮（考虑投资折扣buff）
        if (upgradeInfo.investNeeded > 0) {
            const hasDiscount = activeBuffs.投资折扣;
            const displayCost = hasDiscount ? Math.floor(upgradeInfo.investNeeded * 0.5) : upgradeInfo.investNeeded;
            const canAffordInvest = (state.筹码 || 0) >= displayCost;
            html += `<button class="mp-btn ${canAffordInvest ? 'mp-btn-invest' : ''}" data-action="outpost-invest" ${canAffordInvest ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>`;
            html += `💎 投资 ${displayCost} 筹码升级`;
            if (hasDiscount) html += ` <span style="font-size:10px;color:#10B981;">🤝半价</span>`;
            html += `</button>`;
            if (!canAffordInvest) {
                html += `<div style="font-size:10px;color:#EF4444;margin-top:2px;">筹码不足（当前: ${state.筹码 || 0}）</div>`;
            }
        } else if (upgradeInfo.meetsVisits) {
            // 光顾次数已满足，可以免费升级
            html += `<button class="mp-btn mp-btn-invest" data-action="outpost-upgrade-free">⭐ 光顾达标，免费升级！</button>`;
        }
        // 下一级收益预览
        html += `<div class="mp-outpost-preview">`;
        if (next.dividendPerCycle > 0) html += `<span>📈 分红 +${next.dividendPerCycle}/周期</span>`;
        if (next.discount > 0 && next.discount < 1) html += `<span>🏷️ ${Math.round(next.discount * 10)}折</span>`;
        else if (next.discount === 0) html += `<span>🏷️ 免费消费</span>`;
        html += `</div>`;
        html += `</div>`;
    } else if (!upgradeInfo.canUpgrade && outpost.等级 >= 3) {
        html += `<div style="text-align:center;padding:6px;font-size:11px;color:#F59E0B;">👑 已达最高等级：合伙人</div>`;
    }
    html += `</div>`; // end mp-outpost-info

    // ---- 分隔线 ----
    html += `<div style="border-top:1px solid #374151;margin:12px 0;"></div>`;

    // ---- 同伴选择（所有场景类型通用） ----
    // 收集所有租客（租客列表 + 分基地住户去重）
    const vars = _readMvuVars();
    const tenantData = vars ? _.get(vars, 'stat_data.租客列表', {}) : {};
    const subBasesData = vars ? _.get(vars, 'stat_data.分基地', {}) : {};
    const allCompanions = [];
    for (const [name, info] of Object.entries(tenantData)) {
        allCompanions.push({ name, desc: `${info.职业 || '未知'}，${info.性格 || ''}` });
    }
    for (const [baseName, base] of Object.entries(subBasesData)) {
        for (const resident of (base.住户 || [])) {
            if (!allCompanions.find(c => c.name === resident)) {
                allCompanions.push({ name: resident, desc: '' });
            }
        }
    }

    html += `<div style="font-size:12px;font-weight:700;color:#C084FC;margin-bottom:6px;">场景选项：</div>`;

    // 同伴选择（checkbox多选，不勾选=独自前往）
    if (allCompanions.length > 0) {
        html += `<div style="font-size:11px;color:#9CA3AF;margin-bottom:4px;">带谁一起？<span style="color:#6B7280;">（可多选，不勾=独自）</span></div>`;
        html += `<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;max-height:160px;overflow-y:auto;">`;
        for (const c of allCompanions) {
            html += `<label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1.5px solid #374151;border-radius:8px;cursor:pointer;font-size:11px;" class="mp-companion-opt">`;
            html += `<input type="checkbox" name="mp-companion" value="${c.name}" style="accent-color:#7C3AED;" />`;
            html += `<span>🫂 ${c.name}${c.desc ? ` <span style="color:#6B7280;">(${c.desc})</span>` : ''}</span></label>`;
        }
        html += `</div>`;
    }

    // 偶遇NPC开关
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">`;
    html += `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;">`;
    html += `<input type="checkbox" id="mp-npc-encounter" checked style="accent-color:#7C3AED;" />`;
    html += `<span>🎭 允许偶遇NPC</span>`;
    html += `</label>`;
    html += `<span style="font-size:10px;color:#6B7280;">关闭后场景中不会出现新角色</span>`;
    html += `</div>`;

    // ---- 场景进入按钮 ----
    html += `<div class="mp-scene-options">`;
    html += `<button class="mp-btn mp-btn-primary" data-action="scene-go">✨ 进入场景</button>`;
    html += `<button class="mp-btn" data-action="scene-recruit" data-tile-id="${tile.id}">🫂 招募</button>`;
    html += `<button class="mp-btn" data-action="scene-skip">⏭️ 跳过</button>`;
    html += `</div>`;

    html += `</div></div>`;

    // 追加到面板（不替换）
    panel.insertAdjacentHTML('beforeend', html);

    // 绑定事件
    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', async function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'outpost-invest') {
            // 筹码投资升级据点
            const currentState = getMonopolyState();
            const currentOutpost = currentState.据点?.[String(tile.id)] || { 光顾次数: 0, 投资额: 0, 等级: 0 };
            const info = canUpgradeOutpost(currentOutpost, currentState.筹码 || 0);
            if (info.canUpgrade && info.investNeeded > 0) {
                let cost = info.investNeeded;
                // 投资折扣buff（贵人相助）— 先算折扣再判断能否负担
                if (activeBuffs.投资折扣) {
                    cost = Math.floor(cost * 0.5);
                }
                if ((currentState.筹码 || 0) < cost) {
                    addLog(`⚠️ 筹码不足！升级需要 ${cost} 筹码${activeBuffs.投资折扣 ? '（已含半价优惠）' : ''}`);
                    return;
                }
                if (activeBuffs.投资折扣) {
                    activeBuffs.投资折扣 = false;
                    addLog(`🤝 贵人相助生效！投资费用减半！`);
                }
                updateState(s => {
                    s.筹码 = (s.筹码 || 0) - cost;
                    if (!s.据点) s.据点 = {};
                    if (!s.据点[String(tile.id)]) s.据点[String(tile.id)] = { 光顾次数: 0, 投资额: 0, 等级: 0 };
                    s.据点[String(tile.id)].投资额 = (s.据点[String(tile.id)].投资额 || 0) + info.investNeeded;
                    s.据点[String(tile.id)].等级 = info.nextLevel.level;
                });
                addLog(`💎 投资 ${cost} 筹码，${tile.name} 升级为 ${info.nextLevel.name}(Lv.${info.nextLevel.level})！`);
                overlay.remove();
                renderPanel();
                showScenePanel(tile, getMonopolyState()); // 刷新面板显示新等级
            }
        } else if (action === 'outpost-upgrade-free') {
            // 光顾次数达标，免费升级
            const currentState = getMonopolyState();
            const currentOutpost = currentState.据点?.[String(tile.id)] || { 光顾次数: 0, 投资额: 0, 等级: 0 };
            const info = canUpgradeOutpost(currentOutpost, currentState.筹码 || 0);
            if (info.canUpgrade && info.meetsVisits) {
                updateState(s => {
                    if (!s.据点) s.据点 = {};
                    if (!s.据点[String(tile.id)]) s.据点[String(tile.id)] = { 光顾次数: 0, 投资额: 0, 等级: 0 };
                    s.据点[String(tile.id)].等级 = info.nextLevel.level;
                });
                addLog(`⭐ ${tile.name} 光顾达标，升级为 ${info.nextLevel.name}(Lv.${info.nextLevel.level})！`);
                overlay.remove();
                renderPanel();
                showScenePanel(tile, getMonopolyState());
            }
        } else if (action === 'scene-skip') {
            overlay.remove();
            addLog('跳过场景');
        } else if (action === 'scene-recruit') {
            overlay.remove();
            showSceneRecruitPanel(tile);
        } else if (action === 'scene-go') {
            // 从checkbox读取同伴选择（多选）
            const companionChecks = overlay.querySelectorAll('input[name="mp-companion"]:checked');
            const selectedMembers = Array.from(companionChecks).map(cb => cb.value);
            // 从checkbox读取偶遇NPC开关
            const npcEncounterCb = doc.getElementById('mp-npc-encounter');
            const allowNpcEncounter = npcEncounterCb ? npcEncounterCb.checked : true;
            overlay.remove();

            // 构造场景指令（传入选中的成员 + NPC偶遇开关）
            const currentState = getMonopolyState();
            const prompt = buildScenePrompt(tile, currentState, selectedMembers, allowNpcEncounter);
            const injected = await injectSceneLore(prompt);

            // 涩情场景额外注入涩情指导
            if (tile.type === TILE_TYPE.EROTIC) {
                const outpostData = currentState.据点?.[String(tile.id)] || {};
                await injectEroticGuideLore(tile, getOutpostLevel(outpostData));
            }

            if (injected) {
                // 构造沉浸式触发消息（前往式过渡，不直接进入）
                let triggerMsg = `*我朝着${tile.name}的方向走去`;
                if (selectedMembers.length === 1) {
                    triggerMsg += `，${selectedMembers[0]}跟在我身边`;
                } else if (selectedMembers.length > 1) {
                    triggerMsg += `，${selectedMembers.join('和')}跟在我身边`;
                }
                triggerMsg += `*`;
                fillInputBox(triggerMsg);
                addLog(`📝 场景指令已注入，请发送消息触发AI叙事`);

                // 关闭大富翁面板让用户看到主聊天（跳过清理，保留场景指令给AI）
                togglePanel(false, true);
                markPendingSceneLore(prompt, triggerMsg);
            } else {
                addLog('⚠️ 场景指令注入失败');
            }
        }
    });
}

// ==================== 房产格处理 ====================
function handlePropertyTile(tile) {
    const state = getMonopolyState();
    const subBases = getSubBases();
    const cost = tile.propertyCost || 3000;

    if (subBases[tile.name]) {
        const base = subBases[tile.name];
        const residents = (base.住户 || []).join('、') || '无人入住';
        addLog(`🏠 ${tile.name}：你的房产（住户: ${residents}）`);
        renderPanel();
    } else {
        addLog(`🏠 ${tile.name}：${(state.筹码 || 0) >= cost ? '可以购买' : '筹码不足'}（${cost}筹码）`);
        // 先刷新面板再显示overlay（避免renderPanel销毁overlay）
        renderPanel();
        showPropertyPanel(tile, getMonopolyState(), cost);
    }
}

function showPropertyPanel(tile, state, cost) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const canAfford = (state.筹码 || 0) >= cost;

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card">`;
    html += `<div class="mp-scene-header">${tile.icon} ${tile.name}</div>`;
    html += `<div class="mp-scene-desc">${tile.desc || '一处可购买的房产'}</div>`;
    html += `<div style="font-size:18px;font-weight:800;color:${canAfford ? '#6C5CE7' : '#EF4444'};margin:12px 0;">💰 ${cost} 筹码</div>`;
    html += `<div style="font-size:12px;color:#9CA3AF;margin-bottom:12px;">当前筹码: ${state.筹码 || 0}</div>`;

    html += `<div class="mp-scene-options">`;
    if (canAfford) {
        html += `<button class="mp-btn mp-btn-primary" data-action="property-buy">🏠 购买</button>`;
    } else {
        html += `<button class="mp-btn" disabled style="opacity:0.5;cursor:not-allowed;">筹码不足</button>`;
    }
    html += `<button class="mp-btn" data-action="property-skip">跳过</button>`;
    html += `</div></div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'property-buy') {
            updateState(s => { s.筹码 = (s.筹码 || 0) - cost; });
            updateSubBases(bases => { bases[tile.name] = { 描述: tile.desc || '', 住户: [] }; });
            addLog(`🏠 购买了 ${tile.name}！花费 ${cost} 筹码`);
            overlay.remove();
            renderPanel();
        } else if (btn.dataset.action === 'property-skip') {
            overlay.remove();
            addLog('跳过购买');
        }
    });
}

// ==================== NPC招募系统（AI生成TenantLore，正则自动接管） ====================
// 统一入口：选择安置地点 → 注入ChatLore招募指令 → AI生成<TenantLore> → 现有正则渲染档案卡片
// tile参数可选：从场景面板进入时传入当前格子，从工具栏进入时为null
function showRecruitPanel(tile) {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const subBases = getSubBases();
    const baseEntries = Object.entries(subBases);
    const currentTile = tile || getTile(getMonopolyState().位置 || 0);

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:380px;">`;
    html += `<div class="mp-scene-header">🫂 招募NPC为租客</div>`;
    html += `<div class="mp-scene-desc" style="font-size:11px;color:#9CA3AF;margin-bottom:8px;">在场景中遇到喜欢的NPC？选择安置地点后，AI会自动生成租客档案。</div>`;

    // 安置地点选择
    html += `<div style="font-size:12px;font-weight:700;color:#C084FC;margin-bottom:6px;">选择安置地点：</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">`;

    // 主基地（公寓）— 入住后走正则的房间选择器
    html += `<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid #374151;border-radius:10px;cursor:pointer;transition:all 0.15s;" class="mp-recruit-dest" data-dest="apartment">`;
    html += `<input type="radio" name="mp-recruit-dest" value="apartment" checked style="accent-color:#7C3AED;" />`;
    html += `<div><div style="font-size:12px;font-weight:600;">🏠 公寓（主基地）</div>`;
    html += `<div style="font-size:10px;color:#9CA3AF;">档案生成后，用正则卡片的「办理入住」选择具体卧室</div></div>`;
    html += `</label>`;

    // 已购买的分基地
    for (const [baseName, base] of baseEntries) {
        const residents = base.住户 || [];
        html += `<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid #374151;border-radius:10px;cursor:pointer;transition:all 0.15s;" class="mp-recruit-dest" data-dest="${baseName}">`;
        html += `<input type="radio" name="mp-recruit-dest" value="${baseName}" style="accent-color:#7C3AED;" />`;
        html += `<div><div style="font-size:12px;font-weight:600;">🏡 ${baseName}</div>`;
        html += `<div style="font-size:10px;color:#9CA3AF;">住户: ${residents.length}人</div></div>`;
        html += `</label>`;
    }
    html += `</div>`;

    // 可选补充描述
    html += `<div style="display:flex;gap:6px;align-items:start;margin-bottom:8px;">`;
    html += `<label style="font-size:11px;font-weight:700;width:50px;flex-shrink:0;margin-top:6px;">补充</label>`;
    html += `<textarea id="mp-recruit-hint" placeholder="可选：对NPC的补充描述（如外貌偏好、性格要求等）" rows="2" style="flex:1;padding:6px 10px;border:1.5px solid #374151;border-radius:8px;font-size:12px;outline:none;resize:vertical;background:#1A1A2E;color:#E5E7EB;"></textarea>`;
    html += `</div>`;

    html += `<div class="mp-scene-options">`;
    html += `<button class="mp-btn mp-btn-primary" data-action="recruit-go">🫂 让AI生成档案</button>`;
    html += `<button class="mp-btn" data-action="recruit-cancel">取消</button>`;
    html += `</div>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    // 选中高亮
    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.querySelectorAll('.mp-recruit-dest').forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            overlay.querySelectorAll('.mp-recruit-dest').forEach(l => l.style.borderColor = '#374151');
            if (radio.checked) label.style.borderColor = '#7C3AED';
        });
        if (radio.checked) label.style.borderColor = '#7C3AED';
    });

    overlay.addEventListener('click', async function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'recruit-cancel') {
            overlay.remove();
            if (tile) showScenePanel(tile, getMonopolyState());
            return;
        }

        if (btn.dataset.action === 'recruit-go') {
            const selected = overlay.querySelector('input[name="mp-recruit-dest"]:checked')?.value;
            if (!selected) return;

            const hint = doc.getElementById('mp-recruit-hint')?.value?.trim() || '';
            const isApartment = selected === 'apartment';
            const destName = isApartment ? '公寓（主基地）' : selected;
            const tileName = currentTile?.name || '街头';

            // 构建招募指令prompt
            let prompt = `[招募指令]\n`;
            prompt += `类型: NPC招募\n`;
            prompt += `场景来源: ${tileName}\n`;
            prompt += `安置地点: ${destName}\n`;
            if (hint) prompt += `用户补充: ${hint}\n`;
            prompt += `\n`;
            prompt += `请根据刚才在「${tileName}」场景中出现的NPC，生成一份租客档案。\n\n`;
            prompt += `输出要求：\n`;
            prompt += `1. 先用1-2段简短叙事描写玩家邀请NPC成为租客的过程\n`;
            prompt += `2. 然后输出 <TenantLore name="NPC名"> 标签，格式如下：\n`;
            prompt += `<TenantLore name="NPC名">\n`;
            prompt += `基本信息：\n姓名：xxx\n年龄：xx岁\n职业：xxx\n外貌：xxx\n`;
            prompt += `性格特点：\n（3-5条，每条一行）\n`;
            prompt += `背景故事：\n（2-4句完整段落）\n`;
            prompt += `兴趣爱好：\n（3-5条，每条一行）\n`;
            prompt += `生活习惯：\n（3-5条，每条一行）\n`;
            prompt += `</TenantLore>\n\n`;
            prompt += `格式规则：不要使用markdown符号（** * - 等），每个分类后面加冒号，每项信息一行。\n`;

            if (isApartment) {
                prompt += `\n安置说明：该NPC将入住公寓。档案生成后，用户会通过界面选择具体卧室并办理入住。此处不需要输出<UpdateVariable>。\n`;
                prompt += `档案输出后，请提示用户："请在界面上确认档案后，点击「添加常驻记忆」保存，然后点击「办理入住」选择卧室。"\n`;
            } else {
                prompt += `\n安置说明：该NPC将入住分基地「${selected}」。请在档案之后追加<UpdateVariable>，将NPC写入租客列表。\n`;
                prompt += `注意：只需要更新租客列表，分基地「${selected}」的住户列表由脚本自动更新，不要在JSONPatch中操作分基地路径。\n`;
                prompt += `参考格式：\n`;
                prompt += `<UpdateVariable>\n<Analysis>\n- New tenant recruited, assigned to sub-base "${selected}"\n</Analysis>\n`;
                prompt += `<JSONPatch>\n[\n`;
                prompt += `  { "op": "insert", "path": "/租客列表/NPC真实姓名", "value": { "年龄": 数字, "外貌": "简短描述", "职业": "职业名", "性格": "性格描述", "状态": "正常", "内心": "当前心理状态", "关系": { "{{user}}": "房东" } } }\n`;
                prompt += `]\n</JSONPatch>\n</UpdateVariable>\n`;
                prompt += `重要：NPC名必须与<TenantLore name="...">中的name保持一致。\n`;
                prompt += `档案输出后，请提示用户："请在界面上确认档案后，点击「添加常驻记忆」保存。"\n`;
            }

            // 注入ChatLore并关闭面板
            const ok = await injectSceneLore(prompt);
            if (ok) {
                const trigMsg = `我想把刚才在${tileName}遇到的那位NPC招为租客，安排入住${destName}。`;
                fillInputBox(trigMsg);
                addLog(`🫂 招募指令已注入，请发送消息让AI生成租客档案`);
                togglePanel(false, true);
                markPendingSceneLore(prompt, trigMsg);

                // 如果选的是分基地，预先将NPC名占位到分基地住户（AI回复后由MVU更新租客列表）
                // 注：实际NPC名要等AI生成，这里不预写入。分基地住户由脚本在AI回复后通过正则解析补充。
                // 暂时记录目标分基地，供后续处理
                if (!isApartment) {
                    activeBuffs._recruitTargetBase = selected;
                }
            } else {
                addLog('⚠️ 招募指令注入失败');
            }

            overlay.remove();
        }
    });
}

// 场景面板招募入口（兼容旧调用）
function showSceneRecruitPanel(tile) {
    showRecruitPanel(tile);
}

// ==================== 分基地管理面板 ====================
function showSubBasesPanel() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const subBases = getSubBases();
    const baseEntries = Object.entries(subBases);

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:380px;">`;
    html += `<div class="mp-scene-header">🏠 分基地管理</div>`;

    if (baseEntries.length === 0) {
        html += `<div class="mp-scene-desc" style="color:#9CA3AF;">暂无房产。在棋盘的房产格可以购买分基地。</div>`;
    } else {
        html += `<div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;margin:8px 0;">`;
        for (const [name, base] of baseEntries) {
            const residents = base.住户 || [];
            html += `<div style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 12px;">`;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;">`;
            html += `<div style="font-size:13px;font-weight:700;">🏠 ${name}</div>`;
            html += `<div style="font-size:11px;color:#6B7280;">${residents.length}人入住</div>`;
            html += `</div>`;
            if (base.描述) {
                html += `<div style="font-size:10px;color:#9CA3AF;margin:4px 0;">${base.描述}</div>`;
            }
            if (residents.length > 0) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">`;
                for (const r of residents) {
                    html += `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#FFF;border:1px solid #E5E7EB;border-radius:12px;font-size:11px;">`;
                    html += `👤 ${r}`;
                    html += `<button class="mp-btn" data-action="base-evict" data-base="${name}" data-resident="${r}" style="padding:0 4px;font-size:10px;line-height:1;color:#EF4444;background:none;border:none;cursor:pointer;" title="迁出">✕</button>`;
                    html += `</span>`;
                }
                html += `</div>`;
            } else {
                html += `<div style="font-size:10px;color:#D1D5DB;margin-top:4px;">空置中</div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `<button class="mp-btn" data-action="bases-close" style="width:100%;margin-top:8px;">关闭</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'base-evict') {
            const baseName = btn.dataset.base;
            const residentName = btn.dataset.resident;
            if (baseName && residentName) {
                updateSubBases(bases => {
                    if (bases[baseName] && bases[baseName].住户) {
                        bases[baseName].住户 = bases[baseName].住户.filter(n => n !== residentName);
                    }
                });
                addLog(`${residentName} 已从 ${baseName} 迁出`);
                overlay.remove();
                showSubBasesPanel(); // 刷新
            }
        } else if (btn.dataset.action === 'bases-close') {
            overlay.remove();
        }
    });
}

// ==================== 设置面板 ====================
function showSettingsPanel() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const existingOverlay = doc.getElementById('mp-scene-overlay');
    if (existingOverlay) existingOverlay.remove();

    const state = getMonopolyState();
    const currentLevel = state.涩情浓度 ?? 2; // 默认2(中等)
    const levelLabels = ['🚫 关闭', '🌸 轻度', '💋 中度', '🔥 重度', '🔞 极限'];
    const levelDescs = [
        '不触发任何涩情内容，所有场景为正经互动',
        '暗示为主，不直接描写亲密行为',
        '适度涩情，有亲密描写但不过度',
        '较高尺度，详细的涩情描写',
        '完全解锁，无限制的涩情内容'
    ];

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div class="mp-scene-header">⚙️ 游戏设置</div>`;

    // 涩情浓度设置
    html += `<div style="margin:12px 0;">`;
    html += `<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">涩情浓度</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    for (let i = 0; i < levelLabels.length; i++) {
        const selected = i === currentLevel;
        html += `<button class="mp-btn ${selected ? 'mp-btn-primary' : ''}" data-action="set-erotic" data-level="${i}" style="width:100%;text-align:left;padding:8px 12px;${selected ? 'box-shadow:0 0 0 2px #FF9EAA;' : ''}">`;
        html += `<div style="font-size:12px;font-weight:700;">${levelLabels[i]}</div>`;
        html += `<div style="font-size:10px;color:${selected ? '#FFF' : '#9CA3AF'};margin-top:2px;">${levelDescs[i]}</div>`;
        html += `</button>`;
    }
    html += `</div></div>`;

    // 玩家头像设置
    html += `<div style="margin:12px 0;">`;
    html += `<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;">棋子头像</div>`;
    html += `<div style="display:flex;align-items:center;gap:10px;">`;
    html += `<div id="mp-avatar-preview" style="width:48px;height:48px;border-radius:4px;border:2px solid #6BA8E0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#1a1a2e;">`;
    if (_userAvatarImg) {
        html += `<img src="${_userAvatarImg.src}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        html += `<span style="font-size:24px;">👤</span>`;
    }
    html += `</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:4px;flex:1;">`;
    html += `<button class="mp-btn" data-action="upload-avatar" style="width:100%;font-size:11px;">📷 上传头像</button>`;
    html += `<button class="mp-btn" data-action="clear-avatar" style="width:100%;font-size:11px;color:#EF4444;">🗑️ 清除头像</button>`;
    html += `</div>`;
    html += `</div>`;
    html += `<input type="file" id="mp-avatar-input" accept="image/*" style="display:none;">`;
    html += `</div>`;

    // 开发者模式
    html += `<div style="margin:12px 0;border-top:1px solid #374151;padding-top:12px;">`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;">`;
    html += `<div>`;
    html += `<div style="font-size:12px;font-weight:700;color:#374151;">🛠️ 开发者模式</div>`;
    html += `<div style="font-size:10px;color:#9CA3AF;">可指定前进步数，方便测试格子</div>`;
    html += `</div>`;
    html += `<button class="mp-btn ${_devMode ? 'mp-btn-primary' : ''}" data-action="toggle-devmode" style="padding:4px 12px;font-size:11px;">${_devMode ? '✅ 已开启' : '关闭'}</button>`;
    html += `</div>`;
    html += `</div>`;

    // 开发者作弊工具（仅devMode时显示）
    if (_devMode) {
        html += `<div style="margin:8px 0;border-top:1px solid #7C3AED;padding-top:10px;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#A78BFA;margin-bottom:8px;">🎮 作弊工具</div>`;

        // 筹码调整
        html += `<div style="display:flex;gap:4px;margin-bottom:6px;">`;
        html += `<button class="mp-btn" data-action="dev-chips" data-amount="1000" style="flex:1;font-size:10px;padding:4px;">💰+1000</button>`;
        html += `<button class="mp-btn" data-action="dev-chips" data-amount="5000" style="flex:1;font-size:10px;padding:4px;">💰+5000</button>`;
        html += `<button class="mp-btn" data-action="dev-chips" data-amount="-1000" style="flex:1;font-size:10px;padding:4px;">💰-1000</button>`;
        html += `</div>`;

        // 赠送道具
        html += `<div style="font-size:10px;color:#9CA3AF;margin:4px 0;">📦 赠送道具（点击获得1个）</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">`;
        for (const [iName, iDef] of Object.entries(ITEMS)) {
            html += `<button class="mp-btn" data-action="dev-item" data-name="${iName}" style="font-size:10px;padding:3px 6px;" title="${iDef.desc}">${iDef.icon}${iName}</button>`;
        }
        html += `</div>`;

        // 抽卡测试
        html += `<div style="font-size:10px;color:#9CA3AF;margin:4px 0;">🃏 抽卡测试</div>`;
        html += `<div style="display:flex;gap:4px;margin-bottom:6px;">`;
        html += `<button class="mp-btn" data-action="dev-draw-fate" style="flex:1;font-size:10px;padding:4px;">🃏 抽命运卡</button>`;
        html += `<button class="mp-btn" data-action="dev-draw-chance" style="flex:1;font-size:10px;padding:4px;">🎴 抽机会卡</button>`;
        html += `</div>`;

        // 指定抽卡
        html += `<div style="font-size:10px;color:#9CA3AF;margin:4px 0;">🎯 指定命运卡</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">`;
        for (const fc of FATE_CARDS) {
            html += `<button class="mp-btn" data-action="dev-fate-pick" data-id="${fc.id}" style="font-size:9px;padding:2px 5px;">${fc.name}</button>`;
        }
        html += `</div>`;
        html += `<div style="font-size:10px;color:#9CA3AF;margin:4px 0;">🎯 指定机会卡</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">`;
        for (const cc of CHANCE_CARDS) {
            html += `<button class="mp-btn" data-action="dev-chance-pick" data-id="${cc.id}" style="font-size:9px;padding:2px 5px;">${cc.name}</button>`;
        }
        html += `</div>`;

        // 直接激活buff
        html += `<div style="font-size:10px;color:#9CA3AF;margin:4px 0;">⚡ 直接激活Buff</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">`;
        const buffList = ['投资折扣','美人请求','免费体验'];
        for (const b of buffList) {
            const isActive = activeBuffs[b];
            html += `<button class="mp-btn ${isActive ? 'mp-btn-primary' : ''}" data-action="dev-buff" data-buff="${b}" style="font-size:9px;padding:2px 5px;">${isActive ? '✅' : ''}${b}</button>`;
        }
        html += `</div>`;

        html += `</div>`;
    }

    html += `<button class="mp-btn" data-action="settings-close" style="width:100%;margin-top:8px;">关闭</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');

    // 头像上传处理
    const avatarInput = doc.getElementById('mp-avatar-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                // 压缩到64x64再存储
                const tmpImg = _createImg();
                tmpImg.onload = () => {
                    const c = doc.createElement('canvas');
                    c.width = 64; c.height = 64;
                    const cx = c.getContext('2d');
                    cx.drawImage(tmpImg, 0, 0, 64, 64);
                    const dataUrl = c.toDataURL('image/png');
                    saveUserAvatar(dataUrl);
                    overlay.remove();
                    showSettingsPanel();
                };
                tmpImg.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'set-erotic') {
            const level = parseInt(btn.dataset.level);
            updateState(s => { s.涩情浓度 = level; });
            addLog(`⚙️ 涩情浓度设为：${levelLabels[level]}`);
            overlay.remove();
            showSettingsPanel();
        } else if (btn.dataset.action === 'upload-avatar') {
            const input = doc.getElementById('mp-avatar-input');
            if (input) input.click();
        } else if (btn.dataset.action === 'clear-avatar') {
            clearUserAvatar();
            overlay.remove();
            showSettingsPanel();
        } else if (btn.dataset.action === 'toggle-devmode') {
            _devMode = !_devMode;
            try { localStorage.setItem(MP_PREFIX + 'devMode', _devMode ? 'true' : 'false'); } catch(e) {}
            addLog(`🛠️ 开发者模式：${_devMode ? '已开启' : '已关闭'}`);
            overlay.remove();
            showSettingsPanel();
            renderPanel(); // 刷新操作按钮
        } else if (btn.dataset.action === 'dev-chips') {
            const amount = parseInt(btn.dataset.amount);
            updateState(s => { s.筹码 = Math.max(0, (s.筹码 || 0) + amount); });
            addLog(`🛠️ [作弊] 筹码 ${amount > 0 ? '+' : ''}${amount}`);
            overlay.remove();
            showSettingsPanel();
            renderPanel();
        } else if (btn.dataset.action === 'dev-item') {
            const itemName = btn.dataset.name;
            updateState(s => {
                if (!s.道具) s.道具 = {};
                s.道具[itemName] = (s.道具[itemName] || 0) + 1;
            });
            addLog(`🛠️ [作弊] 获得 ${ITEMS[itemName]?.icon || ''} ${itemName}`);
            overlay.remove();
            showSettingsPanel();
            renderPanel();
        } else if (btn.dataset.action === 'dev-draw-fate') {
            overlay.remove();
            const card = drawFateCard();
            addLog(`🛠️ [作弊] 抽命运卡：${card.name}`);
            applyCardEffect(card.effect);
            renderPanel();
        } else if (btn.dataset.action === 'dev-draw-chance') {
            overlay.remove();
            const card = drawChanceCard();
            addLog(`🛠️ [作弊] 抽机会卡：${card.name}`);
            showChanceCardPanel(card);
        } else if (btn.dataset.action === 'dev-fate-pick') {
            const cardId = btn.dataset.id;
            const card = FATE_CARDS.find(c => c.id === cardId);
            if (card) {
                overlay.remove();
                addLog(`🛠️ [作弊] 指定命运卡：${card.name}`);
                applyCardEffect(card.effect);
                renderPanel();
            }
        } else if (btn.dataset.action === 'dev-chance-pick') {
            const cardId = btn.dataset.id;
            const card = CHANCE_CARDS.find(c => c.id === cardId);
            if (card) {
                overlay.remove();
                addLog(`🛠️ [作弊] 指定机会卡：${card.name}`);
                showChanceCardPanel(card);
            }
        } else if (btn.dataset.action === 'dev-buff') {
            const buffName = btn.dataset.buff;
            activeBuffs[buffName] = !activeBuffs[buffName];
            addLog(`🛠️ [作弊] ${buffName} ${activeBuffs[buffName] ? '已激活' : '已关闭'}`);
            overlay.remove();
            showSettingsPanel();
            renderPanel();
        } else if (btn.dataset.action === 'settings-close') {
            overlay.remove();
        }
    });
}

// ==================== 新手教程引导 ====================
function showTutorialOverlay() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const steps = [
        { icon: '🎲', title: '掷骰子移动', desc: '点击「掷骰子」在棋盘上移动，经过起点获得筹码奖励。' },
        { icon: '🗺️', title: '探索格子', desc: '踩到不同格子触发事件：场景互动、命运卡、机会卡、商店等。' },
        { icon: '💋', title: '涩情场景', desc: '粉色格子是涩情场景，可选择带租客一起互动（可多选）。在⚙️设置中调节浓度。' },
        { icon: '📈', title: '据点投资', desc: '反复光顾或投资筹码可升级据点，解锁更高尺度的内容和分红收益。' },
        { icon: '🏠', title: '购买房产', desc: '踩到房产格可购买，招募NPC入住成为租客。' },
    ];

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:360px;">`;
    html += `<div style="font-size:36px;margin-bottom:4px;">🎪</div>`;
    html += `<div class="mp-scene-header">欢迎来到大富翁！</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;text-align:left;">`;
    for (const step of steps) {
        html += `<div style="display:flex;gap:8px;align-items:flex-start;">`;
        html += `<div style="font-size:20px;flex-shrink:0;">${step.icon}</div>`;
        html += `<div><div style="font-size:11px;font-weight:700;color:#374151;">${step.title}</div>`;
        html += `<div style="font-size:10px;color:#6B7280;">${step.desc}</div></div>`;
        html += `</div>`;
    }
    html += `</div>`;
    html += `<button class="mp-btn mp-btn-primary" data-action="tutorial-close" style="width:100%;">🎲 开始冒险！</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (btn && btn.dataset.action === 'tutorial-close') {
            overlay.remove();
        }
    });
}

// ==================== 租客列表面板（只读） ====================
function showPartyPanel() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const tenants = getTenantList();
    const tenantNames = Object.keys(tenants);

    // 也收集分基地住户
    const vars = _readMvuVars();
    const subBasesData = vars ? _.get(vars, 'stat_data.分基地', {}) : {};
    const subBaseResidents = [];
    for (const [baseName, base] of Object.entries(subBasesData)) {
        for (const resident of (base.住户 || [])) {
            if (!tenantNames.includes(resident) && !subBaseResidents.includes(resident)) {
                subBaseResidents.push(resident);
            }
        }
    }

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:340px;">`;
    html += `<div class="mp-scene-header">👥 租客一览</div>`;
    html += `<div class="mp-scene-desc">进入场景时可选择带谁一起（可多选）</div>`;

    if (tenantNames.length === 0 && subBaseResidents.length === 0) {
        html += `<div style="color:#9CA3AF;padding:16px;font-size:13px;">暂无租客。在场景格招募或购买房产后招募NPC入住。</div>`;
    } else {
        html += `<div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;margin-bottom:12px;">`;
        for (const name of tenantNames) {
            const t = tenants[name];
            html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(30,17,69,0.4);border:1.5px solid #7C3AED;border-radius:10px;">`;
            html += `<div style="font-size:18px;">🫂</div>`;
            html += `<div style="flex:1;">`;
            html += `<div style="font-size:13px;font-weight:700;color:#E5E7EB;">${name}</div>`;
            html += `<div style="font-size:10px;color:#9CA3AF;">${t.职业 || '无'} · ${t.性格 || '未知'}${t.年龄 ? ' · ' + t.年龄 + '岁' : ''}</div>`;
            html += `</div></div>`;
        }
        for (const name of subBaseResidents) {
            html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(13,59,59,0.4);border:1.5px solid #00CED1;border-radius:10px;">`;
            html += `<div style="font-size:18px;">🏠</div>`;
            html += `<div style="flex:1;">`;
            html += `<div style="font-size:13px;font-weight:700;color:#E5E7EB;">${name}</div>`;
            html += `<div style="font-size:10px;color:#9CA3AF;">分基地住户</div>`;
            html += `</div></div>`;
        }
        html += `</div>`;
    }

    html += `<button class="mp-btn" data-action="party-close" style="width:100%;">关闭</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'party-close') {
            overlay.remove();
        }
    });
}

// ==================== 道具使用逻辑 ====================
// buff标记：部分道具设置标记，在掷骰/事件时检查
// 使用Proxy自动持久化到MVU，确保跨刷新和跨聊天隔离
const DEFAULT_BUFFS = {
    指定骰: false,      // 下次可选择骰子点数
    翻倍水晶: false,    // 下次正面收益翻倍
    护盾: false,        // 下次负面效果免除
    VIP邀请函: false,   // 涩情场景VIP
    红酒: false,        // 涩情场景尺度提升
    命运之眼: null,     // 偷看的下一张卡
    神秘药水: false,    // 涩情场景特殊效果
    万能钥匙: false,    // 解锁据点隐藏房间
    变装道具: false,    // 涩情场景角色扮演主题
    投资折扣: false,    // 下次据点投资半价（贵人相助）
    美人请求: false,    // 下次场景格触发美人邂逅后续事件（美人的请求）
    免费体验: false,    // 艳遇卡freeOnce：下次涩情场景免费
};

let _buffsData = { ...DEFAULT_BUFFS };
let _buffSyncPending = false; // 防止频繁写入：批量合并

function _scheduleBuffSync() {
    if (_buffSyncPending) return;
    _buffSyncPending = true;
    // 用微任务合并同一轮的多次buff修改
    Promise.resolve().then(() => {
        _buffSyncPending = false;
        _syncBuffsToMvu();
    });
}

function _syncBuffsToMvu() {
    try {
        const vars = _readMvuVars();
        if (!vars) return;
        if (!_.has(vars, 'stat_data.大富翁')) _.set(vars, 'stat_data.大富翁', { ...DEFAULT_MONOPOLY });
        _.set(vars, 'stat_data.大富翁.activeBuffs', { ..._buffsData });
        _writeMvuVars(vars);
    } catch (e) { console.warn('[大富翁] buff同步失败:', e); }
}

function _loadBuffsFromMvu() {
    try {
        const vars = _readMvuVars();
        if (!vars) return;
        const saved = _.get(vars, 'stat_data.大富翁.activeBuffs');
        if (saved && typeof saved === 'object') {
            // 合并：保留DEFAULT_BUFFS的完整key列表，用保存值覆盖
            Object.keys(DEFAULT_BUFFS).forEach(key => {
                _buffsData[key] = (key in saved) ? saved[key] : DEFAULT_BUFFS[key];
            });
        } else {
            Object.assign(_buffsData, DEFAULT_BUFFS);
        }
    } catch (e) { console.warn('[大富翁] buff加载失败:', e); }
}

// Proxy: 所有 activeBuffs.xxx = value 自动触发持久化
let activeBuffs = new Proxy(_buffsData, {
    set(target, prop, value) {
        target[prop] = value;
        _scheduleBuffSync();
        return true;
    }
});

function useItem(name) {
    const state = getMonopolyState();
    const count = state.道具?.[name] || 0;
    if (count <= 0) {
        addLog(`⚠️ 没有 ${name}`);
        return false;
    }

    const itemDef = ITEMS[name];
    if (!itemDef) return false;

    // 消耗道具
    const consumeItem = () => {
        updateState(s => {
            if (!s.道具) s.道具 = {};
            s.道具[name] = Math.max(0, (s.道具[name] || 0) - 1);
            if (s.道具[name] === 0) delete s.道具[name];
        });
    };

    switch (name) {
        case '指定骰':
            activeBuffs.指定骰 = true;
            consumeItem();
            addLog(`🎯 使用指定骰！下次掷骰可选择点数。`);
            return true;

        case '传送卷轴': {
            // 传送到随机已解锁格子（简化处理，避免需要额外UI选格子）
            const randomNode = MAP_NODES[Math.floor(Math.random() * MAP_NODES.length)];
            const targetPos = randomNode.id;
            const targetTile = randomNode;
            updateState(s => { s.位置 = targetPos; });
            consumeItem();
            addLog(`📜 使用传送卷轴！传送到 ${targetTile?.icon} ${targetTile?.name}`);
            renderPanel();
            handleTileLanding(targetPos);
            return true;
        }

        case '翻倍水晶':
            activeBuffs.翻倍水晶 = true;
            consumeItem();
            addLog(`💎 使用翻倍水晶！下次正面收益翻倍。`);
            return true;

        case '护盾':
            activeBuffs.护盾 = true;
            consumeItem();
            addLog(`🛡️ 使用护盾！下次负面效果免除。`);
            return true;

        case 'VIP邀请函':
            activeBuffs.VIP邀请函 = true;
            consumeItem();
            addLog(`💌 使用VIP邀请函！下次涩情场景解锁VIP内容。`);
            return true;

        case '红酒':
            activeBuffs.红酒 = true;
            consumeItem();
            addLog(`🍷 使用红酒！下次涩情场景尺度提升。`);
            return true;

        case '命运之眼': {
            const nextCard = drawFateCard();
            activeBuffs.命运之眼 = nextCard;
            consumeItem();
            addLog(`🔮 使用命运之眼！偷看到下一张命运卡：${nextCard.name}`);
            return true;
        }

        case '神秘药水':
            activeBuffs.神秘药水 = true;
            consumeItem();
            addLog(`💊 使用神秘药水！下次涩情场景触发特殊效果。`);
            return true;

        case '万能钥匙':
            activeBuffs.万能钥匙 = true;
            consumeItem();
            addLog(`🗝️ 使用万能钥匙！下次据点解锁隐藏房间。`);
            return true;

        case '变装道具':
            activeBuffs.变装道具 = true;
            consumeItem();
            addLog(`🎭 使用变装道具！下次涩情场景切换角色扮演主题。`);
            return true;

        default:
            addLog(`⚠️ ${name} 暂未实现使用效果`);
            return false;
    }
}

// ==================== 道具栏面板 ====================
function showItemsPanel() {
    const doc = getTargetDoc();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (!panel) return;

    const state = getMonopolyState();
    const items = state.道具 || {};
    const itemNames = Object.keys(items).filter(k => items[k] > 0);

    let html = `<div class="mp-scene-overlay" id="mp-scene-overlay">`;
    html += `<div class="mp-scene-card" style="max-width:320px;">`;
    html += `<div class="mp-scene-header">🎒 道具栏</div>`;

    if (itemNames.length === 0) {
        html += `<div style="color:#9CA3AF;padding:16px;font-size:13px;">空空如也。去市集或便利店购买道具吧。</div>`;
    } else {
        html += `<div style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;margin-bottom:12px;">`;
        for (const name of itemNames) {
            const count = items[name];
            const itemDef = ITEMS?.[name] || {};
            html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:10px;">`;
            html += `<div>`;
            html += `<div style="font-size:13px;font-weight:700;">${itemDef.icon || '📦'} ${name} ×${count}</div>`;
            html += `<div style="font-size:10px;color:#9CA3AF;">${itemDef.desc || ''}</div>`;
            html += `</div>`;
            html += `<button class="mp-btn" data-action="item-use" data-name="${name}" style="padding:4px 10px;font-size:11px;">使用</button>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `<button class="mp-btn" data-action="items-close" style="width:100%;">关闭</button>`;
    html += `</div></div>`;

    panel.insertAdjacentHTML('beforeend', html);

    const overlay = doc.getElementById('mp-scene-overlay');
    overlay.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'item-use') {
            const name = btn.dataset.name;
            const used = useItem(name);
            if (used) {
                overlay.remove();
                renderPanel();
            }
        } else if (action === 'items-close') {
            overlay.remove();
        }
    });
}

// ==================== 分红结算 ====================
function checkDividends(state) {
    if (!state.回合 || state.回合 % DIVIDEND_CYCLE !== 0) return;

    const outposts = state.据点 || {};
    let totalDividend = 0;

    for (const [tileId, outpost] of Object.entries(outposts)) {
        const levelInfo = getOutpostLevel(outpost);
        if (levelInfo.dividendPerCycle > 0) {
            totalDividend += levelInfo.dividendPerCycle;
        }
    }

    if (totalDividend > 0) {
        updateState(s => { s.筹码 = (s.筹码 || 0) + totalDividend; });
        addLog(`📈 据点分红结算：+${totalDividend} 筹码`);
    }
}

// ==================== 事件处理（全局action分发） ====================
function handleAction(action, data) {
    console.log('[大富翁] handleAction:', action, data);
    switch (action) {
        case 'roll':
            handleRoll();
            break;
        case 'close':
            togglePanel(false);
            break;
        case 'party':
            showPartyPanel();
            break;
        case 'items':
            showItemsPanel();
            break;
        case 'recruit-npc':
            showRecruitPanel();
            break;
        case 'sub-bases':
            showSubBasesPanel();
            break;
        case 'settings':
            showSettingsPanel();
            break;
        case 'reinject-scene':
            reinjectLastScene();
            break;
        case 'zoom-in':
            camera.zoom = Math.min(camera.maxZoom, camera.zoom * 1.3);
            requestCanvasRedraw();
            break;
        case 'zoom-out':
            camera.zoom = Math.max(camera.minZoom, camera.zoom / 1.3);
            requestCanvasRedraw();
            break;
        case 'fit-map':
            fitAllNodes();
            requestCanvasRedraw();
            break;
        case 'center-player': {
            const s = getMonopolyState();
            centerOnNode(s.位置 || 0);
            requestCanvasRedraw();
            break;
        }
        case 'dev-move': {
            if (!_devMode) break;
            const doc = getTargetDoc();
            const stepsInput = doc.getElementById('mp-dev-steps');
            const steps = parseInt(stepsInput?.value) || 1;
            if (steps < 1) { addLog('⚠️ 步数必须≥1'); break; }
            addLog(`🛠️ [开发] 指定前进 ${steps} 步`);
            // 复用 handleRoll 的清理逻辑
            clearSceneLore().catch(() => {});
            _pendingSceneLore = false;
            if (_sceneLoreSafetyTimer) { clearTimeout(_sceneLoreSafetyTimer); _sceneLoreSafetyTimer = null; }
            manualZoneOverride = false;
            try { executeMove(steps); } catch(e) { console.error('[大富翁] dev-move异常:', e); isMoving = false; }
            break;
        }
    }
}

// ==================== 面板开关 ====================
let _sceneLoreSafetyTimer = null; // 安全超时：防止场景指令残留

function togglePanel(show, skipClearLore) {
    const doc = getTargetDoc();
    let panel = doc.getElementById(MP_PANEL_ID);
    if (show) {
        if (!panel) {
            panel = doc.createElement('div');
            panel.id = MP_PANEL_ID;
            panel.className = 'mp-panel';
            doc.body.appendChild(panel);

            // 移动端触摸兼容：事件委托处理所有 onclick="_mpAction" 按钮
            panel.addEventListener('touchend', function(e) {
                const btn = e.target.closest('[onclick*="_mpAction"]');
                if (btn) {
                    e.preventDefault();
                    const match = btn.getAttribute('onclick').match(/_mpAction\('([^']+)'\)/);
                    if (match) handleAction(match[1]);
                }
            }, { passive: false });
        }
        panel.style.display = 'flex';
        // 打开面板时取消安全超时（用户回来继续玩了，由handleRoll清理）
        if (_sceneLoreSafetyTimer) { clearTimeout(_sceneLoreSafetyTimer); _sceneLoreSafetyTimer = null; }
        // 从MVU加载当前聊天的buff状态
        _loadBuffsFromMvu();
        renderPanel();
    } else {
        // ★ 关闭面板时停止Canvas动画循环，防止后台持续渲染浪费性能
        _stopCanvasAnimation();
        if (panel) panel.style.display = 'none';
        // 清理残留场景指令（场景注入后自动关闭时跳过，让AI能读到指令）
        if (!skipClearLore) {
            // 如果有待清理的场景lore（用户还没发送），不清理——用户只是打开看看又关了
            if (_pendingSceneLore) {
                console.log('[大富翁] 有待发送的场景lore，跳过清理');
            } else {
                clearSceneLore().catch(() => {});
                if (_sceneLoreSafetyTimer) { clearTimeout(_sceneLoreSafetyTimer); _sceneLoreSafetyTimer = null; }
            }
        } else {
            // 安全网：skipClearLore时设5分钟超时，防止用户不再玩导致lore永久残留
            if (_sceneLoreSafetyTimer) clearTimeout(_sceneLoreSafetyTimer);
            _sceneLoreSafetyTimer = setTimeout(() => {
                clearSceneLore().catch(() => {});
                _sceneLoreSafetyTimer = null;
                console.log('[大富翁] 安全超时：已清理残留场景指令');
            }, 5 * 60 * 1000); // 5分钟
        }
    }
}

// ==================== 目标文档（ST主页面） ====================
function getTargetDoc() {
    try { return window.parent.document; } catch(e) { return document; }
}

// ==================== CSS 样式 ====================
function injectStyles() {
    const doc = getTargetDoc();
    if (doc.getElementById('mp-styles')) return;
    // 加载 Leckerli One 糖果风字体
    if (!doc.getElementById('mp-font-link')) {
        const link = doc.createElement('link');
        link.id = 'mp-font-link';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Leckerli+One&display=swap';
        (doc.head || doc.documentElement).appendChild(link);
    }
    const style = doc.createElement('style');
    style.id = 'mp-styles';
    style.textContent = `
        /* ===== 悬浮球 ===== */
        #${MP_TOGGLE_ID} {
            position: absolute; width: 52px; height: 52px; top: 260px; right: 20px;
            background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; z-index: 99999; user-select: none; touch-action: none;
            box-shadow: 0 4px 20px rgba(124,58,237,0.5), 0 0 0 2px rgba(167,139,250,0.3);
            transition: transform 0.2s, box-shadow 0.2s; color: white; font-size: 24px;
        }
        #${MP_TOGGLE_ID}:hover { transform: scale(1.12); box-shadow: 0 6px 28px rgba(124,58,237,0.7), 0 0 15px rgba(124,58,237,0.3); }
        #${MP_TOGGLE_ID}:active { transform: scale(0.95); }

        /* ===== 主面板 ===== */
        .mp-panel {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: clamp(320px, 92vw, 680px); height: clamp(480px, 88vh, 900px);
            background: linear-gradient(180deg, #0F0F23 0%, #1A1A2E 100%);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.3), 0 0 30px rgba(124,58,237,0.1);
            z-index: 100000; display: none; flex-direction: column; overflow: hidden;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 13px; color: #E2E8F0;
        }
        @media (min-width: 768px) {
            .mp-panel { width: clamp(520px, 60vw, 780px); height: clamp(600px, 85vh, 960px); font-size: 14px; }
        }
        @media (min-width: 1200px) {
            .mp-panel { width: clamp(680px, 50vw, 920px); height: clamp(700px, 88vh, 1020px); font-size: 14px; }
        }

        /* ===== 头部 ===== */
        .mp-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 14px 18px;
            background: linear-gradient(135deg, #1E1145 0%, #2D1B69 50%, #1A1040 100%);
            color: #E2E8F0; position: relative; overflow: hidden;
            border-bottom: 1px solid rgba(124,58,237,0.3);
        }
        .mp-header::after {
            content: ''; position: absolute; top: -50%; right: -20%; width: 120px; height: 120px;
            background: rgba(124,58,237,0.08); border-radius: 50%;
            pointer-events: none;
        }
        .mp-title {
            font-size: 20px; font-weight: 800; letter-spacing: 1px;
            text-shadow: 0 0 12px rgba(167,139,250,0.5);
            font-family: 'Leckerli One', cursive, sans-serif;
        }
        .mp-header-close {
            background: rgba(124,58,237,0.25); border: none; color: #A78BFA;
            width: 40px; height: 40px; min-width: 40px; min-height: 40px;
            border-radius: 50%; cursor: pointer;
            font-size: 18px; display: flex; align-items: center; justify-content: center;
            transition: all 0.15s; backdrop-filter: blur(4px);
            touch-action: manipulation; -webkit-tap-highlight-color: transparent;
            position: relative; z-index: 2;
        }
        .mp-header-close:hover { background: rgba(124,58,237,0.5); transform: rotate(90deg); }
        .mp-header-close:active { background: rgba(124,58,237,0.6); }
        .mp-dice { transition: transform 0.15s; }
        .mp-dice-rolling { animation: mp-shake 0.1s infinite; }
        @keyframes mp-shake {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-15deg); }
            75% { transform: rotate(15deg); }
        }

        /* ===== 状态栏（四格卡片） ===== */
        .mp-status { padding: 8px 12px; background: transparent; }
        .mp-status-cards {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
        }
        .mp-stat-card {
            display: flex; flex-direction: column; align-items: center;
            padding: 6px 4px; border-radius: 12px;
            background: rgba(30,17,69,0.6); border: 1.5px solid rgba(124,58,237,0.2);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .mp-stat-icon { font-size: 16px; line-height: 1; }
        .mp-stat-val { font-size: 14px; font-weight: 800; color: #E2E8F0; margin: 2px 0; }
        .mp-stat-label { font-size: 9px; color: #8B8FA3; text-transform: uppercase; letter-spacing: 0.5px; }
        .mp-stat-chips { border-color: rgba(251,191,36,0.4); }
        .mp-stat-fame { border-color: rgba(167,139,250,0.4); }
        .mp-stat-pos { border-color: rgba(0,206,209,0.4); }
        .mp-stat-party { border-color: rgba(96,165,250,0.4); }

        /* ===== Buff指示器 ===== */
        .mp-buff-bar {
            display: flex; gap: 4px; justify-content: center;
            padding: 4px 8px; flex-wrap: wrap;
        }
        .mp-buff-tag {
            display: inline-flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; border-radius: 8px;
            background: linear-gradient(135deg, #1E1145, #2D1B69);
            border: 1.5px solid rgba(167,139,250,0.4); font-size: 14px;
            box-shadow: 0 0 8px rgba(124,58,237,0.2);
            animation: mp-buffPulse 2s ease-in-out infinite;
            cursor: help;
        }
        @keyframes mp-buffPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); box-shadow: 0 0 12px rgba(124,58,237,0.4); }
        }

        /* ===== 统计栏 ===== */
        .mp-board-stats {
            display: flex; align-items: center; gap: 10px; padding: 6px 10px;
            background: linear-gradient(90deg, #0D0D1A, #151530);
            border-bottom: 1px solid rgba(124,58,237,0.2); flex-shrink: 0;
            font-size: 12px; font-weight: 700; color: #A0A4B8;
        }
        .mp-stats-item { white-space: nowrap; }
        .mp-canvas-btn {
            margin-left: auto; cursor: pointer; background: rgba(124,58,237,0.15);
            border-radius: 6px; padding: 4px 8px; border: 1px solid rgba(124,58,237,0.3);
            font-size: 14px; transition: all 0.2s; color: #A78BFA;
        }
        .mp-canvas-btn:first-of-type { margin-left: auto; }
        .mp-canvas-btn + .mp-canvas-btn { margin-left: 0; }
        .mp-canvas-btn:hover { background: rgba(124,58,237,0.3); transform: scale(1.05); box-shadow: 0 0 8px rgba(124,58,237,0.3); }

        /* ===== Canvas棋盘 ===== */
        .mp-canvas-wrap {
            flex: 1; position: relative; overflow: hidden;
            background: #EDE3C4; cursor: grab;
            border-radius: 0 0 8px 8px;
            touch-action: none;
        }
        .mp-canvas-wrap:active { cursor: grabbing; }
        .mp-canvas-wrap canvas {
            display: block; width: 100%; height: 100%;
        }

        /* ===== 覆盖面板（场景/房产/队伍/道具） ===== */
        .mp-scene-overlay {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(10,10,26,0.95); z-index: 10;
            display: flex; align-items: flex-start; justify-content: center;
            padding: 12px; overflow-y: auto;
            backdrop-filter: blur(8px);
        }
        .mp-scene-card {
            background: linear-gradient(180deg, #1A1A2E, #0F0F23); border-radius: 18px; padding: 22px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(124,58,237,0.1);
            border: 1.5px solid rgba(124,58,237,0.3); text-align: center; max-width: 340px; width: 100%;
            margin: auto 0;
        }
        .mp-scene-header { font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #E2E8F0; text-shadow: 0 0 8px rgba(167,139,250,0.3); }
        .mp-scene-desc { font-size: 13px; color: #8B8FA3; margin-bottom: 14px; line-height: 1.5; }
        .mp-scene-options { display: flex; flex-direction: column; gap: 8px; }

        /* ===== 操作按钮区 ===== */
        .mp-actions {
            display: flex; gap: 6px; padding: 10px 14px;
            background: rgba(15,15,35,0.8); border-top: 1px solid rgba(124,58,237,0.2);
            flex-wrap: wrap; align-items: center;
        }
        .mp-btn {
            padding: 8px 14px; border: 1.5px solid rgba(124,58,237,0.25); border-radius: 12px;
            background: rgba(30,17,69,0.5); cursor: pointer; font-size: 12px; font-weight: 600;
            transition: all 0.15s; position: relative; color: #C4C9D4;
        }
        .mp-btn:hover { background: rgba(124,58,237,0.2); border-color: rgba(167,139,250,0.5); }
        .mp-btn:active { transform: translateY(1px); }
        .mp-btn-primary {
            background: linear-gradient(135deg, #7C3AED, #5B21B6); color: #FFF;
            border-color: transparent; box-shadow: 0 3px 12px rgba(124,58,237,0.4);
        }
        .mp-btn-primary:hover { background: linear-gradient(135deg, #8B5CF6, #6D28D9); box-shadow: 0 4px 18px rgba(124,58,237,0.5); }
        .mp-btn-primary:active { transform: translateY(2px); box-shadow: 0 1px 4px rgba(124,58,237,0.3); }
        .mp-btn-roll { flex: 1; font-size: 14px; padding: 10px; }
        .mp-btn-secondary {
            background: rgba(124,58,237,0.12); color: #A78BFA; border-color: rgba(167,139,250,0.3);
        }
        .mp-btn-secondary:hover { background: rgba(124,58,237,0.25); }
        .mp-btn-ghost {
            background: transparent; border-color: rgba(100,110,140,0.3); color: #8B8FA3;
        }
        .mp-btn-ghost:hover { background: rgba(100,110,140,0.1); color: #C4C9D4; border-color: rgba(100,110,140,0.5); }
        .mp-btn-close { margin-left: auto; color: #8B8FA3; border: none; }

        /* ===== 日志区 ===== */
        .mp-log {
            max-height: 90px; overflow-y: auto; padding: 6px 14px;
            background: rgba(5,5,16,0.6); border-top: 1px solid rgba(124,58,237,0.1);
            font-size: 11px; color: #6B7080;
        }
        .mp-log-entry {
            padding: 3px 0; border-bottom: 1px solid rgba(100,110,140,0.1);
            animation: mp-fadeIn 0.3s ease;
        }
        @keyframes mp-fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== 据点投资面板 ===== */
        .mp-outpost-info {
            background: linear-gradient(135deg, rgba(30,17,69,0.5), rgba(15,15,35,0.6)); border-radius: 12px;
            padding: 12px; margin-bottom: 4px; border: 1px solid rgba(124,58,237,0.2);
        }
        .mp-outpost-level { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .mp-outpost-badge {
            padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; color: #FFF;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .mp-outpost-lv0 { background: #9CA3AF; }
        .mp-outpost-lv1 { background: linear-gradient(135deg, #3B82F6, #60A5FA); }
        .mp-outpost-lv2 { background: linear-gradient(135deg, #8B5CF6, #A78BFA); }
        .mp-outpost-lv3 { background: linear-gradient(135deg, #F59E0B, #EF4444); }
        .mp-outpost-stats {
            display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11px; color: #8B8FA3;
        }
        .mp-outpost-upgrade {
            margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(100,110,140,0.3);
        }
        .mp-progress-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
        .mp-progress-label { font-size: 10px; width: 48px; flex-shrink: 0; color: #8B8FA3; }
        .mp-progress-bar {
            flex: 1; height: 8px; background: rgba(30,17,69,0.5); border-radius: 4px; overflow: hidden;
        }
        .mp-progress-fill {
            height: 100%; background: linear-gradient(90deg, #8B5CF6, #A78BFA);
            border-radius: 4px; transition: width 0.4s ease;
        }
        .mp-progress-fill-gold { background: linear-gradient(90deg, #F59E0B, #FBBF24); }
        .mp-progress-text { font-size: 10px; width: 48px; text-align: right; color: #8B8FA3; flex-shrink: 0; }
        .mp-btn-invest {
            width: 100%; margin-top: 8px; padding: 10px;
            background: linear-gradient(135deg, #8B5CF6, #6C5CE7);
            color: #FFF; border-color: transparent; font-weight: 700; font-size: 13px;
            box-shadow: 0 3px 10px rgba(108,92,231,0.3);
        }
        .mp-btn-invest:hover { background: linear-gradient(135deg, #7C3AED, #5B21B6); box-shadow: 0 4px 14px rgba(108,92,231,0.4); }
        .mp-btn-invest:active { transform: translateY(2px); box-shadow: 0 1px 4px rgba(108,92,231,0.3); }
        .mp-outpost-preview {
            display: flex; gap: 10px; justify-content: center; margin-top: 8px;
            font-size: 10px; color: #8B5CF6; font-weight: 600;
        }
    `;
    doc.head.appendChild(style);
}

// ==================== 清理函数（参考workshop_main.js） ====================
function cleanupMonopolyPlugin() {
    console.log('[大富翁] 清理插件...');
    // ★ 先停止Canvas动画循环，防止rAF闭包在DOM移除后继续空转
    _stopCanvasAnimation();
    // 从 FloatingMenuManager 反注册
    if (window.parent.FloatingMenuManager) {
        window.parent.FloatingMenuManager.unregisterButton('monopoly');
    }
    const doc = getTargetDoc();
    const toggle = doc.getElementById(MP_TOGGLE_ID);
    if (toggle) toggle.remove();
    const panel = doc.getElementById(MP_PANEL_ID);
    if (panel) panel.remove();
    const styles = doc.getElementById('mp-styles');
    if (styles) styles.remove();
    console.log('[大富翁] 清理完成');
}
window.cleanupMonopolyPlugin = cleanupMonopolyPlugin;

// ==================== 悬浮球入口（支持拖拽+点击+位置记忆） ====================
function createFloatingButton() {
    const doc = getTargetDoc();

    // 优先注册到 FloatingMenuManager
    if (window.parent.FloatingMenuManager) {
        try {
            window.parent.FloatingMenuManager.registerButton({
                id: 'monopoly',
                icon: '<img src="https://api.iconify.design/mdi:dice-multiple.svg?color=%23ffffff" style="width:24px;height:24px;">',
                label: '大富翁',
                color: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                order: 30,
                onClick: function() {
                    const panel = doc.getElementById(MP_PANEL_ID);
                    const isOpen = panel && panel.style.display !== 'none';
                    togglePanel(!isOpen);
                }
            });
            console.log('[大富翁] 已注册到 FloatingMenuManager');
            return;
        } catch (e) {
            console.warn('[大富翁] FloatingMenuManager注册失败，降级到独立悬浮球:', e);
        }
    }

    // Fallback：创建独立悬浮球
    console.log('[大富翁] FloatingMenuManager未加载，使用独立悬浮球');
    if (doc.getElementById(MP_TOGGLE_ID)) return;

    const btn = doc.createElement('div');
    btn.id = MP_TOGGLE_ID;
    btn.textContent = '🎲';
    btn.title = '打开大富翁（可拖拽）';

    // 恢复上次位置
    try {
        const saved = localStorage.getItem(MP_PREFIX + 'btnPos');
        if (saved) {
            const pos = JSON.parse(saved);
            btn.style.left = pos.left + 'px';
            btn.style.top = pos.top + 'px';
            btn.style.right = 'auto';
        }
    } catch (e) {}

    let isDrag = false, startX = 0, startY = 0, initLeft = 0, initTop = 0;
    const DRAG_THRESHOLD = 6;

    const onPointerDown = (e) => {
        isDrag = false;
        startX = e.clientX || 0;
        startY = e.clientY || 0;
        const rect = btn.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
        doc.addEventListener('pointermove', onPointerMove);
        doc.addEventListener('pointerup', onPointerUp);
        e.preventDefault();
    };

    const onPointerMove = (e) => {
        const cx = e.clientX || 0, cy = e.clientY || 0;
        const dx = cx - startX, dy = cy - startY;
        if (!isDrag && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        isDrag = true;
        let x = initLeft + dx, y = initTop + dy;
        const vw = window.parent?.innerWidth || window.innerWidth;
        const vh = window.parent?.innerHeight || window.innerHeight;
        x = Math.max(0, Math.min(x, vw - 52));
        y = Math.max(0, Math.min(y, vh - 52));
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
        btn.style.right = 'auto';
    };

    const onPointerUp = () => {
        doc.removeEventListener('pointermove', onPointerMove);
        doc.removeEventListener('pointerup', onPointerUp);
        if (isDrag) {
            const rect = btn.getBoundingClientRect();
            try { localStorage.setItem(MP_PREFIX + 'btnPos', JSON.stringify({ left: rect.left, top: rect.top })); } catch(e) {}
        } else {
            const panel = doc.getElementById(MP_PANEL_ID);
            const isOpen = panel && panel.style.display !== 'none';
            togglePanel(!isOpen);
        }
    };

    btn.addEventListener('pointerdown', onPointerDown);
    doc.body.appendChild(btn);
}

// ==================== 初始化 ====================
async function init() {
    // 先清理旧实例（避免重复注入）
    cleanupMonopolyPlugin();

    injectStyles();

    // 等待 MVU 初始化完成
    try {
        const waitFn = window.parent?.waitGlobalInitialized || window.waitGlobalInitialized;
        if (waitFn) {
            await waitFn('Mvu');
            console.log('[大富翁] MVU 初始化完成');
        } else {
            console.warn('[大富翁] waitGlobalInitialized 不可用，跳过等待');
        }
    } catch (e) {
        console.warn('[大富翁] 等待MVU初始化失败:', e);
    }

    createFloatingButton();
    setupSceneAutoCleanListener();
    setupChatChangeListener();
    preloadBuildingImages();
    loadUserAvatar();
    // 从MVU加载当前聊天的buff
    _loadBuffsFromMvu();
    console.log('🎲 大富翁模式已加载');

    // 暴露全局API（供其他脚本调用）
    window.monopolyToggle = (show) => togglePanel(show !== false);
    window.monopolyIsOpen = () => {
        const doc = getTargetDoc();
        const panel = doc.getElementById(MP_PANEL_ID);
        return panel && panel.style.display !== 'none';
    };

    // 暴露action分发器到parent window（解决跨iframe事件绑定问题）
    try {
        const parentWin = window.parent || window;
        parentWin._mpAction = (action, data) => {
            console.log('[大富翁] _mpAction:', action, data);
            handleAction(action, data);
        };
        console.log('[大富翁] _mpAction 已暴露到 parent window');
    } catch(e) {
        console.error('[大富翁] 暴露 _mpAction 失败:', e);
    }
}

// 等待 DOM 就绪
if (typeof $ !== 'undefined') {
    $(() => init());
} else {
    document.addEventListener('DOMContentLoaded', init);
}
