/**
 * wx-polyfill.js
 * 为浏览器环境提供微信小游戏 wx API 的兼容层
 * 在 game.js（ES module）之前以普通 script 标签加载，确保 window.wx 全局可用
 */

window.wx = {

  // ===== 系统信息 =====

  getWindowInfo() {
    const MAX_W = 430;
    const SAFE_BOTTOM = 20; // 模拟 home indicator / 底部安全区，保证底部 UI 不被截断
    const vvp = window.visualViewport;
    const w = Math.min(vvp ? vvp.width : window.innerWidth, MAX_W);
    const h = vvp ? vvp.height : window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);
    return {
      windowWidth: w,
      windowHeight: h,
      pixelRatio,
      statusBarHeight: 0,
      screenWidth: w,
      screenHeight: h,  // 与 windowHeight 一致，使 safeAreaBottom = SAFE_BOTTOM
      safeArea: { left: 0, right: w, top: 0, bottom: h - SAFE_BOTTOM, width: w, height: h - SAFE_BOTTOM },
    };
  },

  getSystemInfoSync() {
    return this.getWindowInfo();
  },

  // ===== 本地存储 =====

  getStorageSync(key) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return '';
      return JSON.parse(val);
    } catch {
      return '';
    }
  },

  setStorageSync(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[wx] setStorageSync failed:', key, e);
    }
  },

  removeStorageSync(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[wx] removeStorageSync failed:', key, e);
    }
  },

  // ===== 图片加载 =====

  createImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return img;
  },

  // ===== 振动反馈 =====

  vibrateShort({ type = 'medium' } = {}) {
    const durationMap = { light: 15, medium: 30, heavy: 50 };
    if (navigator.vibrate) {
      navigator.vibrate(durationMap[type] || 30);
    }
  },

  vibrateLong() {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  },

  // ===== 分享（浏览器环境降级/noop） =====

  showShareMenu() {},
  onShareAppMessage() {},

  shareAppMessage(data) {
    if (navigator.share) {
      navigator.share({
        title: data.title || '未知信号源',
        url: window.location.href,
      }).catch(() => {});
    }
  },

  // ===== 模态对话框 =====

  showModal({ title = '', content = '', confirmText = '确定', cancelText = '取消', success } = {}) {
    const msg = [title, content].filter(Boolean).join('\n');
    const confirmed = window.confirm(msg);
    if (typeof success === 'function') {
      success({ confirm: confirmed, cancel: !confirmed });
    }
  },

};
