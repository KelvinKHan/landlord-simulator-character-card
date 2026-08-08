export function getHostWindow() {
  if (typeof window === 'undefined') return globalThis;
  return window.parent ?? window;
}

export function getHostDocument() {
  return getHostWindow().document ?? globalThis.document;
}

export function getHostGlobal(name) {
  return globalThis[name] ?? getHostWindow()[name];
}
