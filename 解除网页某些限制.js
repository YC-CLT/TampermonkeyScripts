// ==UserScript==
// @name         解除网页某些限制（复制，右键等）
// @namespace    https://github.com/YC-CLT/-Tampermonkey-Scripts
// @version      v1.0
// @license      MIT
// @description  解除右键菜单禁用以及 Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A 等快捷键的拦截，让你在任何网页都能自由复制、粘贴和右键。
// @author       逸畅_celestial
// @include      http*://**
// @run-at       document-start
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/占位符
// @updateURL    https://update.greasyfork.org/scripts/占位符
// ==/UserScript==

(function() {
    'use strict';

    // 保存原生的 preventDefault 方法
    const originalPreventDefault = Event.prototype.preventDefault;

    /**
     * 判断是否为需要放行的键盘快捷键（复制、粘贴、剪切、全选）
     * @param {Event} event 事件对象
     * @returns {boolean}
     */
    function isAllowedShortcut(event) {
        if (event.type !== 'keydown') return false;

        const ctrlOrCmd = event.ctrlKey || event.metaKey; // 支持 Mac 的 Command 键
        const key = event.key;

        // 主流组合键：Ctrl/Cmd + C (复制), V (粘贴), X (剪切), A (全选)
        if (ctrlOrCmd && (key === 'c' || key === 'v' || key === 'x' || key === 'a')) {
            return true;
        }
        // 备用组合键：Ctrl+Insert (复制), Shift+Insert (粘贴)
        if ((event.ctrlKey && key === 'Insert') || (event.shiftKey && key === 'Insert')) {
            return true;
        }
        return false;
    }

    // 重写 preventDefault，针对右键菜单和上述快捷键不做任何阻止
    Event.prototype.preventDefault = function() {
        if (this.type === 'contextmenu') {
            // 完全忽略右键菜单上的 preventDefault 调用
            return;
        }
        if (isAllowedShortcut(this)) {
            // 忽略复制/粘贴等快捷键上的 preventDefault 调用
            return;
        }
        // 其他情况正常执行原本的阻止行为
        originalPreventDefault.call(this);
    };

    // 可选：额外覆盖 oncontextmenu 属性直接赋值的情况（部分网页使用）
    // 但已经通过 preventDefault 钩子覆盖了大部分，为了更彻底，也监听 document 上 contextmenu 的事件捕获阶段，强制放行
    document.addEventListener('contextmenu', function(e) {
        // 不做任何阻止，但需要防止网页后续调用 stopPropagation 导致事件无法到达？
        // 这里只是为了保证万一 preventDefault 被绕过的后备方案。
        // 实际上由于 Event.prototype.preventDefault 已被覆盖，即使网页调用了 e.preventDefault() 也不会生效。
        // 所以下面这行并非必要，但保留无害。
    }, true); // 使用捕获阶段确保优先执行

    // 同样为 keydown 添加一个捕获阶段的空监听，防止事件流被提前中断（可选）
    document.addEventListener('keydown', function(e) {
        // 不阻止任何键位，尤其是我们关心的快捷键
        // 该监听器只是为了确保事件流中有这个类型的事件，不影响实际逻辑。
    }, true);
})();