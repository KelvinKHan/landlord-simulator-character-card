#!/usr/bin/env node

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { moduleManifest } from '../scripts/module-manifest.mjs';
import { releaseConfig } from '../scripts/release-config.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '..');
const cardDirectory = path.join(projectRoot, '角色卡/构建产物');
const baseCardPath = path.join(cardDirectory, '房东模拟器Z5.20.json');
const bundlePath = path.join(projectRoot, 'dist/landlord-simulator.bundle.js');
const loaderPath = path.join(projectRoot, releaseConfig.loaderPath);
const onlineCardPath = path.join(cardDirectory, '房东模拟器Z5.20-多合一在线预览版.json');
const offlineCardPath = path.join(cardDirectory, '房东模拟器Z5.20-多合一离线预览版.json');
const checkOnly = process.argv.includes('--check');

const SCRIPT_ID = releaseConfig.scriptId;
const releaseIdentities = releaseConfig.identities;

function clone(value) {
  return structuredClone(value);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function collectButtons() {
  const buttons = [];
  const names = new Set();

  for (const module of moduleManifest) {
    const metadataPath = path.join(projectRoot, path.dirname(module.source), '元数据.json');
    const metadata = await readJson(metadataPath);
    for (const button of metadata.button?.buttons ?? []) {
      assert.ok(!names.has(button.name), `多合一脚本按钮重名：${button.name}`);
      names.add(button.name);
      buttons.push(clone(button));
    }
  }

  return buttons;
}

function createCombinedScript(content, buttons, mode) {
  return {
    type: 'script',
    enabled: true,
    name: `房东模拟器·多合一（${mode}预览）`,
    id: SCRIPT_ID,
    content,
    info: `Z5.20 多合一迁移预览 ${releaseConfig.gitTag}；大富翁和原卡已禁用二改版暂未迁移。`,
    button: {
      enabled: buttons.length > 0,
      buttons,
    },
    data: {},
    export_with: {
      data: true,
      button: true,
    },
  };
}

function createCard(baseCard, script, identity) {
  const card = clone(baseCard);
  card.name = identity.cardName;
  card.data.name = identity.cardName;
  card.data.character_version = identity.characterVersion;
  card.data.character_book.name = identity.worldbookName;
  card.data.extensions.world = identity.worldbookName;
  card.data.extensions.tavern_helper.scripts = [script];
  return card;
}

async function validateCard(card, expectedContent, identity, baseCard) {
  assert.equal(card.spec, 'chara_card_v3', '角色卡格式不是 Character Card V3');
  assert.equal(card.name, identity.cardName, 'Character Card 顶层名称没有同步更新');
  assert.equal(card.data.name, identity.cardName, '角色卡名称没有按发布版本更新');
  assert.equal(card.data.character_book.name, identity.worldbookName, '内嵌世界书名称没有按发布版本更新');
  assert.equal(card.data.extensions.world, identity.worldbookName, '角色卡世界书绑定没有同步更新');
  assert.notEqual(card.data.name, baseCard.data.name, '新版本角色卡不得沿用基线名称');
  assert.notEqual(card.data.character_book.name, baseCard.data.character_book.name, '新版本世界书不得沿用基线名称');
  assert.equal(card.data.extensions.tavern_helper.scripts.length, 1, '预览卡必须只包含一个酒馆助手脚本');
  const script = card.data.extensions.tavern_helper.scripts[0];
  assert.equal(script.id, SCRIPT_ID, '多合一脚本 ID 不稳定');
  assert.equal(script.content, expectedContent, '多合一脚本内容不一致');
  assert.ok(script.button.buttons.some(button => button.name === '重新处理变量'), 'MVU 脚本按钮没有迁移');
  assert.ok(script.button.buttons.some(button => button.name === '美化设置'), '美化脚本按钮没有迁移');
  assert.ok(script.button.buttons.some(button => button.name === '创意工坊'), '创意工坊按钮没有迁移');
  await transform(script.content, {
    loader: 'js',
    format: 'esm',
    target: 'es2022',
  });
}

const [baseCard, bundle, loader, buttons] = await Promise.all([
  readJson(baseCardPath),
  fs.readFile(bundlePath, 'utf8'),
  fs.readFile(loaderPath, 'utf8'),
  collectButtons(),
]);

const onlineCard = createCard(
  baseCard,
  createCombinedScript(loader, buttons, '在线'),
  releaseIdentities.online,
);
const offlineCard = createCard(
  baseCard,
  createCombinedScript(bundle, buttons, '离线'),
  releaseIdentities.offline,
);

assert.notEqual(releaseIdentities.online.cardName, releaseIdentities.offline.cardName, '在线版和离线版角色卡名称不得相同');
assert.notEqual(releaseIdentities.online.worldbookName, releaseIdentities.offline.worldbookName, '在线版和离线版世界书名称不得相同');
await validateCard(onlineCard, loader, releaseIdentities.online, baseCard);
await validateCard(offlineCard, bundle, releaseIdentities.offline, baseCard);

await fs.mkdir(cardDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(onlineCardPath, `${JSON.stringify(onlineCard, null, 2)}\n`, 'utf8'),
  fs.writeFile(offlineCardPath, `${JSON.stringify(offlineCard, null, 2)}\n`, 'utf8'),
]);

console.log(`${checkOnly ? '迁移预览检查通过' : '迁移预览构建完成'}：在线版和离线版均只有 1 个酒馆助手脚本`);
console.log(`在线版：${releaseIdentities.online.cardName} / ${releaseIdentities.online.worldbookName}`);
console.log(`离线版：${releaseIdentities.offline.cardName} / ${releaseIdentities.offline.worldbookName}`);
console.log(`合并脚本按钮：${buttons.map(button => button.name).join('、')}`);
