// ==UserScript==
// @name         解除网页某些限制（复制，右键等）
// @namespace    https://github.com/YC-CLT/TampermonkeyScripts
// @version      2.2
// @license      MIT
// @description  解除右键菜单禁用、复制快捷键拦截，支持 SPA 路由切换，针对 document.oncontextmenu / onkeydown + returnValue + alert 全面防御。
// @author       逸畅_celestial
// @include      http*://**
// @run-at       document-start
// @grant        none
// ==/UserScript==
 
(function() {
    'use strict';
 
    // ---------- 1. 锁定 returnValue（历史遗留属性，页面经常用）----------
    if (Event.prototype.hasOwnProperty('returnValue')) {
        const originalReturnValueDesc = Object.getOwnPropertyDescriptor(Event.prototype, 'returnValue');
        Object.defineProperty(Event.prototype, 'returnValue', {
            get: function() {
                return originalReturnValueDesc ? originalReturnValueDesc.get.call(this) : undefined;
            },
            set: function(value) {
                // 完全忽略设置 returnValue = false 的行为
                // 不执行任何操作，让右键和快捷键不被阻止
                return;
            },
            configurable: false,
            enumerable: true
        });
    }
 
    // ---------- 2. 劫持 document.oncontextmenu 和 document.onkeydown ----------
    // 防止页面直接赋值 (document.oncontextmenu = function...)
    function hijackDocumentEventProp(propName) {
        // 获取原型上的描述符（Document.prototype 或 HTMLDocument.prototype）
        let proto = Document.prototype;
        let descriptor = Object.getOwnPropertyDescriptor(proto, propName);
        if (!descriptor && HTMLDocument.prototype) {
            descriptor = Object.getOwnPropertyDescriptor(HTMLDocument.prototype, propName);
        }
        if (descriptor && descriptor.set) {
            const originalSetter = descriptor.set;
            // 重新定义 document 实例上的该属性（阻止后续赋值）
            Object.defineProperty(document, propName, {
                set: function(fn) {
                    // 页面试图赋值，直接丢弃（不做任何事）
                    console.debug(`[Script] Blocked setting ${propName}`);
                },
                get: function() {
                    // 返回 null，确保没有处理函数阻止默认行为
                    return null;
                },
                configurable: false
            });
        }
    }
    hijackDocumentEventProp('oncontextmenu');
    hijackDocumentEventProp('onkeydown');
 
    // ---------- 3. 覆盖 alert，过滤掉“禁止”相关的弹窗（可选）----------
    const originalAlert = window.alert;
    window.alert = function(msg) {
        if (typeof msg === 'string' && (msg.includes('禁止') || msg.includes('右键') || msg.includes('复制'))) {
            // 静默拦截，不弹窗
            return;
        }
        originalAlert(msg);
    };
 
    // ---------- 4. 原有的 preventDefault 钩子（防止 addEventListener 方式拦截）----------
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
    Event.prototype.preventDefault = patchedPreventDefault;
    Object.defineProperty(Event.prototype, 'preventDefault', {
        value: patchedPreventDefault,
        writable: false,
        configurable: false
    });
 
    // ---------- 5. 捕获层空监听（确保事件流经过，以及防止 stopPropagation）----------
    function addCaptureListeners() {
        document.removeEventListener('contextmenu', noopCapture, true);
        document.removeEventListener('keydown', noopCapture, true);
        document.addEventListener('contextmenu', noopCapture, true);
        document.addEventListener('keydown', noopCapture, true);
    }
    function noopCapture() {}
    if (document.documentElement) {
        addCaptureListeners();
    } else {
        document.addEventListener('DOMContentLoaded', addCaptureListeners);
    }
 
    // ---------- 6. SPA 路由切换后重新强化保护 ----------
    function reapplyProtection() {
        // 防止某些 SPA 框架动态移除 capture 监听器
        addCaptureListeners();
        // 确保 oncontextmenu / onkeydown 仍被劫持（虽然 defineProperty 已锁定，但保险起见再调用一次）
        hijackDocumentEventProp('oncontextmenu');
        hijackDocumentEventProp('onkeydown');
    }
 
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        setTimeout(reapplyProtection, 0);
    };
    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        setTimeout(reapplyProtection, 0);
    };
    window.addEventListener('popstate', reapplyProtection);
    window.addEventListener('hashchange', reapplyProtection);
 
    // MutationObserver 监听 URL 变化（额外保险）
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            reapplyProtection();
        }
    });
    observer.observe(document, { subtree: true, childList: true });
 
    // ---------- 7. 学习通粘贴限制解除 ----------
    (function() {
        // 直接覆盖，永久允许粘贴
        window.editorPaste = function() { return true; };
        Object.defineProperty(window, 'editorPaste', {
            value: window.editorPaste,
            writable: false,
            configurable: false
        });
        // 可选：劫持 defineProperty 防止页面重新定义
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
            if (obj === window && prop === 'editorPaste') return;
            return originalDefineProperty.apply(this, arguments);
        };
    })();
})();

