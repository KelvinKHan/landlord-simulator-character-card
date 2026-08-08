# 酒馆助手多合一脚本

这里是房东模拟器的脚本构建层。各功能的原始代码仍然保存在
`角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/` 中，`module-manifest.mjs` 负责声明迁移顺序，
本地构建会把它们打包为 `dist/landlord-simulator.bundle.js`。

新模块必须遵守 [ARCHITECTURE.md](./ARCHITECTURE.md) 中的模块契约。现有原脚本是功能和视觉的唯一基线，
当前会按原内容直接进入 bundle，不用缩水重写版替换。

## 当前迁移边界

- 保留原版已启用功能的代码和加载顺序。
- `03-switcher` 不进入构建，由新的统一运行时逐步替代。
- 大富翁及原卡中已禁用的二改版脚本暂不迁移。
- 22 个纳入范围的模块全部为原貌保真模块，0 个简化替代模块，0 个漏迁移模块。
- 统一运行时管理加载顺序、版本、依赖、能力登记、错误隔离和卸载；原脚本继续保有完整界面与行为。
- 逐模块功能合同由 `migration-feature-contract.mjs` 声明，测试会阻止模块或整块玩法被静默删除。

## 命令

- `npm run scripts:build`：生成单个 ESM 文件、在线加载器、source map 和构建清单。
- `npm run scripts:check`：重新构建并确认所有目标模块都已进入产物，且没有大富翁。
- `npm run architecture:check`：检查依赖顺序、重复服务、模块体积和隐式全局访问。
- `npm run migration:build`：额外生成只有一条酒馆助手脚本的在线、离线预览卡。
- `npm run migration:check`：检查原卡结构、迁移完整性、运行时、多合一产物和两张预览卡。
- `npm run release:verify`：发布固定标签后，确认两个 CDN 节点返回的脚本与本地哈希完全一致。

正式发布时应在本地构建并提交 `dist/`，再使用固定 Git tag 的 jsDelivr 地址。不要使用
`@main` 作为玩家版本。

版本号、Git tag、CDN 仓库、上游依赖版本、脚本 ID、角色卡名称和世界书名称统一维护在
`release-config.mjs`。不要在构建工具或角色卡里另外手写一套发布信息。

运行中可在浏览器控制台查看 `window.parent.LandlordSimulator.getStatus()`；在线加载问题可查看
`window.parent.LandlordSimulatorLoader`。非核心模块失败时，其余模块仍会继续加载；MVU 主程序或变量结构失败时会停止，避免在状态不完整时继续运行。

## 发布命名硬规则

每个预览、测试或正式发布版本都必须使用新的角色卡名称和新的内嵌世界书名称，并同步更新
`extensions.world` 的世界书绑定。在线版、离线版也不得互相重名。构建工具会检查这些名称：
如果仍沿用基线名称，或两个发布渠道重名，构建会直接失败。
