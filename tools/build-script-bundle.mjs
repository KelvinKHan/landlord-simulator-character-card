#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createJsDelivrLoader } from '../scripts/loaders/create-jsdelivr-loader.mjs';
import {
  intentionallyDeferredModules,
  intentionallyExcludedEnabledSources,
  moduleManifest,
} from '../scripts/module-manifest.mjs';
import { migrationFeatureContract } from '../scripts/migration-feature-contract.mjs';
import { jsDelivrSources, releaseConfig } from '../scripts/release-config.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '..');
const outputDirectory = path.join(projectRoot, 'dist');
const outputFile = path.join(outputDirectory, 'landlord-simulator.bundle.js');
const loaderOutputFile = path.join(outputDirectory, 'landlord-simulator.loader.js');
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function generatedEntry() {
  const definitions = moduleManifest.map(module => {
    const source = `./${toPosix(module.entry ?? module.source)}`;
    return `{
      id: ${JSON.stringify(module.id)},
      name: ${JSON.stringify(module.name)},
      critical: ${Boolean(module.critical)},
      afterLoad: ${JSON.stringify(module.afterLoad ?? null)},
      cleanup: ${JSON.stringify(module.cleanup ?? [])},
      requires: ${JSON.stringify(module.requires ?? [])},
      provides: ${JSON.stringify(module.provides ?? [])},
      legacyRequires: ${JSON.stringify(module.legacyRequires ?? [])},
      load: () => import(${JSON.stringify(source)}),
    }`;
  });

  return `
    import { startLandlordRuntime } from './scripts/src/runtime.js';

    const modules = [${definitions.join(',\n')}];
    await startLandlordRuntime({ version: ${JSON.stringify(packageJson.version)}, modules });
  `;
}

async function validateManifest() {
  assert.ok(moduleManifest.length > 0, '模块清单不能为空');
  assert.equal(new Set(moduleManifest.map(module => module.id)).size, moduleManifest.length, '模块 ID 存在重复');
  assert.ok(!moduleManifest.some(module => module.id.includes('monopoly')), '大富翁不应进入本阶段构建');
  assert.equal(packageJson.version, releaseConfig.version, 'package.json 与发布配置的版本号不一致');
  assert.deepEqual(Object.keys(migrationFeatureContract), moduleManifest.map(module => module.id), '功能合同必须完整覆盖并按顺序对应模块清单');

  const availableServices = new Set(['tavern', 'mvu']);
  const serviceProviders = new Map();

  for (const module of moduleManifest) {
    const sourcePath = path.join(projectRoot, module.source);
    const stat = await fs.stat(sourcePath);
    assert.ok(stat.isFile(), `模块源码不存在：${module.source}`);

    const metadataPath = path.join(path.dirname(sourcePath), '元数据.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    assert.equal(metadata.enabled, true, `模块清单包含原卡中未启用的脚本：${module.name}`);

    if (module.entry) {
      const entryStat = await fs.stat(path.join(projectRoot, module.entry));
      assert.ok(entryStat.isFile(), `重构模块入口不存在：${module.entry}`);
    }

    for (const service of module.requires ?? []) {
      assert.ok(availableServices.has(service), `模块「${module.name}」依赖尚未提供的服务：${service}`);
    }
    for (const service of module.provides ?? []) {
      assert.ok(!serviceProviders.has(service), `服务「${service}」被多个模块重复提供`);
      serviceProviders.set(service, module.id);
      availableServices.add(service);
    }
  }

  const workspaceRoot = path.join(projectRoot, '角色卡/工作区/Z5.20');
  const workspaceManifest = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'manifest.json'), 'utf8'));
  const enabledSources = [];

  for (const script of workspaceManifest.parts.tavern_helper.scripts) {
    const metadata = JSON.parse(await fs.readFile(path.join(workspaceRoot, script.metadata), 'utf8'));
    if (!metadata.enabled) continue;
    enabledSources.push(toPosix(path.relative(projectRoot, path.join(workspaceRoot, script.content))));
  }

  const excluded = new Set(intentionallyExcludedEnabledSources);
  for (const source of excluded) {
    assert.ok(enabledSources.includes(source), `声明排除的启用脚本不存在：${source}`);
  }

  const expectedSources = enabledSources.filter(source => !excluded.has(source));
  const actualSources = moduleManifest.map(module => module.source);
  assert.deepEqual(
    actualSources,
    expectedSources,
    '多合一模块必须完整覆盖原卡启用脚本，并保持原始顺序；只允许显式排除 switcher',
  );
}

