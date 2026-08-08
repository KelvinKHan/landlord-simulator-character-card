import assert from 'node:assert/strict';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationFeatureContract } from '../scripts/migration-feature-contract.mjs';
import { intentionallyExcludedEnabledSources, moduleManifest } from '../scripts/module-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('原卡本阶段全部启用脚本均以原貌保真模块进入多合一构建', async () => {
  assert.equal(moduleManifest.length, 22);
  assert.ok(moduleManifest.every(module => !module.entry), '界面脚本不应由简化重写版替代');
  const workspace = JSON.parse(await fs.readFile(path.join(root, '角色卡/工作区/Z5.20/manifest.json'), 'utf8'));
  const enabled = [];
  for (const script of workspace.parts.tavern_helper.scripts) {
    const metadata = JSON.parse(await fs.readFile(path.join(root, '角色卡/工作区/Z5.20', script.metadata), 'utf8'));
    if (metadata.enabled) enabled.push(`角色卡/工作区/Z5.20/${script.content}`);
  }
  assert.deepEqual(moduleManifest.map(module => module.source), enabled.filter(source => !intentionallyExcludedEnabledSources.includes(source)));
});

test('原貌保真模块直接构建原始源码，不静默缩减界面与样式', async () => {
  for (const module of moduleManifest) {
    const source = await fs.readFile(path.join(root, module.source), 'utf8');
    assert.ok(source.length > 0, `${module.name} 原始源码为空`);
  }
});

test('每个迁移模块都有不可静默删除的功能合同', () => {
  assert.deepEqual(Object.keys(migrationFeatureContract), moduleManifest.map(module => module.id));
  for (const module of moduleManifest) {
    assert.ok(migrationFeatureContract[module.id].length >= 3, `${module.name} 的功能合同不完整`);
  }
});

test('明确延期内容不会混入多合一清单', () => {
  assert.ok(!moduleManifest.some(module => /switcher|monopoly|二改/.test(`${module.id} ${module.name}`)));
  assert.deepEqual(intentionallyExcludedEnabledSources, ['角色卡/工作区/Z5.20/扩展/酒馆助手/脚本/03-switcher/index.js']);
});
