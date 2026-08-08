#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

const originalRelativePath = '角色卡/原始导出/房东模拟器Z5.20.json';
const originalPngRelativePath = '角色卡/原始导出/房东模拟器Z5.20.png';
const workspaceRelativePath = '角色卡/工作区/Z5.20';
const buildRelativePath = '角色卡/构建产物/房东模拟器Z5.20.json';

const originalPath = path.join(projectRoot, originalRelativePath);
const originalPngPath = path.join(projectRoot, originalPngRelativePath);
const workspacePath = path.join(projectRoot, workspaceRelativePath);
const buildPath = path.join(projectRoot, buildRelativePath);

const coreTextFields = [
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
];

const legacySyncFields = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'tags',
];

function clone(value) {
  return structuredClone(value);
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function partPath(relativePath) {
  const resolved = path.resolve(workspacePath, relativePath);
  assert.ok(
    resolved === workspacePath || resolved.startsWith(`${workspacePath}${path.sep}`),
    `工作区清单包含越界路径：${relativePath}`,
  );
  return resolved;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(filePath, value) {
  assert.equal(typeof value, 'string', `预期文本内容：${filePath}`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf8');
}

async function sha256(filePath) {
  const content = await fs.readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

async function readEmbeddedPngCards(filePath) {
  const png = await fs.readFile(filePath);
  const signature = '89504e470d0a1a0a';
  assert.equal(png.subarray(0, 8).toString('hex'), signature, '文件不是有效的 PNG');

  const cards = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert.ok(dataEnd + 4 <= png.length, `PNG ${type} 数据块越界`);

    if (type === 'tEXt') {
      const data = png.subarray(dataStart, dataEnd);
      const separator = data.indexOf(0);
      if (separator > -1) {
        const keyword = data.toString('latin1', 0, separator).toLowerCase();
        if (keyword === 'chara' || keyword === 'ccv3') {
          const encoded = data.toString('latin1', separator + 1);
          cards.push({ keyword, card: JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) });
        }
      }
    }

    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  return cards;
}

function safeSegment(value, fallback) {
  const sanitized = String(value ?? fallback)
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return (sanitized || fallback).slice(0, 80);
}

function indexedDirectory(index, name, fallback) {
  return `${String(index).padStart(2, '0')}-${safeSegment(name, fallback)}`;
}

function without(object, keys) {
  const result = clone(object);
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function makeWorkspaceReadme(card, manifest) {
  const worldRows = manifest.parts.worldbook.entries.map((entry, index) => {
    const sourceEntry = card.data.character_book.entries[index];
    return `| ${sourceEntry.id ?? index} | ${markdownCell(sourceEntry.comment || '(未命名)')} | ${sourceEntry.enabled ? '启用' : '关闭'} | ${sourceEntry.constant ? '常驻' : '关键词'} | ${sourceEntry.content.length} |`;
  });

  const scriptRows = manifest.parts.tavern_helper.scripts.map((script, index) => {
    const sourceScript = card.data.extensions.tavern_helper.scripts[index];
    return `| ${index} | ${markdownCell(sourceScript.name)} | ${sourceScript.enabled ? '启用' : '关闭'} | ${sourceScript.content.length} |`;
  });

  const regexRows = manifest.parts.regex_scripts.items.map((item, index) => {
    const sourceItem = card.data.extensions.regex_scripts[index];
    return `| ${index} | ${markdownCell(sourceItem.scriptName)} | ${sourceItem.disabled ? '关闭' : '启用'} | ${sourceItem.replaceString.length} |`;
  });

  return `# 房东模拟器 Z5.20 工作区

本目录由 \`npm run card:unpack\` 从原始导出自动生成。每一部分都能由构建工具重新组合成完整的 SillyTavern JSON 角色卡。

## 编辑边界

- \`角色文本/\`：角色核心文本和开场白。
- \`世界书/\`：世界书设置及 16 个独立条目。
- \`扩展/酒馆助手/\`：酒馆助手变量和 30 个独立脚本。
- \`扩展/正则脚本/\`：9 个正则规则及其渲染内容。
- \`扩展/其他扩展.json\`：其余 SillyTavern 扩展字段。
- \`兼容字段.json\`：Character Card V3 顶层兼容字段，通常不直接编辑。
- \`manifest.json\`：拆分清单及重新组装顺序，不应手工修改。

## 世界书清单

| ID | 名称 | 状态 | 触发方式 | 内容字符数 |
|---:|---|---|---|---:|
${worldRows.join('\n')}

## 酒馆助手脚本清单

| 序号 | 名称 | 状态 | 代码字符数 |
|---:|---|---|---:|
${scriptRows.join('\n')}

## 正则脚本清单

| 序号 | 名称 | 状态 | 替换内容字符数 |
|---:|---|---|---:|
${regexRows.join('\n')}

## 常用命令

- \`npm run card:build\`：把工作区重新组合为 \`角色卡/构建产物/房东模拟器Z5.20.json\`。
- \`npm run card:check\`：重新构建并检查基本结构、ID 唯一性和 JSON 有效性。
- \`npm run card:verify-baseline\`：确认当前工作区能无损还原原始 Z5.20。开始功能修改后，这项对比出现差异属于预期现象。
`;
}

async function unpack() {
  const card = await readJson(originalPath);
  assert.equal(card.spec, 'chara_card_v3', '仅支持当前的 Character Card V3 基线');
  assert.ok(card.data && typeof card.data === 'object', '角色卡缺少 data 对象');

  // 这里只重建固定的 Z5.20 生成目录，不影响原始导出、上层说明或其他版本。
  await fs.rm(workspacePath, { recursive: true, force: true });
  await fs.mkdir(workspacePath, { recursive: true });

  const compatibility = without(card, ['data']);
  await writeJson(partPath('兼容字段.json'), compatibility);

  const dataBase = without(card.data, [...coreTextFields, 'alternate_greetings', 'character_book', 'extensions']);
  await writeJson(partPath('角色文本/基本信息.json'), dataBase);

  const textParts = [];
  for (const field of coreTextFields) {
    if (typeof card.data[field] !== 'string') continue;
    const relativePath = `角色文本/${field}.md`;
    await writeText(partPath(relativePath), card.data[field]);
    textParts.push({ field, path: relativePath });
  }

  const greetingParts = [];
  const greetings = Array.isArray(card.data.alternate_greetings) ? card.data.alternate_greetings : [];
  for (const [index, greeting] of greetings.entries()) {
    const relativePath = `角色文本/alternate_greetings/${String(index).padStart(2, '0')}.md`;
    await writeText(partPath(relativePath), greeting);
    greetingParts.push(relativePath);
  }

  const characterBook = card.data.character_book ?? { entries: [] };
  await writeJson(partPath('世界书/设置.json'), without(characterBook, ['entries']));
  const worldbookParts = [];
  for (const [index, entry] of (characterBook.entries ?? []).entries()) {
    const directory = `世界书/条目/${indexedDirectory(index, entry.comment, '未命名条目')}`;
    const metadataPath = `${directory}/元数据.json`;
    const contentPath = `${directory}/内容.md`;
    await writeJson(partPath(metadataPath), without(entry, ['content']));
    await writeText(partPath(contentPath), entry.content ?? '');
    worldbookParts.push({ metadata: metadataPath, content: contentPath });
  }

  const extensions = card.data.extensions ?? {};
  await writeJson(partPath('扩展/其他扩展.json'), without(extensions, ['tavern_helper', 'regex_scripts']));

  const tavernHelper = extensions.tavern_helper ?? { scripts: [], variables: {} };
  await writeJson(partPath('扩展/酒馆助手/设置.json'), without(tavernHelper, ['scripts', 'variables']));
  await writeJson(partPath('扩展/酒馆助手/variables.json'), tavernHelper.variables ?? {});
  const tavernScriptParts = [];
  for (const [index, script] of (tavernHelper.scripts ?? []).entries()) {
    const directory = `扩展/酒馆助手/脚本/${indexedDirectory(index, script.name, '未命名脚本')}`;
    const metadataPath = `${directory}/元数据.json`;
    const contentPath = `${directory}/index.js`;
    await writeJson(partPath(metadataPath), without(script, ['content']));
    await writeText(partPath(contentPath), script.content ?? '');
    tavernScriptParts.push({ metadata: metadataPath, content: contentPath });
  }

  const regexParts = [];
  for (const [index, item] of (extensions.regex_scripts ?? []).entries()) {
    const directory = `扩展/正则脚本/${indexedDirectory(index, item.scriptName, '未命名正则')}`;
    const metadataPath = `${directory}/元数据.json`;
    const findPath = `${directory}/查找表达式.txt`;
    const replacePath = `${directory}/替换内容.html`;
    await writeJson(partPath(metadataPath), without(item, ['findRegex', 'replaceString']));
    await writeText(partPath(findPath), item.findRegex ?? '');
    await writeText(partPath(replacePath), item.replaceString ?? '');
    regexParts.push({ metadata: metadataPath, find: findPath, replace: replacePath });
  }

  const manifest = {
    workspace_format: 1,
    card: {
      name: card.data.name,
      version: card.data.character_version,
      spec: card.spec,
      spec_version: card.spec_version,
      original_path: originalRelativePath,
      original_sha256: await sha256(originalPath),
    },
    parts: {
      compatibility: '兼容字段.json',
      core: '角色文本/基本信息.json',
      text_fields: textParts,
      alternate_greetings: greetingParts,
      worldbook: {
        settings: '世界书/设置.json',
        entries: worldbookParts,
      },
      extensions: '扩展/其他扩展.json',
      tavern_helper: {
        settings: '扩展/酒馆助手/设置.json',
        variables: '扩展/酒馆助手/variables.json',
        scripts: tavernScriptParts,
      },
      regex_scripts: {
        items: regexParts,
      },
    },
  };

  await writeJson(partPath('manifest.json'), manifest);
  await writeText(partPath('README.md'), makeWorkspaceReadme(card, manifest));

  console.log(`已拆分：${toPosix(path.relative(projectRoot, workspacePath))}`);
  console.log(`世界书 ${worldbookParts.length} 条，酒馆助手脚本 ${tavernScriptParts.length} 个，正则脚本 ${regexParts.length} 个。`);
}

async function build({ quiet = false } = {}) {
  const manifest = await readJson(partPath('manifest.json'));
  assert.equal(manifest.workspace_format, 1, '不支持的工作区格式');

  const card = await readJson(partPath(manifest.parts.compatibility));
  const data = await readJson(partPath(manifest.parts.core));

  for (const item of manifest.parts.text_fields) {
    data[item.field] = await fs.readFile(partPath(item.path), 'utf8');
  }
  data.alternate_greetings = await Promise.all(
    manifest.parts.alternate_greetings.map(item => fs.readFile(partPath(item), 'utf8')),
  );

  const characterBook = await readJson(partPath(manifest.parts.worldbook.settings));
  characterBook.entries = [];
  for (const item of manifest.parts.worldbook.entries) {
    const entry = await readJson(partPath(item.metadata));
    entry.content = await fs.readFile(partPath(item.content), 'utf8');
    characterBook.entries.push(entry);
  }
  data.character_book = characterBook;

  const extensions = await readJson(partPath(manifest.parts.extensions));
  const tavernHelper = await readJson(partPath(manifest.parts.tavern_helper.settings));
  tavernHelper.variables = await readJson(partPath(manifest.parts.tavern_helper.variables));
  tavernHelper.scripts = [];
  for (const item of manifest.parts.tavern_helper.scripts) {
    const script = await readJson(partPath(item.metadata));
    script.content = await fs.readFile(partPath(item.content), 'utf8');
    tavernHelper.scripts.push(script);
  }
  extensions.tavern_helper = tavernHelper;

  extensions.regex_scripts = [];
  for (const item of manifest.parts.regex_scripts.items) {
    const regex = await readJson(partPath(item.metadata));
    regex.findRegex = await fs.readFile(partPath(item.find), 'utf8');
    regex.replaceString = await fs.readFile(partPath(item.replace), 'utf8');
    extensions.regex_scripts.push(regex);
  }
  data.extensions = extensions;

  card.data = data;
  for (const field of legacySyncFields) {
    if (Object.hasOwn(card, field) && Object.hasOwn(data, field)) {
      card[field] = clone(data[field]);
    }
  }

  await writeJson(buildPath, card);
  if (!quiet) {
    console.log(`已构建：${toPosix(path.relative(projectRoot, buildPath))}`);
  }
  return card;
}

function assertUniqueIds(items, label) {
  const ids = items.map(item => item.id).filter(id => id !== undefined && id !== null);
  assert.equal(new Set(ids).size, ids.length, `${label}存在重复 ID`);
}

function compileRegexSource(source, label) {
  assert.equal(typeof source, 'string', `${label}的查找表达式不是字符串`);
  const literal = source.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
  try {
    if (literal) {
      new RegExp(literal[1], literal[2]);
    } else {
      new RegExp(source);
    }
  } catch (error) {
    throw new Error(`${label}的查找表达式无效：${error.message}`);
  }
}

function validateInlineScripts(html, label) {
  let count = 0;
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    count += 1;
    try {
      new vm.Script(match[1], { filename: label });
    } catch (error) {
      throw new Error(`${label}的内嵌脚本语法无效：${error.message}`);
    }
  }
  return count;
}

function validateCard(card) {
  assert.equal(card.spec, 'chara_card_v3', '角色卡 spec 不是 chara_card_v3');
  assert.equal(card.spec_version, '3.0', '角色卡 spec_version 不是 3.0');
  assert.ok(card.data && typeof card.data === 'object', '角色卡缺少 data 对象');

  const worldEntries = card.data.character_book?.entries;
  const tavernScripts = card.data.extensions?.tavern_helper?.scripts;
  const regexScripts = card.data.extensions?.regex_scripts;
  assert.ok(Array.isArray(worldEntries), '世界书条目不是数组');
  assert.ok(Array.isArray(tavernScripts), '酒馆助手脚本不是数组');
  assert.ok(Array.isArray(regexScripts), '正则脚本不是数组');
  assertUniqueIds(worldEntries, '世界书条目');
  assertUniqueIds(tavernScripts, '酒馆助手脚本');
  assertUniqueIds(regexScripts, '正则脚本');

  let regexInlineScripts = 0;
  for (const item of regexScripts) {
    compileRegexSource(item.findRegex, `正则脚本「${item.scriptName}」`);
    regexInlineScripts += validateInlineScripts(item.replaceString, `正则脚本「${item.scriptName}」`);
  }

  return {
    name: card.data.name,
    version: card.data.character_version,
    worldbook_entries: worldEntries.length,
    worldbook_enabled: worldEntries.filter(item => item.enabled).length,
    tavern_scripts: tavernScripts.length,
    tavern_scripts_enabled: tavernScripts.filter(item => item.enabled).length,
    regex_scripts: regexScripts.length,
    regex_scripts_enabled: regexScripts.filter(item => !item.disabled).length,
    regex_inline_scripts: regexInlineScripts,
  };
}

async function check() {
  const card = await build({ quiet: true });
  const summary = validateCard(card);
  console.log('结构检查通过：');
  console.log(JSON.stringify(summary, null, 2));
}

async function verifyBaseline() {
  const manifest = await readJson(partPath('manifest.json'));
  assert.equal(await sha256(originalPath), manifest.card.original_sha256, '原始基线文件已发生变化');
  const original = await readJson(originalPath);
  const rebuilt = await build({ quiet: true });
  validateCard(rebuilt);
  assert.deepStrictEqual(rebuilt, original, '重新组装结果与原始 Z5.20 存在内容差异');

  const embeddedCards = await readEmbeddedPngCards(originalPngPath);
  assert.ok(embeddedCards.length > 0, '原始 PNG 中没有 chara 或 ccv3 角色卡数据块');
  for (const item of embeddedCards) {
    assert.deepStrictEqual(item.card, original, `PNG 的 ${item.keyword} 数据与 JSON 基线不一致`);
  }

  console.log(`基线往返验证通过：拆分重组内容无损，PNG 中的 ${embeddedCards.map(item => item.keyword).join('、')} 数据也与 JSON 一致。`);
}

const command = process.argv[2];

try {
  if (command === 'unpack') {
    await unpack();
  } else if (command === 'build') {
    await build();
  } else if (command === 'check') {
    await check();
  } else if (command === 'verify-baseline') {
    await verifyBaseline();
  } else {
    console.error('用法：node tools/card-workspace.mjs <unpack|build|check|verify-baseline>');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
