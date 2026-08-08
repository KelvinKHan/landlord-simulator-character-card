#!/usr/bin/env node

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleManifest } from '../scripts/module-manifest.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '..');
const refactoredModules = moduleManifest.filter(module => module.entry);
const legacyModules = moduleManifest.filter(module => !module.entry);
const entries = new Set();
const serviceProviders = new Map();
const availableServices = new Set(['tavern', 'mvu']);

for (const module of moduleManifest) {
  for (const requirement of module.requires ?? []) {
    assert.ok(
      availableServices.has(requirement),
      `模块「${module.name}」依赖 ${requirement}，但提供者没有排在它前面`,
    );
  }
  for (const service of module.provides ?? []) {
    assert.match(service, /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/, `服务名称不符合命名规范：${service}`);
    assert.ok(!serviceProviders.has(service), `服务重复提供：${service}`);
    serviceProviders.set(service, module.id);
    availableServices.add(service);
  }

  if (!module.entry) continue;
  assert.ok(module.entry.startsWith('scripts/modules/'), `重构模块必须放在 scripts/modules：${module.entry}`);
  assert.ok(!entries.has(module.entry), `多个模块共用同一个重构入口：${module.entry}`);
  entries.add(module.entry);
  assert.ok((module.provides ?? []).length > 0, `重构模块必须声明 provides：${module.name}`);

  const source = await fs.readFile(path.join(projectRoot, module.entry), 'utf8');
  const lineCount = source.split('\n').length;
  assert.ok(lineCount <= 500, `重构模块超过 500 行，应继续拆分：${module.entry}（${lineCount} 行）`);
  assert.match(source, /export\s+(?:async\s+)?function\s+activate\s*\(/, `重构模块缺少 activate(context)：${module.entry}`);
  assert.doesNotMatch(source, /window\.(?:parent|top)/, `重构模块不得直接访问 window.parent/window.top：${module.entry}`);
  assert.doesNotMatch(source, /LandlordSimulator/, `重构模块不得反向读取运行时全局：${module.entry}`);
  assert.doesNotMatch(source, /runtime-access/, `重构模块不得使用服务定位器：${module.entry}`);
}

console.log(`架构检查通过：${refactoredModules.length} 个标准模块，${legacyModules.length} 个待迁移模块`);
console.log(`已声明服务：${[...serviceProviders.keys()].join('、')}`);
