/**
 * 脚本预设管理器 — 自定义脚本组合，一键切换
 *
 * 功能：
 * - 扫描酒馆助手中所有脚本（全局/预设/角色卡）
 * - 让用户勾选想要启用的脚本，保存为"预设"
 * - 支持创建、编辑、删除多套预设
 * - 一键应用预设（批量开关脚本 + 正则）
 * - 集成 FloatingMenuManager 悬浮球
 *
 * 依赖：
 * - 酒馆助手 API: getScriptTrees / updateScriptTreesWith
 * - 酒馆助手 API: getTavernRegexes / updateTavernRegexesWith（可选）
 * - FloatingMenuManager（可选）
 */

(function () {
    'use strict';

    // ================================================================
    // 常量
    // ================================================================
    const MODULE = 'ScriptPresetManager';
    const STORAGE_KEY = 'spm_presets';
    const ACTIVE_KEY  = 'spm_active';
    const OVERLAY_ID  = 'spm-overlay';
    const PANEL_ID    = 'spm-panel';
    const parentDoc   = window.parent.document;

    // ================================================================
    // 内置预设（基于脚本名称模式匹配，可跨安装移植）
    // ================================================================
    //
    // 规则按顺序匹配，第一个命中的规则生效。
    // 未命中任何规则的脚本使用 defaultEnabled 的值。
    // 导出角色卡时这些预设会随脚本一起打包，别人导入后即可直接使用。
    //
    // ★ 用户可根据实际脚本名称自行增删 rules ★

    const BUILTIN_PRESETS = [
        {
            id: '_builtin_original',
            name: '原版',
            icon: '📦',
            builtin: true,
            description: '使用原版脚本，禁用二改版',
            rules: [
                // ——— 二改版脚本一律禁用 ———
                { match: '二改版',       enabled: false },
                { match: '二创',         enabled: false },
                // ——— 始终禁用 ———
                { match: '悬浮球示例',   enabled: false },
                { match: '美化完整修复版', enabled: false },
            ],
            defaultEnabled: true,
            regexRules: [],
            defaultRegexEnabled: true,
        },
        {
            id: '_builtin_fancreation',
            name: '二创版',
            icon: '🎨',
            builtin: true,
            description: '使用二改版脚本，禁用被替代的原版',
            rules: [
                // ——— 最高优先级：二改版脚本启用 ———
                { match: '二改版', enabled: true },
                { match: '二创',   enabled: true },
                // ——— 被 公寓（二改版）替代 ———
                { match: '公寓',   enabled: false },
                // ——— 被 租客分析系统（二改版）替代 ———
                { match: '租客分析系统', enabled: false },
                { match: '分析调度器',   enabled: false },
                { match: '分析队列',     enabled: false },
                { match: '租客档案',     enabled: false },
                // ——— 被 聊天系统（二改版）替代 ———
                { match: '聊天数据库',   enabled: false },
                { match: '聊天核心',     enabled: false },
                { match: '聊天正文',     enabled: false },
                { match: '聊天APP',      enabled: false },
                // ——— 被 音乐（二改版）替代 ———
                { match: '音乐',         enabled: false },
                // ——— 小手机系统（二创版不使用） ———
                { match: '小手机',       enabled: false },
                { match: '提示词',       enabled: false },
                { match: '地图',         enabled: false },
                { match: '天气',         enabled: false },
                { match: '新闻',         enabled: false },
                { match: '和欧欧',       enabled: false },
                // ——— 始终禁用 ———
                { match: '悬浮球示例',   enabled: false },
                { match: '美化完整修复版', enabled: false },
            ],
            defaultEnabled: true,
            regexRules: [],
            defaultRegexEnabled: true,
        },
    ];

    /** 判断是否为内置预设 */
    function isBuiltin(preset) {
        return !!(preset && preset.builtin);
    }

    /** 获取内置+用户预设的合并列表（内置在前） */
    function getAllPresets() {
        return [...BUILTIN_PRESETS, ...loadPresets()];
    }

    // ================================================================
    // 数据层：预设的 CRUD
    // ================================================================

    /**
     * 预设结构:
     * {
     *   id: string,           // uuid
     *   name: string,         // 用户取的名字
     *   icon: string,         // emoji
     *   scripts: {            // 脚本快照 { [scriptId]: boolean }
     *     'xxx-uuid': true,   // 启用
     *     'yyy-uuid': false,  // 禁用
     *   },
     *   regexes: {            // 正则快照 { [regexId]: boolean }（可选）
     *     'zzz-uuid': true,
     *   },
     *   createdAt: number,
     * }
     */

    function loadPresets() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error(`[${MODULE}] 读取预设失败:`, e);
            return [];
        }
    }

    function savePresets(presets) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
        } catch (e) {
            console.error(`[${MODULE}] 保存预设失败:`, e);
        }
    }

    function getActivePresetId() {
        try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; }
    }

    function setActivePresetId(id) {
        try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
    }

    function generateId() {
        return 'spm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    // ================================================================
    // 扫描当前脚本 / 正则
    // ================================================================

    /**
     * 获取所有脚本的扁平列表
     * @returns {{ id:string, name:string, enabled:boolean, type:'script'|'folder', parentFolder?:string }[]}
     */
    function getAllScripts() {
        const list = [];
        try {
            const trees = getScriptTrees({ type: 'character' });
            trees.forEach(item => {
                if (item.type === 'script') {
                    list.push({ id: item.id, name: item.name, enabled: item.enabled, type: 'script' });
                } else if (item.type === 'folder') {
                    list.push({ id: item.id, name: item.name, enabled: item.enabled, type: 'folder' });
                    if (item.scripts) {
                        item.scripts.forEach(sub => {
                            list.push({ id: sub.id, name: sub.name, enabled: sub.enabled, type: 'script', parentFolder: item.name });
                        });
                    }
                }
            });
        } catch (e) {
            console.error(`[${MODULE}] 获取脚本列表失败:`, e);
        }
        return list;
    }

    /**
     * 获取所有正则的扁平列表
     */
    function getAllRegexes() {
        try {
            return getTavernRegexes({ type: 'character' });
        } catch (e) {
            console.warn(`[${MODULE}] 获取正则列表失败:`, e.message);
            return [];
        }
    }

    /**
     * 从当前环境创建快照
     */
    function snapshotCurrent() {
        const scripts = {};
        getAllScripts().forEach(s => { scripts[s.id] = s.enabled; });
        const regexes = {};
        getAllRegexes().forEach(r => { regexes[r.id] = r.enabled; });
        return { scripts, regexes };
    }

    // ================================================================
    // 核心：应用预设
    // ================================================================

    /**
     * 应用用户预设（基于脚本ID匹配）
     */
    async function applyPreset(preset) {
        console.log(`[${MODULE}] 应用预设: ${preset.name}`);

        // 内置预设走名称匹配逻辑
        if (isBuiltin(preset)) {
            return await applyBuiltinPreset(preset);
        }

        const disabledNames = [];

        // 1. 脚本
        try {
            const allScripts = getAllScripts();
            const nameById = {};
            allScripts.forEach(sc => { nameById[sc.id] = sc.name; });

            updateScriptTreesWith((trees) => {
                function toggle(item) {
                    if (item.id in preset.scripts) {
                        item.enabled = preset.scripts[item.id];
                        if (!preset.scripts[item.id] && item.name) disabledNames.push(item.name);
                    }
                    if (item.type === 'folder' && item.scripts) {
                        item.scripts.forEach(sub => toggle(sub));
                    }
                }
                trees.forEach(t => toggle(t));
                return trees;
            }, { type: 'character' });
        } catch (e) {
            console.error(`[${MODULE}] 脚本切换失败:`, e);
            throw e;
        }

        // 2. 正则（可选）
        if (preset.regexes && Object.keys(preset.regexes).length > 0) {
            try {
                await updateTavernRegexesWith((regexes) => {
                    regexes.forEach(r => {
                        if (r.id in preset.regexes) {
                            r.enabled = preset.regexes[r.id];
                        }
                    });
                    return regexes;
                }, { type: 'character' });
            } catch (e) {
                console.warn(`[${MODULE}] 正则切换跳过:`, e.message);
            }
        }

        setActivePresetId(preset.id);
        cleanupByDisabledNames(disabledNames);
        console.log(`[${MODULE}] 预设 "${preset.name}" 已应用`);
    }

    /**
     * 应用内置预设（基于脚本名称模式匹配，可跨安装移植）
     */
    async function applyBuiltinPreset(builtin) {
        console.log(`[${MODULE}] 应用内置预设: ${builtin.name}`);
        const disabledNames = [];

        // 1. 脚本 — 按 rules 顺序匹配名称
        try {
            updateScriptTreesWith((trees) => {
                function toggle(item) {
                    const name = item.name || '';
                    let matched = false;
                    for (const rule of builtin.rules) {
                        if (name.includes(rule.match)) {
                            item.enabled = rule.enabled;
                            if (!rule.enabled) disabledNames.push(name);
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        item.enabled = builtin.defaultEnabled;
                        if (!builtin.defaultEnabled) disabledNames.push(name);
                    }
                    if (item.type === 'folder' && item.scripts) {
                        item.scripts.forEach(sub => toggle(sub));
                    }
                }
                trees.forEach(t => toggle(t));
                return trees;
            }, { type: 'character' });
        } catch (e) {
            console.error(`[${MODULE}] 脚本切换失败:`, e);
            throw e;
        }

        // 2. 正则（可选）
        if (builtin.regexRules && builtin.regexRules.length > 0) {
            try {
                await updateTavernRegexesWith((regexes) => {
                    regexes.forEach(r => {
                        const name = r.script_name || '';
                        let matched = false;
                        for (const rule of builtin.regexRules) {
                            if (name.includes(rule.match)) {
                                r.enabled = rule.enabled;
                                matched = true;
                                break;
                            }
                        }
                        if (!matched && builtin.defaultRegexEnabled !== undefined) {
                            r.enabled = builtin.defaultRegexEnabled;
                        }
                    });
                    return regexes;
                }, { type: 'character' });
            } catch (e) {
                console.warn(`[${MODULE}] 正则切换跳过:`, e.message);
            }
        }

        setActivePresetId(builtin.id);
        cleanupByDisabledNames(disabledNames);
        console.log(`[${MODULE}] 内置预设 "${builtin.name}" 已应用`);
    }

    /**
     * 根据被禁用的脚本名称列表，调用清理函数 + 反注册FMM按钮
     */
    function cleanupByDisabledNames(disabledNames) {
        const CLEANUP_MAP = [
            { patterns: ['大富翁', 'monopoly', 'monopoly_main', '棋盘'], fn: 'cleanupMonopolyPlugin', fmmId: 'monopoly' },
            { patterns: ['掌上公寓', 'apartment', '公寓'], fn: 'cleanupApartmentPlugin', fmmId: 'apartment' },
            { patterns: ['创意工坊', 'workshop', '工坊'], fn: 'cleanupWorkshopPlugin', fmmId: 'workshop' },
            { patterns: ['手机', 'phone', '小手机', 'phone_main'], fn: 'cleanupPhone', fmmId: 'phone' },
        ];

        console.log(`[${MODULE}] 被禁用的脚本:`, disabledNames);
        const fmm = window.parent.FloatingMenuManager;

        CLEANUP_MAP.forEach(({ patterns, fn, fmmId }) => {
            const shouldClean = disabledNames.some(name =>
                patterns.some(p => name.toLowerCase().includes(p.toLowerCase()))
            );
            if (shouldClean) {
                try {
                    if (typeof window[fn] === 'function') {
                        window[fn]();
                        console.log(`[${MODULE}] 已调用 ${fn}() 清理`);
                    } else if (typeof window.parent[fn] === 'function') {
                        window.parent[fn]();
                        console.log(`[${MODULE}] 已调用 parent.${fn}() 清理`);
                    }
                } catch (e) {
                    console.warn(`[${MODULE}] 调用 ${fn}() 失败:`, e.message);
                }
                try {
                    if (fmm && typeof fmm.unregisterButton === 'function') {
                        fmm.unregisterButton(fmmId);
                    }
                } catch (e) {}
            }
        });
    }

    // ================================================================
    // CSS
    // ================================================================

    function injectStyles() {
        if (parentDoc.getElementById('spm-styles')) return;
        const css = `
<style id="spm-styles">
/* ---- Overlay ---- */
#${OVERLAY_ID} {
    position: absolute; inset: 0;
    min-height: 100vh;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(5px);
    z-index: 100010;
    display: flex; align-items: center; justify-content: center;
    animation: spmFadeIn .2s ease;
}
@keyframes spmFadeIn { from{opacity:0} to{opacity:1} }

/* ---- Panel ---- */
#${PANEL_ID} {
    background: #16162a;
    border: 1px solid rgba(124,58,237,0.3);
    border-radius: 16px;
    width: 500px; max-width: 94vw; max-height: 85vh;
    display: flex; flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.1);
    color: #ddd;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
}

/* ---- Header ---- */
.spm-header {
    padding: 18px 22px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
}
.spm-header h2 { margin:0; font-size:17px; font-weight:700; color:#fff; }
.spm-close {
    width:30px; height:30px; border:none;
    background: rgba(255,255,255,0.07); border-radius:8px;
    color:#888; font-size:16px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition: all .15s;
}
.spm-close:hover { background:rgba(255,80,80,.2); color:#ff6b6b; }

/* ---- Body (scrollable) ---- */
.spm-body {
    flex: 1; overflow-y: auto; padding: 18px 22px;
}

/* ---- View: 预设列表 ---- */
.spm-preset-list { display: flex; flex-direction: column; gap: 10px; }

.spm-preset-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex; align-items: center; gap: 14px;
    cursor: pointer;
    transition: all .18s;
}
.spm-preset-card:hover {
    background: rgba(124,58,237,0.08);
    border-color: rgba(124,58,237,0.25);
}
.spm-preset-card.active {
    border-color: #7c3aed;
    background: rgba(124,58,237,0.12);
    box-shadow: 0 0 16px rgba(124,58,237,0.15);
}

.spm-preset-icon { font-size: 28px; flex-shrink:0; }
.spm-preset-info { flex:1; min-width:0; }
.spm-preset-name { font-size:14px; font-weight:600; color:#fff; }
.spm-preset-meta { font-size:11px; color:#777; margin-top:2px; }

.spm-preset-actions { display:flex; gap:6px; flex-shrink:0; }

.spm-btn {
    padding: 6px 14px; border:none; border-radius:8px;
    font-size: 12px; font-weight:600; cursor:pointer;
    transition: all .15s; color:#fff;
}
.spm-btn-apply {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
}
.spm-btn-apply:hover { filter: brightness(1.15); }
.spm-btn-apply:disabled { opacity:.5; cursor:default; filter:none; }
.spm-btn-edit {
    background: rgba(255,255,255,0.08); color:#ccc;
}
.spm-btn-edit:hover { background: rgba(255,255,255,0.15); }
.spm-btn-delete {
    background: rgba(239,68,68,0.12); color:#f87171;
}
.spm-btn-delete:hover { background: rgba(239,68,68,0.25); }
.spm-btn-create {
    background: linear-gradient(135deg, #059669, #047857);
    padding: 10px 20px; font-size:13px;
    width: 100%; margin-top: 8px;
}
.spm-btn-create:hover { filter: brightness(1.1); }
.spm-btn-snapshot {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    padding: 10px 20px; font-size:13px;
    width: 100%; margin-top: 4px;
}
.spm-btn-snapshot:hover { filter: brightness(1.1); }

.spm-empty {
    text-align:center; padding:30px 0; color:#666;
}
.spm-empty-icon { font-size:40px; margin-bottom:10px; }

/* ---- Badges ---- */
.spm-badge-active {
    display:inline-block; padding:2px 8px; border-radius:8px;
    font-size:10px; font-weight:700;
    background:rgba(124,58,237,0.25); color:#c084fc;
    margin-left: 8px; vertical-align: middle;
}
.spm-badge-builtin {
    display:inline-block; padding:2px 8px; border-radius:8px;
    font-size:10px; font-weight:700;
    background:rgba(245,158,11,0.2); color:#fbbf24;
    margin-left: 8px; vertical-align: middle;
}
.spm-preset-card.builtin {
    border-left: 3px solid rgba(245,158,11,0.5);
}

/* ---- View: 编辑预设 ---- */
.spm-edit-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 16px;
}
.spm-edit-back {
    width:32px; height:32px; border:none;
    background:rgba(255,255,255,0.07); border-radius:8px;
    color:#aaa; font-size:16px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
}
.spm-edit-back:hover { background:rgba(255,255,255,0.14); color:#fff; }

.spm-edit-title { font-size:15px; font-weight:600; color:#fff; }

.spm-field { margin-bottom: 14px; }
.spm-field label {
    display:block; font-size:12px; font-weight:600; color:#999;
    margin-bottom:5px;
}
.spm-field input, .spm-field select {
    width:100%; padding:8px 12px;
    background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; color:#eee; font-size:13px;
    outline:none; transition: border-color .15s;
}
.spm-field input:focus, .spm-field select:focus {
    border-color: rgba(124,58,237,0.5);
}

.spm-field-row { display:flex; gap:10px; }
.spm-field-row .spm-field { flex:1; }

/* ---- 脚本勾选列表 ---- */
.spm-script-section-title {
    font-size:11px; font-weight:700; color:#666;
    text-transform:uppercase; letter-spacing:.5px;
    padding:10px 0 6px; border-top:1px solid rgba(255,255,255,0.05);
    margin-top:6px;
    display:flex; justify-content:space-between; align-items:center;
}
.spm-select-all {
    font-size:11px; color:#7c3aed; cursor:pointer;
    font-weight:600; text-transform:none; letter-spacing:0;
}
.spm-select-all:hover { text-decoration: underline; }

.spm-script-check-list { display:flex; flex-direction:column; gap:2px; }

.spm-script-row {
    display:flex; align-items:center; gap:10px;
    padding: 7px 10px; border-radius:8px;
    cursor:pointer; transition: background .12s;
}
.spm-script-row:hover { background:rgba(255,255,255,0.04); }

.spm-script-row input[type="checkbox"] {
    width:16px; height:16px; accent-color:#7c3aed;
    cursor:pointer; flex-shrink:0;
}
.spm-script-row .name {
    font-size:13px; color:#ccc; flex:1;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.spm-script-row .folder-tag {
    font-size:10px; color:#666; background:rgba(255,255,255,0.05);
    padding:1px 6px; border-radius:4px; flex-shrink:0;
}

.spm-search {
    width:100%; padding:8px 12px;
    background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; color:#eee; font-size:13px;
    outline:none; margin-bottom:10px;
}
.spm-search:focus { border-color:rgba(124,58,237,0.5); }
.spm-search::placeholder { color:#555; }

/* ---- 正则勾选区 ---- */
.spm-regex-toggle {
    font-size:12px; color:#888; cursor:pointer; user-select:none;
    margin-top:14px; padding:8px 0;
    border-top:1px solid rgba(255,255,255,0.05);
}
.spm-regex-toggle:hover { color:#bbb; }

/* ---- Footer bar ---- */
.spm-footer {
    padding: 14px 22px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex; justify-content: flex-end; gap: 8px;
    flex-shrink:0;
}
.spm-btn-save {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    padding:8px 24px; font-size:13px;
}
.spm-btn-save:hover { filter:brightness(1.15); }
.spm-btn-cancel {
    background: rgba(255,255,255,0.08); color:#ccc;
    padding:8px 18px; font-size:13px;
}
.spm-btn-cancel:hover { background:rgba(255,255,255,0.15); }

/* ---- Loading ---- */
.spm-loading-overlay {
    position:absolute; inset:0;
    background:rgba(22,22,42,0.85);
    display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    z-index:10; border-radius:16px;
}
.spm-spinner {
    width:28px; height:28px;
    border:3px solid rgba(124,58,237,0.2);
    border-top-color:#7c3aed;
    border-radius:50%;
    animation: spmSpin .7s linear infinite;
    margin-bottom:10px;
}
@keyframes spmSpin { to{transform:rotate(360deg)} }
.spm-loading-text { font-size:13px; color:#999; }

/* ---- Warning ---- */
.spm-warning {
    background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.18);
    border-radius:8px; padding:10px 14px; margin-top:14px;
    font-size:11px; color:#fbbf24; line-height:1.5;
}

/* ---- Scrollbar ---- */
.spm-body::-webkit-scrollbar { width:6px; }
.spm-body::-webkit-scrollbar-track { background:transparent; }
.spm-body::-webkit-scrollbar-thumb { background:rgba(124,58,237,0.3); border-radius:3px; }

/* ---- 移动端响应式 ---- */
@media (max-width: 768px) {
    #${PANEL_ID} {
        width: 95%; max-width: 400px; max-height: 88vh;
    }
    .spm-header { padding: 14px 16px 10px; }
    .spm-header h2 { font-size: 15px; }
    .spm-body { padding: 14px 16px; }
    .spm-preset-card { padding: 10px 12px; gap: 10px; }
    .spm-preset-icon { font-size: 22px; }
    .spm-preset-name { font-size: 13px; }
    .spm-preset-actions { gap: 4px; }
    .spm-btn { padding: 5px 10px; font-size: 11px; }
    .spm-footer { padding: 10px 16px; }
    .spm-field-row { flex-direction: column; gap: 6px; }
}
@media (max-width: 480px) {
    #${PANEL_ID} {
        width: 98%; max-height: 90vh; border-radius: 10px;
    }
    .spm-header { padding: 12px 12px 8px; }
    .spm-header h2 { font-size: 14px; }
    .spm-body { padding: 10px 12px; }
    .spm-preset-card { flex-wrap: wrap; }
    .spm-preset-actions { width: 100%; justify-content: flex-end; margin-top: 6px; }
    .spm-btn-create, .spm-btn-snapshot { padding: 8px 14px; font-size: 12px; }
    .spm-footer { padding: 8px 12px; }
}
</style>`;
        parentDoc.head.insertAdjacentHTML('beforeend', css);
    }

    // ================================================================
    // UI 渲染
    // ================================================================

    let _currentView = 'list';  // 'list' | 'edit'
    let _editingPreset = null;  // 正在编辑的预设对象（null=新建）

    function openPanel() {
        if (parentDoc.getElementById(OVERLAY_ID)) { closePanel(); return; }
        injectStyles();
        _currentView = 'list';
        _editingPreset = null;
        renderOverlay();
    }

    function closePanel() {
        const el = parentDoc.getElementById(OVERLAY_ID);
        if (el) {
            el.style.opacity = '0';
            el.style.transition = 'opacity .15s';
            setTimeout(() => el.remove(), 150);
        }
    }

    function renderOverlay() {
        let overlay = parentDoc.getElementById(OVERLAY_ID);
        if (!overlay) {
            overlay = parentDoc.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
            parentDoc.body.appendChild(overlay);
        }

        const panel = _currentView === 'list' ? renderListView() : renderEditView();
        overlay.innerHTML = '';
        overlay.appendChild(panel);
    }

    // ---- 列表视图 ----
    function renderListView() {
        const allPresets = getAllPresets();
        const activeId = getActivePresetId();

        const panel = parentDoc.createElement('div');
        panel.id = PANEL_ID;

        // Header
        panel.innerHTML = `
            <div class="spm-header">
                <h2>⚙️ 脚本预设管理器</h2>
                <button class="spm-close" id="spm-close">✕</button>
            </div>
            <div class="spm-body" id="spm-body"></div>`;

        const body = panel.querySelector('#spm-body');

        if (allPresets.length === 0) {
            body.innerHTML = `
                <div class="spm-empty">
                    <div class="spm-empty-icon">📦</div>
                    <div>还没有预设</div>
                    <div style="font-size:12px;color:#555;margin-top:4px">创建你的第一个脚本预设吧</div>
                </div>`;
        } else {
            let cardsHTML = '<div class="spm-preset-list">';
            allPresets.forEach(p => {
                const isActive = p.id === activeId;
                const builtin = isBuiltin(p);
                // 内置预设显示规则数量，用户预设显示脚本数量
                let metaText;
                if (builtin) {
                    metaText = escHtml(p.description || `${p.rules.length} 条规则`);
                } else {
                    const scriptCount = Object.keys(p.scripts || {}).length;
                    const enabledCount = Object.values(p.scripts || {}).filter(v => v).length;
                    metaText = `${enabledCount}/${scriptCount} 脚本启用`;
                }
                cardsHTML += `
                    <div class="spm-preset-card ${isActive ? 'active' : ''} ${builtin ? 'builtin' : ''}" data-id="${p.id}">
                        <div class="spm-preset-icon">${p.icon || '📋'}</div>
                        <div class="spm-preset-info">
                            <div class="spm-preset-name">
                                ${escHtml(p.name)}
                                ${builtin ? '<span class="spm-badge-builtin">内置</span>' : ''}
                                ${isActive ? '<span class="spm-badge-active">当前</span>' : ''}
                            </div>
                            <div class="spm-preset-meta">${metaText}</div>
                        </div>
                        <div class="spm-preset-actions">
                            <button class="spm-btn spm-btn-apply" data-action="apply" data-id="${p.id}" ${isActive ? 'disabled' : ''}>
                                ${isActive ? '✓ 已应用' : '应用'}
                            </button>
                            ${builtin ? '' : `<button class="spm-btn spm-btn-edit" data-action="edit" data-id="${p.id}">✎</button>`}
                            ${builtin ? '' : `<button class="spm-btn spm-btn-export" data-action="export" data-id="${p.id}" title="导出名单">📋</button>`}
                            ${builtin ? '' : `<button class="spm-btn spm-btn-delete" data-action="delete" data-id="${p.id}">✕</button>`}
                        </div>
                    </div>`;
            });
            cardsHTML += '</div>';
            body.innerHTML = cardsHTML;
        }

        // Bottom buttons
        body.insertAdjacentHTML('beforeend', `
            <button class="spm-btn spm-btn-create" id="spm-new">＋ 新建预设</button>
            <button class="spm-btn spm-btn-snapshot" id="spm-snapshot">📸 从当前状态创建预设</button>
            <div class="spm-warning">
                ⚠️ 应用预设会批量切换脚本启用状态。如果预设中包含正则变更，将触发聊天重载。建议在非生成时操作。
            </div>`);

        // Events
        setTimeout(() => {
            panel.querySelector('#spm-close')?.addEventListener('click', closePanel);

            panel.querySelector('#spm-new')?.addEventListener('click', () => {
                _editingPreset = null;
                _currentView = 'edit';
                renderOverlay();
            });

            panel.querySelector('#spm-snapshot')?.addEventListener('click', () => {
                const snap = snapshotCurrent();
                _editingPreset = {
                    id: generateId(),
                    name: '当前状态快照',
                    icon: '📸',
                    scripts: snap.scripts,
                    regexes: snap.regexes,
                    createdAt: Date.now(),
                };
                _currentView = 'edit';
                renderOverlay();
            });

            panel.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    if (action === 'apply') handleApply(id);
                    if (action === 'edit') handleEdit(id);
                    if (action === 'export') handleExport(id);
                    if (action === 'delete') handleDelete(id);
                });
            });
        }, 0);

        return panel;
    }

    // ---- 编辑视图 ----
    function renderEditView() {
        const isNew = !_editingPreset || !loadPresets().find(p => p.id === _editingPreset?.id);
        const preset = _editingPreset || { id: generateId(), name: '', icon: '📋', scripts: {}, regexes: {}, createdAt: Date.now() };
        _editingPreset = preset;

        const allScripts = getAllScripts();
        const allRegexes = getAllRegexes();

        // 分组：独立脚本 + 文件夹内脚本
        const standaloneScripts = allScripts.filter(s => s.type === 'script' && !s.parentFolder);
        const folders = {};
        allScripts.filter(s => s.type === 'folder').forEach(f => { folders[f.name] = f; });
        const folderScripts = {};
        allScripts.filter(s => s.parentFolder).forEach(s => {
            if (!folderScripts[s.parentFolder]) folderScripts[s.parentFolder] = [];
            folderScripts[s.parentFolder].push(s);
        });

        const panel = parentDoc.createElement('div');
        panel.id = PANEL_ID;

        // Header + Footer
        panel.innerHTML = `
            <div class="spm-header">
                <h2>${isNew ? '✨ 新建预设' : '✏️ 编辑预设'}</h2>
                <button class="spm-close" id="spm-close">✕</button>
            </div>
            <div class="spm-body" id="spm-body"></div>
            <div class="spm-footer">
                <button class="spm-btn spm-btn-cancel" id="spm-cancel">取消</button>
                <button class="spm-btn spm-btn-save" id="spm-save">💾 ${isNew ? '创建' : '保存'}</button>
            </div>`;

        const body = panel.querySelector('#spm-body');
        let html = '';

        // 名字 + 图标
        html += `
            <div class="spm-edit-header">
                <button class="spm-edit-back" id="spm-back">←</button>
                <span class="spm-edit-title">${isNew ? '配置新预设' : '编辑: ' + escHtml(preset.name)}</span>
            </div>
            <div class="spm-field-row">
                <div class="spm-field" style="flex:3">
                    <label>预设名称</label>
                    <input type="text" id="spm-name" value="${escAttr(preset.name)}" placeholder="给预设取个名字…">
                </div>
                <div class="spm-field" style="flex:1">
                    <label>图标</label>
                    <input type="text" id="spm-icon" value="${escAttr(preset.icon)}" placeholder="📋" maxlength="4">
                </div>
            </div>`;

        // 搜索
        html += `<input type="text" class="spm-search" id="spm-search" placeholder="🔍 搜索脚本名…">`;

        // 脚本勾选
        function renderScriptRows(scripts, sectionLabel, sectionKey) {
            if (scripts.length === 0) return '';
            let s = `
                <div class="spm-script-section-title">
                    ${sectionLabel} (${scripts.length})
                    <span class="spm-select-all" data-section="${sectionKey}">全选/取消</span>
                </div>
                <div class="spm-script-check-list" data-section="${sectionKey}">`;
            scripts.forEach(sc => {
                const checked = (sc.id in preset.scripts) ? preset.scripts[sc.id] : sc.enabled;
                s += `
                    <label class="spm-script-row" data-name="${escAttr(sc.name.toLowerCase())}">
                        <input type="checkbox" data-script-id="${sc.id}" ${checked ? 'checked' : ''}>
                        <span class="name">${escHtml(sc.name)}</span>
                        ${sc.parentFolder ? `<span class="folder-tag">${escHtml(sc.parentFolder)}</span>` : ''}
                    </label>`;
            });
            s += '</div>';
            return s;
        }

        html += renderScriptRows(standaloneScripts, '独立脚本', 'standalone');
        Object.keys(folderScripts).forEach(folderName => {
            html += renderScriptRows(folderScripts[folderName], `📁 ${folderName}`, 'folder_' + folderName);
        });

        // 正则（折叠）
        if (allRegexes.length > 0) {
            html += `<div class="spm-regex-toggle" id="spm-regex-toggle">▶ 正则设置 (${allRegexes.length})</div>`;
            html += `<div class="spm-script-check-list" id="spm-regex-list" style="display:none">`;
            allRegexes.forEach(r => {
                const checked = (r.id in preset.regexes) ? preset.regexes[r.id] : r.enabled;
                html += `
                    <label class="spm-script-row" data-name="${escAttr((r.script_name||'').toLowerCase())}">
                        <input type="checkbox" data-regex-id="${r.id}" ${checked ? 'checked' : ''}>
                        <span class="name">${escHtml(r.script_name || r.id)}</span>
                    </label>`;
            });
            html += '</div>';
        }

        body.innerHTML = html;

        // Events
        setTimeout(() => {
            panel.querySelector('#spm-close')?.addEventListener('click', closePanel);
            panel.querySelector('#spm-back')?.addEventListener('click', () => {
                _currentView = 'list';
                renderOverlay();
            });
            panel.querySelector('#spm-cancel')?.addEventListener('click', () => {
                _currentView = 'list';
                renderOverlay();
            });

            // 搜索
            panel.querySelector('#spm-search')?.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase().trim();
                panel.querySelectorAll('.spm-script-row').forEach(row => {
                    const name = row.dataset.name || '';
                    row.style.display = (!q || name.includes(q)) ? '' : 'none';
                });
            });

            // 全选/取消
            panel.querySelectorAll('.spm-select-all').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = btn.dataset.section;
                    const list = panel.querySelector(`.spm-script-check-list[data-section="${section}"]`);
                    if (!list) return;
                    const boxes = list.querySelectorAll('input[type="checkbox"]');
                    const allChecked = Array.from(boxes).every(b => b.checked);
                    boxes.forEach(b => { b.checked = !allChecked; });
                });
            });

            // 正则折叠
            panel.querySelector('#spm-regex-toggle')?.addEventListener('click', () => {
                const list = panel.querySelector('#spm-regex-list');
                const toggle = panel.querySelector('#spm-regex-toggle');
                if (list.style.display === 'none') {
                    list.style.display = '';
                    toggle.textContent = `▼ 正则设置 (${allRegexes.length})`;
                } else {
                    list.style.display = 'none';
                    toggle.textContent = `▶ 正则设置 (${allRegexes.length})`;
                }
            });

            // 保存
            panel.querySelector('#spm-save')?.addEventListener('click', () => {
                const name = panel.querySelector('#spm-name')?.value.trim();
                const icon = panel.querySelector('#spm-icon')?.value.trim() || '📋';

                if (!name) {
                    panel.querySelector('#spm-name').style.borderColor = '#ef4444';
                    panel.querySelector('#spm-name').focus();
                    return;
                }

                // 收集脚本状态
                const scripts = {};
                panel.querySelectorAll('[data-script-id]').forEach(cb => {
                    scripts[cb.dataset.scriptId] = cb.checked;
                });
                // 收集正则状态
                const regexes = {};
                panel.querySelectorAll('[data-regex-id]').forEach(cb => {
                    regexes[cb.dataset.regexId] = cb.checked;
                });

                const presets = loadPresets();
                const existing = presets.findIndex(p => p.id === preset.id);

                const saved = {
                    id: preset.id,
                    name: name,
                    icon: icon,
                    scripts: scripts,
                    regexes: regexes,
                    createdAt: preset.createdAt || Date.now(),
                };

                if (existing >= 0) {
                    presets[existing] = saved;
                } else {
                    presets.push(saved);
                }

                savePresets(presets);
                _currentView = 'list';
                renderOverlay();

                try {
                    if (window.parent.toastr) {
                        window.parent.toastr.success(`预设 "${name}" 已保存`, '保存成功', { timeOut: 2000 });
                    }
                } catch (e) {}
            });
        }, 0);

        return panel;
    }

    // ---- 操作处理 ----

    async function handleApply(id) {
        const preset = getAllPresets().find(p => p.id === id);
        if (!preset) return;

        // 显示loading
        const panel = parentDoc.getElementById(PANEL_ID);
        if (panel) {
            const loadEl = parentDoc.createElement('div');
            loadEl.className = 'spm-loading-overlay';
            loadEl.innerHTML = '<div class="spm-spinner"></div><div class="spm-loading-text">正在应用预设…</div>';
            panel.style.position = 'relative';
            panel.appendChild(loadEl);
        }

        try {
            await applyPreset(preset);
            setTimeout(() => {
                closePanel();
                try {
                    if (window.parent.toastr) {
                        window.parent.toastr.success(`已应用预设 "${preset.name}"`, '切换成功', { timeOut: 3000 });
                    }
                } catch (e) {}
            }, 600);
        } catch (e) {
            // 移除loading
            parentDoc.querySelector('.spm-loading-overlay')?.remove();
            try {
                if (window.parent.toastr) {
                    window.parent.toastr.error(`应用失败: ${e.message}`, '错误');
                }
            } catch (e2) {}
        }
    }

    function handleExport(id) {
        const presets = loadPresets();
        const preset = presets.find(p => p.id === id);
        if (!preset) return;

        // 获取当前脚本列表，建立 id → name 映射
        const allScripts = getAllScripts();
        const nameById = {};
        allScripts.forEach(sc => { nameById[sc.id] = sc.name; });

        const enabled = [];
        const disabled = [];
        Object.keys(preset.scripts).forEach(sid => {
            const name = nameById[sid] || sid;
            if (preset.scripts[sid]) enabled.push(name);
            else disabled.push(name);
        });

        let text = `【预设名单导出】${preset.name}\n`;
        text += `\n✅ 启用的脚本 (${enabled.length}):\n`;
        enabled.forEach(n => { text += `  - ${n}\n`; });
        text += `\n❌ 禁用的脚本 (${disabled.length}):\n`;
        disabled.forEach(n => { text += `  - ${n}\n`; });

        // 正则
        if (preset.regexes && Object.keys(preset.regexes).length > 0) {
            const allRegexes = getAllRegexes();
            const rNameById = {};
            allRegexes.forEach(r => { rNameById[r.id] = r.script_name || r.id; });
            const rEnabled = [], rDisabled = [];
            Object.keys(preset.regexes).forEach(rid => {
                const name = rNameById[rid] || rid;
                if (preset.regexes[rid]) rEnabled.push(name);
                else rDisabled.push(name);
            });
            if (rEnabled.length) {
                text += `\n✅ 启用的正则 (${rEnabled.length}):\n`;
                rEnabled.forEach(n => { text += `  - ${n}\n`; });
            }
            if (rDisabled.length) {
                text += `\n❌ 禁用的正则 (${rDisabled.length}):\n`;
                rDisabled.forEach(n => { text += `  - ${n}\n`; });
            }
        }

        // 复制到剪贴板
        try {
            navigator.clipboard.writeText(text).then(() => {
                if (window.parent.toastr) {
                    window.parent.toastr.success('名单已复制到剪贴板', '导出成功', { timeOut: 3000 });
                }
            }).catch(() => {
                // fallback: 弹窗显示
                window.parent.prompt('名单已生成，请复制:', text);
            });
        } catch (e) {
            window.parent.prompt('名单已生成，请复制:', text);
        }
    }

    function handleEdit(id) {
        const presets = loadPresets();
        const preset = presets.find(p => p.id === id);
        if (!preset) return;
        _editingPreset = JSON.parse(JSON.stringify(preset)); // deep clone
        _currentView = 'edit';
        renderOverlay();
    }

    function handleDelete(id) {
        // 内置预设不可删除
        if (BUILTIN_PRESETS.some(b => b.id === id)) return;

        const presets = loadPresets();
        const preset = presets.find(p => p.id === id);
        if (!preset) return;

        const confirmed = window.parent.confirm(`确定删除预设 "${preset.name}" 吗？`);
        if (!confirmed) return;

        const filtered = presets.filter(p => p.id !== id);
        savePresets(filtered);

        if (getActivePresetId() === id) setActivePresetId('');

        renderOverlay();
        try {
            if (window.parent.toastr) {
                window.parent.toastr.info(`已删除预设 "${preset.name}"`, '已删除', { timeOut: 2000 });
            }
        } catch (e) {}
    }

    // ---- 工具 ----
    function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

    // ================================================================
    // 注册到 FloatingMenuManager
    // ================================================================

    function registerToFMM() {
        const config = {
            id: 'script-preset-manager',
            icon: '<img src="https://api.iconify.design/mdi:format-list-checks.svg?color=%23ffffff" style="width:24px;height:24px;">',
            label: '脚本预设',
            color: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            order: 90,
            onClick: openPanel
        };

        const fmm = window.parent.FloatingMenuManager;
        if (fmm && typeof fmm.registerButton === 'function') {
            fmm.registerButton(config);
            console.log(`[${MODULE}] 已注册到 FloatingMenuManager`);
        } else {
            if (!window.parent._fmmPendingRegistrations) {
                window.parent._fmmPendingRegistrations = [];
            }
            window.parent._fmmPendingRegistrations.push(config);
            console.log(`[${MODULE}] FMM未就绪，已加入待注册队列`);
        }
    }

    // ================================================================
    // 初始化
    // ================================================================

    function init() {
        console.log(`[${MODULE}] 初始化...`);

        const oldOverlay = parentDoc.getElementById(OVERLAY_ID);
        if (oldOverlay) oldOverlay.remove();

        registerToFMM();

        window.parent.ScriptPresetManager = {
            open: openPanel,
            close: closePanel,
            apply: async (presetName) => {
                const all = getAllPresets();
                const p = all.find(x => x.name === presetName);
                if (p) await applyPreset(p);
                else console.warn(`[${MODULE}] 预设 "${presetName}" 不存在`);
            },
            list: () => getAllPresets().map(p => ({ id: p.id, name: p.name, icon: p.icon, builtin: !!p.builtin })),
            getActive: getActivePresetId,
            snapshot: snapshotCurrent,
        };

        console.log(`[${MODULE}] 初始化完成。点击悬浮球 ⚙️ 或调用 ScriptPresetManager.open() 打开`);
    }

    init();

    $(window).on('pagehide', function () {
        parentDoc.getElementById(OVERLAY_ID)?.remove();
        parentDoc.getElementById('spm-styles')?.remove();
    });

})();
