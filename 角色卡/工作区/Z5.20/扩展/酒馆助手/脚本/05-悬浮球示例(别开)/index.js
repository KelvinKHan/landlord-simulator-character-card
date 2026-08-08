/**
 * 悬浮球脚本 - 角色卡专属
 * 
 * 功能：
 * 1. 在角色卡内显示一个可自由拖动的悬浮球
 * 2. 离开角色卡返回首页时，悬浮球自动消失
 * 3. 支持保存位置到本地存储
 * 
 * 使用方法：
 * 将此脚本添加到酒馆助手的"角色脚本库"中
 * 这样脚本只会在进入当前角色卡的聊天时生效
 * 
 * 重要说明：
 * 酒馆助手脚本运行在iframe沙箱中，但其中的 $ (jQuery) 是父页面的jQuery
 * 所以必须用 $ 来操作父页面DOM，而不能用原生 document 方法
 */

// ============ 配置区域 ============
const CONFIG = {
    // 悬浮球ID（用于唯一标识）
    floatingBallId: 'character-floating-ball',
    // 悬浮球初始位置
    defaultPosition: { top: 100, left: 20 },
    // 悬浮球大小
    size: 50,
    // 悬浮球图标（可以是emoji或图片URL）
    icon: '🎯',
    // 悬浮球背景色
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    // 本地存储键名（会自动加上角色名前缀）
    storageKey: 'floatingBallPosition'
};

// ============ 获取父页面document ============
// 酒馆助手的 $ 是父页面的jQuery，可以直接用它操作父页面DOM
const parentDocument = window.parent.document;

// ============ 工具函数 ============

/**
 * 获取存储键名（加上角色名前缀避免冲突）
 */
function getStorageKey() {
    // 尝试获取当前角色名
    let characterName = 'default';
    try {
        if (typeof getCharacterName === 'function') {
            characterName = getCharacterName() || 'default';
        }
    } catch (e) {
        console.warn('[悬浮球] 获取角色名失败:', e);
    }
    return `${CONFIG.storageKey}_${characterName}`;
}

/**
 * 保存位置到本地存储
 */
function savePosition(top, left) {
    try {
        const position = { top, left };
        localStorage.setItem(getStorageKey(), JSON.stringify(position));
    } catch (e) {
        console.warn('[悬浮球] 保存位置失败:', e);
    }
}

/**
 * 从本地存储读取位置
 */
function loadPosition() {
    try {
        const saved = localStorage.getItem(getStorageKey());
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('[悬浮球] 读取位置失败:', e);
    }
    return CONFIG.defaultPosition;
}

/**
 * 创建悬浮球样式（添加到父页面）
 */
function createStyles() {
    const styleId = `${CONFIG.floatingBallId}-styles`;

    // 如果样式已存在，不重复创建（检查父页面）
    if ($(`#${styleId}`).length > 0) return;

    const styleContent = `
        #${CONFIG.floatingBallId} {
            position: fixed;
            width: ${CONFIG.size}px;
            height: ${CONFIG.size}px;
            background: ${CONFIG.backgroundColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            z-index: 99999;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3),
                        0 0 0 3px rgba(255, 255, 255, 0.1);
            user-select: none;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            font-size: ${CONFIG.size * 0.5}px;
            color: white;
            touch-action: none;
        }
        
        #${CONFIG.floatingBallId}:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4),
                        0 0 0 4px rgba(255, 255, 255, 0.2);
        }
        
        #${CONFIG.floatingBallId}:active {
            cursor: grabbing;
            transform: scale(1.05);
        }
        
        #${CONFIG.floatingBallId}.dragging {
            cursor: grabbing;
            transform: scale(1.05);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5),
                        0 0 0 4px rgba(255, 255, 255, 0.3);
            transition: none;
        }
        
        /* 展开的菜单 */
        #${CONFIG.floatingBallId}-menu {
            position: fixed;
            background: rgba(30, 30, 30, 0.95);
            border-radius: 12px;
            padding: 8px;
            display: none;
            flex-direction: column;
            gap: 4px;
            z-index: 99998;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
            min-width: 120px;
        }
        
        #${CONFIG.floatingBallId}-menu.show {
            display: flex;
            animation: floatingBallFadeIn 0.2s ease;
        }
        
        #${CONFIG.floatingBallId}-menu button {
            background: transparent;
            border: none;
            color: white;
            padding: 10px 16px;
            text-align: left;
            cursor: pointer;
            border-radius: 8px;
            font-size: 14px;
            transition: background 0.2s ease;
        }
        
        #${CONFIG.floatingBallId}-menu button:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        @keyframes floatingBallFadeIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    `;

    // 使用jQuery添加样式到父页面的head
    $('<style>')
        .attr('id', styleId)
        .text(styleContent)
        .appendTo('head');

    console.log('[悬浮球] 样式已添加到父页面');
}

