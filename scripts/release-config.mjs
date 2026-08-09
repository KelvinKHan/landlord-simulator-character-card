export const releaseConfig = Object.freeze({
  version: '0.3.0-preview.1',
  gitTag: 'v0.3.0-preview.1',
  repository: 'KelvinKHan/landlord-simulator-character-card',
  bundlePath: 'dist/landlord-simulator.bundle.js',
  loaderPath: 'dist/landlord-simulator.loader.js',
  scriptId: '4fb9fe15-31ac-4d70-8bdd-b88658f1ad69',
  identities: {
    online: {
      characterVersion: 'Z6.1-landlord-os-online-preview.1',
      cardName: '房东模拟器 Z6.1｜Landlord OS·在线技术预览 0.3.0-1',
      worldbookName: '房东模拟器·世界书｜Z6.1-LandlordOS-在线-0.3.0-1',
      artifactFile: '房东模拟器Z6.1-LandlordOS-在线技术预览版-v0.3.0-preview.1.json',
    },
    offline: {
      characterVersion: 'Z6.1-landlord-os-offline-preview.1',
      cardName: '房东模拟器 Z6.1｜Landlord OS·离线技术预览 0.3.0-1',
      worldbookName: '房东模拟器·世界书｜Z6.1-LandlordOS-离线-0.3.0-1',
      artifactFile: '房东模拟器Z6.1-LandlordOS-离线技术预览版-v0.3.0-preview.1.json',
    },
  },
  upstreams: {
    mvuFramework: {
      name: 'MagVarUpdate',
      originalUrl: 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js',
      repository: 'MagicalAstrogy/MagVarUpdate',
      ref: 'v0.179.0',
      commit: '83c1e1f6305013713a2f1f5979f461cc1e80488d',
      path: 'artifact/bundle.js',
      mode: 'side-effect',
    },
    mvuZod: {
      name: 'tavern_resource/mvu_zod',
      originalUrl: 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js',
      repository: 'StageDog/tavern_resource',
      ref: 'v0.3.449',
      commit: 'e3747bdf23a4397353c4e255591ebe621b0783ae',
      path: 'dist/util/mvu_zod.js',
      mode: 'register-mvu-schema',
    },
  },
});

export function jsDelivrSources({ repository, ref, path }) {
  return [
    `https://testingcf.jsdelivr.net/gh/${repository}@${ref}/${path}`,
    `https://cdn.jsdelivr.net/gh/${repository}@${ref}/${path}`,
  ];
}
