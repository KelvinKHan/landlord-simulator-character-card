// 房东模拟器多合一在线加载器 v0.3.0-preview.18
const LANDLORD_LOADER_KEY = 'LandlordSimulatorLoader';
const LANDLORD_RUNTIME_KEY = 'LandlordSimulator';
const landlordHost = window.parent ?? window;
const landlordSources = [
  "https://testingcf.jsdelivr.net/gh/KelvinKHan/landlord-simulator-character-card@v0.3.0-preview.18/dist/landlord-simulator.bundle.js",
  "https://cdn.jsdelivr.net/gh/KelvinKHan/landlord-simulator-character-card@v0.3.0-preview.18/dist/landlord-simulator.bundle.js"
];
const landlordLoaderState = {
  version: "0.3.0-preview.18",
  release: "v0.3.0-preview.18",
  status: 'loading',
  loadedFrom: null,
  attempts: [],
  error: null,
};

landlordHost[LANDLORD_LOADER_KEY] = landlordLoaderState;

const landlordExistingRuntime = landlordHost[LANDLORD_RUNTIME_KEY];
if (landlordExistingRuntime?.version === landlordLoaderState.version && landlordExistingRuntime?.status === 'ready') {
  landlordLoaderState.status = 'ready';
  landlordLoaderState.loadedFrom = 'existing-runtime';
  console.info('[房东模拟器] 多合一运行时已存在，本次不重复加载');
} else {
  let landlordLastError = null;
  for (const landlordSource of landlordSources) {
    const landlordAttempt = { source: landlordSource, status: 'loading', error: null };
    landlordLoaderState.attempts.push(landlordAttempt);
    try {
      await import(landlordSource);
      const landlordRuntime = landlordHost[LANDLORD_RUNTIME_KEY];
      if (!landlordRuntime || landlordRuntime.status !== 'ready') {
        throw new Error('脚本文件已下载，但多合一运行时没有成功就绪');
      }
      landlordAttempt.status = 'loaded';
      landlordLoaderState.status = 'ready';
      landlordLoaderState.loadedFrom = landlordSource;
      landlordLastError = null;
      break;
    } catch (error) {
      landlordLastError = error;
      landlordAttempt.status = 'failed';
      landlordAttempt.error = error instanceof Error ? error.message : String(error);
      console.warn(`[房东模拟器] 无法从 ${landlordSource} 加载`, error);
    }
  }

  if (landlordLastError) {
    landlordLoaderState.status = 'failed';
    landlordLoaderState.error = landlordLastError instanceof Error
      ? landlordLastError.message
      : String(landlordLastError);
    const landlordToast = globalThis.toastr ?? landlordHost.toastr;
    landlordToast?.error?.('房东模拟器多合一脚本加载失败，请检查网络或改用离线版');
    throw landlordLastError;
  }
}
