# 多合一脚本架构

这套架构的目标不是单纯把代码拆成更多文件，而是让新玩法可以独立加入、替换和卸载，避免功能之间继续靠全局变量互相修改。

## 四层结构

1. `src/core/`：稳定的底层能力，例如宿主窗口、事件、任务调度和模块生命周期。它不包含具体玩法。
2. `modules/`：新的标准功能模块。医院、写字楼、装修、招募等新玩法应该放在这里。
3. `角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/`：原卡拆出的旧实现。在对应功能完成迁移前保留，作为行为基线和回退来源。
4. `dist/`：自动生成的玩家运行文件，不手工编辑。

## 标准模块契约

每个新模块必须在 `module-manifest.mjs` 声明：

- `id`：稳定且唯一的模块编号；
- `requires`：启动前必须存在的服务；
- `provides`：该模块向其他模块提供的服务；
- `entry`：位于 `scripts/modules/` 的实现入口；
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

模块不能直接读取 `window.parent.SomeModule`，也不能用延时器猜测依赖是否加载完成。依赖缺失、服务重名和加载顺序错误会在构建阶段直接失败。

## 扩展新玩法的方式

以“医院经营”为例，推荐拆成彼此可替换的服务：

- `building.hospital.state`：医院自身数据与 MVU 映射；
- `building.hospital.recruitment`：医生、护士和病人的招募规则；
- `building.hospital.operations`：排班、科室和经营结算；
- `building.hospital.ui`：只负责界面，不直接修改底层数据；
- `building.hospital.ai`：通过统一酒馆助手服务生成病例、人员和事件。

这样更换医院界面不会影响经营数据，更换 AI 提示词也不会破坏装修系统。

## 维护硬规则

- 一个标准模块最多 500 行；超过后按状态、业务、界面或适配器继续拆分。
- 跨模块调用必须通过具名服务，不允许新增隐式全局依赖。
- 所有 DOM、事件、计时器和服务注册都必须在卸载时清理。
- 新功能必须有单元测试；涉及 SillyTavern 的功能还需要导入预览卡做人工冒烟测试。
- `dist/` 和预览卡只由构建命令生成，不能手改。

`npm run architecture:check` 会自动执行其中可机械检查的规则。

## 迁移顺序

1. 聊天数据库、分析调度器与队列组件（已完成）；
2. 聊天核心、正文联动和聊天 APP；
3. 悬浮球与手机外壳；
4. 天气、新闻、音乐、地图等内容 APP；
5. 公寓和创意工坊两个大型模块。

大型功能最后迁移，是为了先让公共服务稳定，再拆分核心玩法，减少“边重构边改规则”造成的返工。