/**
 * 创建悬浮球元素
 */
function createFloatingBall() {
    // 如果悬浮球已存在，不重复创建（检查父页面）
    if ($(`#${CONFIG.floatingBallId}`).length > 0) {
        console.log('[悬浮球] 悬浮球已存在');
        return;
    }

    // 创建样式
    createStyles();

    // 读取保存的位置
    const savedPosition = loadPosition();

    // 使用jQuery创建悬浮球（会添加到父页面）
    const $ball = $('<div>')
        .attr('id', CONFIG.floatingBallId)
        .html(CONFIG.icon)
        .css({
            top: `${savedPosition.top}px`,
            left: `${savedPosition.left}px`
        })
        .appendTo('body');

    // 使用jQuery创建菜单（会添加到父页面）
    const $menu = $('<div>')
        .attr('id', `${CONFIG.floatingBallId}-menu`)
        .html(`
            <button data-action="action1">📝 功能1</button>
            <button data-action="action2">⚙️ 功能2</button>
            <button data-action="action3">🔄 重置位置</button>
        `)
        .appendTo('body');

    // 设置拖拽功能
    setupDragAndDrop($ball);

    // 设置点击功能
    setupClickHandler($ball, $menu);

    console.log('[悬浮球] 悬浮球已创建并添加到父页面');
}

/**
 * 设置拖拽功能
 */
function setupDragAndDrop($ball) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, initialX, initialY;

    const onStart = (e) => {
        isDragging = true;
        hasMoved = false;

        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;

        const rect = $ball[0].getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        $ball.addClass('dragging');

        e.preventDefault();
    };

    const onMove = (e) => {
        if (!isDragging) return;

        const touch = e.touches ? e.touches[0] : e;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        // 判断是否真的移动了
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true;
        }

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        // 边界限制（使用父窗口的尺寸）
        const ballSize = CONFIG.size;
        const maxX = window.parent.innerWidth - ballSize;
        const maxY = window.parent.innerHeight - ballSize;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        $ball.css({
            left: `${newX}px`,
            top: `${newY}px`
        });

        e.preventDefault();
    };

    const onEnd = () => {
        if (!isDragging) return;

        isDragging = false;
        $ball.removeClass('dragging');

        // 保存位置
        const rect = $ball[0].getBoundingClientRect();
        savePosition(rect.top, rect.left);

        // 如果移动了，标记一下
        $ball.data('moved', hasMoved);
    };

    // 使用jQuery绑定事件到父页面document
    $ball.on('mousedown touchstart', onStart);
    $(parentDocument).on('mousemove touchmove', onMove);
    $(parentDocument).on('mouseup touchend', onEnd);
}

/**
 * 设置点击处理
 */
