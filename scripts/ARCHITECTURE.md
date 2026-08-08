# 多合一脚本架构

这套架构的目标不是单纯把代码拆成更多文件，而是让新玩法可以独立加入、替换和卸载，避免功能之间继续靠全局变量互相修改。

## 四层结构

1. `src/`：稳定的统一运行时、宿主窗口、MVU 与酒馆助手适配层。它不包含具体玩法。
2. `module-manifest.mjs`：声明模块顺序、依赖、对外能力与明确排除项。
3. `角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/`：原卡拆出的实现，是当前功能和视觉的唯一基线，按原内容直接进入 bundle。
4. `dist/`：自动生成的玩家运行文件，不手工编辑。

## 模块契约

每个新模块必须在 `module-manifest.mjs` 声明：

- `id`：稳定且唯一的模块编号；
- `requires`：启动前必须存在的服务；
- `provides`：该模块向其他模块提供的服务；
- `source`：原卡脚本的保真源码，必须存在且在原卡中处于启用状态；
- `entry`：可选的新实现入口。当前为了保住全部界面与行为，22 个现有模块都不设置它；
- `legacyRequires`：迁移期仍需读取的旧脚本全局接口，便于统计和后续消除；
- `critical`：失败后是否必须停止整个运行时。

实现文件只导出 `activate(context)`。运行时通过 `context` 提供宿主页面、酒馆助手、日志、事件、服务和生命周期：

```js
export function activate(context) {
  const dependency = context.services.require('example.dependency');
  const feature = createFeature(dependency);
  context.services.register('example.feature', feature);
  return () => feature.dispose();
}
```

新实现不能直接读取 `window.parent.SomeModule`，也不能用延时器猜测依赖是否加载完成。依赖缺失、服务重名和加载顺序错误会在构建阶段直接失败。原貌保真模块的旧全局依赖必须显式写入 `legacyRequires`，便于后续逐个消除。

## 扩展新玩法的方式

以“医院经营”为例，推荐拆成彼此可替换的服务：

- `building.hospital.state`：医院自身数据与 MVU 映射；
- `building.hospital.recruitment`：医生、护士和病人的招募规则；
- `building.hospital.operations`：排班、科室和经营结算；
- `building.hospital.ui`：只负责界面，不直接修改底层数据；
- `building.hospital.ai`：通过统一酒馆助手服务生成病例、人员和事件。

这样更换医院界面不会影响经营数据，更换 AI 提示词也不会破坏装修系统。

## 维护硬规则

- 新增标准源码文件最多 500 行；超过后按状态、业务、界面或适配器继续拆分。原貌保真源码不因行数被自动改写。
- 跨模块调用必须通过具名服务，不允许新增隐式全局依赖。
- 所有 DOM、事件、计时器和服务注册都必须在卸载时清理。
- 新功能必须有单元测试；涉及 SillyTavern 的功能还需要导入预览卡做人工冒烟测试。
- 替换现有模块前，必须对齐功能合同，并在真实 SillyTavern 检查 CSS、布局、图标、动画与主要交互；不允许用简化占位界面宣称迁移完成。
- `dist/` 和预览卡只由构建命令生成，不能手改。

`npm run architecture:check` 会自动执行其中可机械检查的规则。

## 迁移状态

本阶段纳入清单的 22 个模块已经全部迁移，构建结果为 22 个原貌保真模块、0 个简化替代模块、0 个漏迁移模块。`03-switcher` 已由统一运行时替代；大富翁和原卡未启用的二改脚本仍按产品决定延期。逐项验收合同见 `scripts/migration-feature-contract.mjs`。

## 当前能力标识

这些名称用于运行时状态与依赖审计。当前原貌保真脚本仍通过它们原有的公开接口协作；能力标识不冒充一套已重写的业务 API。

- `building.apartment`：公寓状态读取、装修命令、卧室、主题和关系；
- `phone.system`：所有手机 APP 的统一注册、显示与卸载；
- `analysis.*`：租客分析、串行调度、队列和租客档案；
- `world.weather`、`phone.news`、`phone.cityMap`、`phone.worldMap`、`media.music`：动态世界与体验 APP；
- `display.beautifier`：正文、思维链、变量尾部和交互标签显示；
- `content.workshop`：本地/云端素材、预设、招募、房间安装、世界观和开场白切换。
