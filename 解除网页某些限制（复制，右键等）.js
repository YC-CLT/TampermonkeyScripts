// ==UserScript==
// @name         解除网页某些限制（复制，右键等）
// @namespace    https://github.com/YC-CLT/-Tampermonkey-Scripts
// @version      v1.1
// @license      MIT
// @description  解除右键菜单禁用以及 Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A 等快捷键的拦截，让你在任何网页都能自由复制、粘贴和右键。支持单页应用(SPA)路由切换。
// @author       逸畅_celestial
// @include      http*://**
// @run-at       document-start
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/占位符
// @updateURL    https://update.greasyfork.org/scripts/占位符
// ==/UserScript==

(function() {
    'use strict';

    // ----- 核心钩子：重写 preventDefault -----
    const originalPreventDefault = Event.prototype.preventDefault;

    function isAllowedShortcut(event) {
        if (event.type !== 'keydown') return false;
        const ctrlOrCmd = event.ctrlKey || event.metaKey;
        const key = event.key;
        if (ctrlOrCmd && (key === 'c' || key === 'v' || key === 'x' || key === 'a')) return true;
        if ((event.ctrlKey && key === 'Insert') || (event.shiftKey && key === 'Insert')) return true;
        return false;
    }

    function patchedPreventDefault() {
        if (this.type === 'contextmenu') return;
        if (isAllowedShortcut(this)) return;
        originalPreventDefault.call(this);
    }

    // 直接替换原型方法
    Event.prototype.preventDefault = patchedPreventDefault;

    // ----- 锁定原型方法，防止网页后续覆盖 -----
    Object.defineProperty(Event.prototype, 'preventDefault', {
        value: patchedPreventDefault,
        writable: false,   // 不可重写
        configurable: false // 不可删除或重新配置
    });

    // ----- 增加捕获层监听（强力后备）-----
    function addCaptureListeners() {
        // 移除可能存在的旧监听器（避免重复，但无大碍）
        document.removeEventListener('contextmenu', noopCapture, true);
        document.removeEventListener('keydown', noopCapture, true);
        // 添加新的捕获监听，确保事件流中总能执行（哪怕网页用了 stopPropagation）
        document.addEventListener('contextmenu', noopCapture, true);
        document.addEventListener('keydown', noopCapture, true);
    }

    function noopCapture() {
        // 完全空操作，仅用来保证捕获阶段有我们的监听器
        // 真正起作用的仍然是原型上的 preventDefault 覆盖
    }

    // 初始调用
    if (document.documentElement) {
        addCaptureListeners();
    } else {
        // 如果 document 还没准备好，等待 DOMContentLoaded
        document.addEventListener('DOMContentLoaded', addCaptureListeners);
    }

    // ----- 针对 SPA 路由切换的额外保护 -----
    // 拦截 history.pushState / replaceState，在路由变化后重新确保钩子稳固
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    function onRouteChange() {
        // 虽然 preventDefault 已经被锁定，但某些网页可能移除我们添加的捕获监听器
        // 因此重新添加一次（幂等操作，无害）
        addCaptureListeners();
        // 可选：输出日志，便于调试（默认注释）
        // console.log('[Script] Route changed, re-secured hooks.');
    }

    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        onRouteChange();
    };
    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        onRouteChange();
    };
    window.addEventListener('popstate', onRouteChange);

    // 对于使用 hash 路由的页面（如 #/xxx）
    window.addEventListener('hashchange', onRouteChange);

    // 额外：利用 MutationObserver 监听 head/title 变化，增强路由变化检测（可选）
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            onRouteChange();
        }
    });
    observer.observe(document, { subtree: true, childList: true });
})();