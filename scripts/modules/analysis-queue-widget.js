const STYLE_ID = 'queue-widget-styles';
const WIDGET_CLASS = 'queue-widget';
const styles = `
  .queue-widget { position:fixed; bottom:120px; right:20px; z-index:9998; min-width:200px; max-width:280px;
    padding:12px 16px; border:1px solid rgba(255,255,255,.1); border-radius:12px; color:#fff;
    background:rgba(26,26,46,.95); box-shadow:0 4px 20px rgba(0,0,0,.4); font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    transition:opacity .3s ease,transform .3s ease; }
  .queue-widget.hidden { opacity:0; transform:translateY(20px) scale(.9); pointer-events:none; }
  .queue-widget.minimized { min-width:auto; padding:8px 12px; }
  .queue-widget-header,.queue-widget-item { display:flex; align-items:center; gap:8px; }
  .queue-widget-header { justify-content:space-between; margin-bottom:8px; }
  .queue-widget-title { display:flex; align-items:center; gap:6px; font-weight:600; }
  .queue-widget-badge { padding:2px 6px; border-radius:8px; background:#3b82f6; font-size:10px; }
  .queue-widget-toggle { display:grid; place-items:center; width:20px; height:20px; border:0; border-radius:4px;
    color:#fff; background:rgba(255,255,255,.1); cursor:pointer; }
  .queue-widget-toggle:hover { background:rgba(255,255,255,.2); }
  .queue-widget.minimized .queue-widget-content { display:none; }
  .queue-widget-item { padding:6px 0; border-bottom:1px solid rgba(255,255,255,.05); font-size:11px; }
  .queue-widget-item:last-child { border-bottom:0; }
  .queue-widget-item.current { color:#4ade80; }
  .queue-widget-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .queue-widget-empty { padding:8px 0; color:rgba(255,255,255,.5); font-size:11px; text-align:center; }
  .queue-widget-spinner { width:10px; height:10px; border:2px solid rgba(255,255,255,.2); border-top-color:#4ade80;
    border-radius:50%; animation:queue-spin .8s linear infinite; }
  @keyframes queue-spin { to { transform:rotate(360deg); } }
`;

export class AnalysisQueueWidget {
  constructor(document, scheduler) {
    this.document = document;
    this.scheduler = scheduler;
    this.element = null;
    this.isMinimized = false;
    this.isVisible = false;
    this.unsubscribe = null;
  }

  mount() {
    this.#injectStyles();
    this.document.querySelector(`.${WIDGET_CLASS}`)?.remove();
    this.element = this.document.createElement('div');
    this.element.className = `${WIDGET_CLASS} hidden`;
    this.element.innerHTML = `
      <div class="queue-widget-header">
        <div class="queue-widget-title">⏳ 分析队列 <span class="queue-widget-badge">0</span></div>
        <button class="queue-widget-toggle" type="button" aria-label="折叠分析队列">−</button>
      </div>
      <div class="queue-widget-content"><div class="queue-widget-empty">暂无任务</div></div>`;
    this.document.body.appendChild(this.element);
    this.element.querySelector('.queue-widget-toggle').addEventListener('click', () => this.toggleMinimize());
    this.unsubscribe = this.scheduler.on('queue-updated', status => this.update(status));
    this.update(this.scheduler.getQueueStatus());
    return this;
  }

  update(status) {
    if (!this.element) return;
    const hasTasks = status.isProcessing || status.queueLength > 0;
    this.isVisible = hasTasks;
    this.element.classList.toggle('hidden', !hasTasks);
    this.element.querySelector('.queue-widget-badge').textContent = String(
      status.queueLength + (status.isProcessing ? 1 : 0),
    );

    const rows = [];
    if (status.currentTask) {
      rows.push(`<div class="queue-widget-item current"><span class="queue-widget-spinner"></span><span class="queue-widget-name">${this.#escape(status.currentTask.name)}</span></div>`);
    }
    for (const task of status.queue.slice(0, 3)) {
      rows.push(`<div class="queue-widget-item"><span>⏸</span><span class="queue-widget-name">${this.#escape(task.name)}</span></div>`);
    }
    if (status.queueLength > 3) {
      rows.push(`<div class="queue-widget-item"><span>…</span><span class="queue-widget-name">还有 ${status.queueLength - 3} 个任务</span></div>`);
    }
    this.element.querySelector('.queue-widget-content').innerHTML =
      rows.join('') || '<div class="queue-widget-empty">暂无任务</div>';
  }

  show() {
    this.isVisible = true;
    this.element?.classList.remove('hidden');
  }

  hide() {
    this.isVisible = false;
    this.element?.classList.add('hidden');
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.element?.classList.toggle('minimized', this.isMinimized);
    const button = this.element?.querySelector('.queue-widget-toggle');
    if (button) button.textContent = this.isMinimized ? '+' : '−';
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.element?.remove();
    this.element = null;
    this.document.getElementById(STYLE_ID)?.remove();
  }

  #injectStyles() {
    if (this.document.getElementById(STYLE_ID)) return;
    const style = this.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = styles;
    this.document.head.appendChild(style);
  }

  #escape(value) {
    const element = this.document.createElement('div');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }
}

export function activate(context) {
  const scheduler = context.services.require('analysis.scheduler');
  const widget = new AnalysisQueueWidget(context.document, scheduler).mount();
  context.services.register('analysis.queueWidget', widget, { legacyGlobal: 'QueueWidget' });
  context.logger.info('分析队列小组件已就绪');
  return () => widget.dispose();
}
