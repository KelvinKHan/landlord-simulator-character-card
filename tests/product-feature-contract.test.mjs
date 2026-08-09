import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import test from 'node:test';
import { productModuleManifest } from '../scripts/product-module-manifest.mjs';

const bundle = await fs.readFile(new URL('../dist/landlord-simulator.bundle.js', import.meta.url), 'utf8');
const styles = await fs.readFile(
  new URL('../scripts/modules/landlord-console/styles.css', import.meta.url),
  'utf8',
);

function bundleText(value) {
  return value.replace(/[^\x00-\x7f]/g, character =>
    `\\u${character.codePointAt(0).toString(16).padStart(4, '0').toUpperCase()}`,
  );
}

test('新版产品模块完整声明房东系统、经营核心与经营中枢', () => {
  assert.deepEqual(
    productModuleManifest.map(module => module.id),
    ['landlord-schema-v2', 'landlord-core', 'landlord-console'],
  );
  assert.ok(productModuleManifest.every(module => module.features.length >= 3));
  assert.ok(productModuleManifest.every(module => module.entry.startsWith('scripts/modules/')));
});

test('经营中枢构建产物包含所有可玩流程且明确显示本地模拟模式', () => {
  for (const marker of [
    '我的建筑版图',
    '建筑接管提案',
    '装修具现化中心',
    '跨世界招募中心',
    '本地模拟模式',
    '不会调用真实 AI',
    '统一任务中心',
    '切换模式不会发起生成',
    '跨系统联动队列',
    '建筑数字孪生',
    '经营时光回溯',
    '装修这个空间',
    '探索下一处',
  ]) {
    assert.ok(bundle.includes(bundleText(marker)), `最终 bundle 缺少经营中枢标记：${marker}`);
  }
});

test('经营中枢同时具备明亮、暗色、窄屏与减少动画样式', () => {
  for (const marker of [
    '.lmo-backdrop[data-theme="dark"]',
    '@media(max-width:820px)',
    '@media(max-width:520px)',
    '@media(prefers-reduced-motion:reduce)',
    '--lmo-bg:',
    '--active-accent',
  ]) {
    assert.ok(styles.includes(marker), `经营中枢样式缺少视觉合同：${marker}`);
  }
});
