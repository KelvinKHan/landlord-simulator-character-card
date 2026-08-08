export const moduleManifest = [
  {
    id: 'mvu-framework',
    name: 'MVU Zod',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/00-MVU zod(开)/index.js',
    critical: true,
    afterLoad: 'wait-for-mvu',
  },
  {
    id: 'mvu-schema',
    name: '变量结构',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/01-变量结构(开)/index.js',
    critical: true,
    afterLoad: 'wait-for-dom-ready',
  },
  {
    id: 'floating-menu',
    name: '悬浮球管理',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/02-悬浮球管理/index.js',
  },
  {
    id: 'apartment',
    name: '公寓',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/04-公寓(开)/index.js',
    cleanup: ['cleanupApartmentPlugin'],
  },
  {
    id: 'phone',
    name: '小手机主程序',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/06-小手机主程序/index.js',
    cleanup: ['cleanupPhone'],
  },
  {
    id: 'chat-database',
    name: '聊天数据库',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/07-聊天数据库/index.js',
  },
  {
    id: 'analysis-scheduler',
    name: '分析调度器',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/08-分析调度器/index.js',
  },
  {
    id: 'tenant-analysis',
    name: '租客分析系统',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/09-租客分析系统/index.js',
  },
  {
    id: 'analysis-queue',
    name: '分析队列组件',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/10-分析队列组件/index.js',
  },
  {
    id: 'chat-core',
    name: '聊天核心',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/11-聊天核心/index.js',
  },
  {
    id: 'chat-story-bridge',
    name: '聊天正文联动',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/12-聊天正文联动/index.js',
  },
  {
    id: 'chat-app',
    name: '聊天 APP',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/13-聊天APP/index.js',
  },
  {
    id: 'tenant-profile',
    name: '租客档案 APP',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/14-租客档案APP/index.js',
  },
  {
    id: 'prompt-console',
    name: '提示词/控制台查看器',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/15-提示词-控制台查看器/index.js',
  },
  {
    id: 'map',
    name: '地图',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/16-地图/index.js',
  },
  {
    id: 'music',
    name: '音乐',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/17-音乐/index.js',
  },
  {
    id: 'world-map',
    name: '世界地图',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/18-世界地图/index.js',
  },
  {
    id: 'weather',
    name: '天气 APP',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/19-天气APP/index.js',
  },
  {
    id: 'news',
    name: '新闻',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/20-新闻/index.js',
  },
  {
    id: 'author-chat',
    name: '和欧欧聊天吧',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/21-和欧欧聊天吧!/index.js',
  },
  {
    id: 'theme',
    name: '美化完整修复版',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/22-美化完整修复版 by jovial_dolphin_19209/index.js',
  },
  {
    id: 'workshop',
    name: '创意工坊',
    source: '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/23-创意工坊main/index.js',
    cleanup: ['cleanupWorkshopPlugin'],
  },
];

export const intentionallyDeferredModules = [
  '03-switcher：由统一模块管理器替代，不再切换酒馆助手中的独立脚本',
  '05-悬浮球示例：原卡已禁用',
  '24-大富翁主脚本：按产品决策暂不迁移',
  '25～29 二改版脚本：原卡已禁用，暂不进入原版多合一构建',
];

export const intentionallyExcludedEnabledSources = [
  '角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/03-switcher/index.js',
];