function createPinnedUpstreamPlugin() {
  const upstreams = new Map(
    Object.entries(releaseConfig.upstreams).map(([id, upstream]) => [upstream.originalUrl, { id, ...upstream }]),
  );

  return {
    name: 'pin-mvu-upstreams',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^https:\/\// }, args => {
        const upstream = upstreams.get(args.path);
        if (!upstream) return null;
        return { path: upstream.id, namespace: 'pinned-upstream', pluginData: upstream };
      });

      buildApi.onLoad({ filter: /.*/, namespace: 'pinned-upstream' }, args => {
        const upstream = args.pluginData;
        const sources = jsDelivrSources(upstream);
        const common = `
          const sources = ${JSON.stringify(sources)};
          let loadedModule = null;
          let lastError = null;
          for (const source of sources) {
            try {
              loadedModule = await import(source);
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              console.warn(${JSON.stringify(`[房东模拟器] ${upstream.name} 依赖加载失败`)} + ': ' + source, error);
            }
          }
          if (!loadedModule) throw lastError ?? new Error(${JSON.stringify(`${upstream.name} 依赖加载失败`)});
        `;

        if (upstream.mode === 'side-effect') {
          return { contents: common, loader: 'js' };
        }
        if (upstream.mode === 'register-mvu-schema') {
          return {
            contents: `${common}
              const registerMvuSchema = loadedModule.registerMvuSchema;
              if (typeof registerMvuSchema !== 'function') {
                throw new Error(${JSON.stringify(`${upstream.name} 没有导出 registerMvuSchema`)});
              }
              export { registerMvuSchema };
            `,
            loader: 'js',
          };
        }
        throw new Error(`未知的上游依赖模式：${upstream.mode}`);
      });
    },
  };
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

await validateManifest();
await fs.mkdir(outputDirectory, { recursive: true });

const result = await build({
  stdin: {
    contents: generatedEntry(),
    resolveDir: projectRoot,
    sourcefile: 'landlord-simulator.entry.js',
    loader: 'js',
  },
  absWorkingDir: projectRoot,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  loader: { '.css': 'text' },
  splitting: false,
  sourcemap: 'external',
  legalComments: 'none',
  minify: false,
  outfile: outputFile,
  external: ['https://*', 'http://*'],
  plugins: [createPinnedUpstreamPlugin()],
  define: {
    module: 'undefined',
  },
  metafile: true,
  logLevel: 'info',
});

const bundle = await fs.readFile(outputFile);
const bundleText = bundle.toString('utf8');
const bundledInputs = new Set(Object.keys(result.metafile.inputs).map(input => toPosix(input)));

for (const module of moduleManifest) {
  const bundledSource = module.entry ?? module.source;
  assert.ok(
    [...bundledInputs].some(input => input.endsWith(toPosix(bundledSource))),
    `构建产物缺少模块：${module.name}`,
  );
}

assert.ok(
  ![...bundledInputs].some(input => input.includes('24-大富翁主脚本')),
  '构建产物意外包含大富翁模块',
);

for (const upstream of Object.values(releaseConfig.upstreams)) {
  assert.ok(!bundleText.includes(upstream.originalUrl), `构建产物仍包含未固定版本的依赖：${upstream.name}`);
  for (const source of jsDelivrSources(upstream)) {
    assert.ok(bundleText.includes(source), `构建产物缺少 ${upstream.name} 的固定版本 CDN 地址：${source}`);
  }
}

const loader = createJsDelivrLoader(releaseConfig);
await fs.writeFile(loaderOutputFile, loader, 'utf8');

const buildManifest = {
  version: packageJson.version,
  format: 'esm',
  entry: 'landlord-simulator.bundle.js',
  bytes: bundle.byteLength,
  sha256: sha256(bundle),
  release: {
    tag: releaseConfig.gitTag,
    repository: releaseConfig.repository,
    loader: path.basename(loaderOutputFile),
    sources: jsDelivrSources({
      repository: releaseConfig.repository,
      ref: releaseConfig.gitTag,
      path: releaseConfig.bundlePath,
    }),
  },
  upstreams: Object.fromEntries(
    Object.entries(releaseConfig.upstreams).map(([id, upstream]) => [
      id,
      {
        name: upstream.name,
        repository: upstream.repository,
        ref: upstream.ref,
        commit: upstream.commit,
        path: upstream.path,
        sources: jsDelivrSources(upstream),
      },
    ]),
  ),
  modules: moduleManifest.map(({ id, name, source, entry, requires = [], provides = [], legacyRequires = [] }) => ({
    id,
    name,
    source,
    entry: entry ?? source,
    implementation: entry ? 'infrastructure-adapter' : 'faithful-source',
    requires,
    provides,
    legacyRequires,
    features: migrationFeatureContract[id],
  })),
  deferred: intentionallyDeferredModules,
};

await fs.writeFile(
  path.join(outputDirectory, 'build-manifest.json'),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
  'utf8',
);

console.log(`${checkOnly ? '多合一检查通过' : '多合一构建完成'}：${moduleManifest.length} 个模块，${bundle.byteLength} 字节`);
console.log(`SHA-256：${buildManifest.sha256}`);