function setupClickHandler($ball, $menu) {
    $ball.on('click', (e) => {
        // 如果刚刚拖拽过，不触发点击
        if ($ball.data('moved') === true) {
            $ball.data('moved', false);
            return;
        }

        // 切换菜单显示
        const isVisible = $menu.hasClass('show');

        if (isVisible) {
            $menu.removeClass('show');
        } else {
            // 计算菜单位置
            const ballRect = $ball[0].getBoundingClientRect();
            const menuWidth = 140;

            let menuX = ballRect.right + 10;
            let menuY = ballRect.top;

            // 如果超出右边界，显示在左边
            if (menuX + menuWidth > window.parent.innerWidth) {
                menuX = ballRect.left - menuWidth - 10;
            }

            // 如果超出下边界，向上调整
            if (menuY + 150 > window.parent.innerHeight) {
                menuY = window.parent.innerHeight - 160;
            }

            $menu.css({
                left: `${Math.max(10, menuX)}px`,
                top: `${Math.max(10, menuY)}px`
            }).addClass('show');
        }
    });

    // 点击其他地方关闭菜单
    $(parentDocument).on('click', (e) => {
        if (!$ball.is(e.target) && !$menu.is(e.target) && $menu.find(e.target).length === 0) {
            $menu.removeClass('show');
        }
    });

    // 菜单按钮点击事件
    $menu.on('click', 'button', (e) => {
        const action = $(e.target).data('action');
        handleMenuAction(action);

        // 关闭菜单
        $menu.removeClass('show');
    });
}

/**
 * 处理菜单动作
 */
function handleMenuAction(action) {
    console.log(`[悬浮球] 执行动作: ${action}`);

    switch (action) {
        case 'action1':
            // 功能1 - 可以在这里添加你的自定义功能
            // 例如：调用酒馆助手的 triggerSlash 命令
            if (typeof triggerSlash === 'function') {
                triggerSlash('/echo 你点击了功能1');
            } else {
                alert('功能1被触发！');
            }
            break;

        case 'action2':
            // 功能2
            if (typeof triggerSlash === 'function') {
                triggerSlash('/echo 你点击了功能2');
            } else {
                alert('功能2被触发！');
            }
            break;

        case 'action3':
            // 刷新功能 - 重置位置
            const $ball = $(`#${CONFIG.floatingBallId}`);
            if ($ball.length > 0) {
                $ball.css({
                    top: `${CONFIG.defaultPosition.top}px`,
                    left: `${CONFIG.defaultPosition.left}px`
                });
                savePosition(CONFIG.defaultPosition.top, CONFIG.defaultPosition.left);
                console.log('[悬浮球] 位置已重置');
            }
            break;

        default:
            console.log(`[悬浮球] 未知动作: ${action}`);
    }
}

/**
 * 移除悬浮球
 */
function removeFloatingBall() {
    // 使用jQuery从父页面移除元素
    $(`#${CONFIG.floatingBallId}`).remove();
    $(`#${CONFIG.floatingBallId}-menu`).remove();
    $(`#${CONFIG.floatingBallId}-styles`).remove();

    // 移除绑定在父页面document上的事件
    $(parentDocument).off('mousemove touchmove mouseup touchend');

    console.log('[悬浮球] 悬浮球已从父页面移除');
}

// ============ 初始化 ============

// 页面加载完成后创建悬浮球
$(() => {
    console.log('[悬浮球] 脚本已加载，正在初始化...');

    // 延迟一小段时间确保酒馆完全加载
    setTimeout(() => {
        createFloatingBall();
    }, 500);
});

// 监听脚本卸载事件 - 当离开当前角色卡时移除悬浮球
// 酒馆助手会在切换角色或返回首页时卸载角色脚本库的脚本
$(window).on('pagehide', () => {
    console.log('[悬浮球] 脚本正在卸载，清理悬浮球...');
    removeFloatingBall();
});

// 额外监听 CHAT_CHANGED 事件，确保在聊天切换时也能正确清理
if (typeof eventOn === 'function') {
    eventOn('chat_id_changed', (chatFileName) => {
        console.log('[悬浮球] 聊天已切换:', chatFileName);
        // 如果聊天文件名为空（返回首页），移除悬浮球
        if (!chatFileName) {
            removeFloatingBall();
        }
    });
}

console.log('[悬浮球] 脚本模块已注册');
