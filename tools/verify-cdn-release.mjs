#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '..');
const manifest = JSON.parse(await fs.readFile(path.join(projectRoot, 'dist/build-manifest.json'), 'utf8'));

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function fetchWithRetry(url, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`${url} 获取失败：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

for (const source of manifest.release.sources) {
  const remoteBundle = await fetchWithRetry(source);
  const remoteHash = sha256(remoteBundle);
  assert.equal(remoteHash, manifest.sha256, `CDN 内容与本地发布包不一致：${source}`);
  console.log(`CDN 验证通过：${source}`);
}

for (const upstream of Object.values(manifest.upstreams)) {
  for (const source of upstream.sources) {
    const content = await fetchWithRetry(source, 2);
    assert.ok(content.byteLength > 0, `上游依赖为空：${source}`);
  }
  console.log(`固定上游依赖可访问：${upstream.name}@${upstream.ref}`);
}

console.log(`发布 ${manifest.release.tag} 验证完成，SHA-256：${manifest.sha256}`);
