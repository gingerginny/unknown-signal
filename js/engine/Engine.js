/**
 * Engine.js - 主循环引擎
 * 管理主 Canvas、场景栈、主循环和全局触摸事件分发
 */

import { Tween } from './Tween.js';

export class Engine {
  /**
   * @param {Canvas} canvas - 微信小游戏主 canvas
   * @param {CanvasRenderingContext2D} ctx - 2D 渲染上下文
   * @param {Object} options
   * @param {number} options.width - 逻辑宽度
   * @param {number} options.height - 逻辑高度
   * @param {number} options.pixelRatio - 设备像素比
   */
  constructor(canvas, ctx, { width, height, pixelRatio }) {
    this._canvas = canvas;
    this._ctx = ctx;
    this._width = width;
    this._height = height;
    this._pixelRatio = pixelRatio;

    /** 场景栈，栈顶为当前活跃场景 */
    this._sceneStack = [];

    /** 主循环是否运行中 */
    this._running = false;

    /** 上一帧时间戳（毫秒） */
    this._lastTime = 0;

    /** requestAnimationFrame 返回的 ID */
    this._rafId = null;

    // 兼容不同基础库版本的 requestAnimationFrame / cancelAnimationFrame
    if (typeof canvas.requestAnimationFrame === 'function') {
      this._raf = (cb) => canvas.requestAnimationFrame(cb);
      this._caf = (id) => canvas.cancelAnimationFrame(id);
    } else {
      this._raf = (cb) => requestAnimationFrame(cb);
      this._caf = (id) => cancelAnimationFrame(id);
    }

    // 绑定主循环方法，避免每帧创建新函数
    this._loop = this._loop.bind(this);

    // 注册全局触摸事件
    this._bindTouchEvents();
  }

  // ==================== 屏幕信息 ====================

  /** 获取逻辑宽度 */
  getWidth() {
    return this._width;
  }

  /** 获取逻辑高度 */
  getHeight() {
    return this._height;
  }

  /** 获取设备像素比 */
  getDPR() {
    return this._pixelRatio;
  }

  /** 获取 Canvas 实例 */
  getCanvas() {
    return this._canvas;
  }

  /** 获取 2D 上下文 */
  getContext() {
    return this._ctx;
  }

  // ==================== 主循环控制 ====================

  /** 启动主循环 */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = Date.now();
    this._rafId = this._raf(this._loop);
  }

  /** 停止主循环 */
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      this._caf(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * 主循环
   * @private
   */
  _loop() {
    if (!this._running) return;

    const now = Date.now();
    const dt = now - this._lastTime;
    this._lastTime = now;

    // 更新全局 Tween 动画
    Tween.updateAll(dt);

    // 获取当前场景
    const scene = this._currentScene();

    if (scene) {
      // 调用场景更新
      if (typeof scene.update === 'function') {
        scene.update(dt);
      }

      // 场景可实现 needsRedraw() 返回 false 来跳过本帧渲染（脏标记优化）
      const shouldRender = typeof scene.needsRedraw !== 'function' || scene.needsRedraw();
      if (shouldRender) {
        // 清空画布
        const ctx = this._ctx;
        ctx.clearRect(0, 0, this._width * this._pixelRatio, this._height * this._pixelRatio);

        // 应用 DPR 缩放后渲染
        ctx.save();
        ctx.scale(this._pixelRatio, this._pixelRatio);
        scene.render(ctx);
        ctx.restore();
      }
    }

    // 请求下一帧
    this._rafId = this._raf(this._loop);
  }

  // ==================== 场景管理 ====================

  /**
   * 获取当前活跃场景（栈顶）
   * @private
   * @returns {Scene|null}
   */
  _currentScene() {
    const stack = this._sceneStack;
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  /**
   * 压入新场景（当前场景暂停）
   * @param {Scene} scene
   */
  pushScene(scene) {
    const current = this._currentScene();
    if (current && typeof current.onPause === 'function') {
      current.onPause();
    }

    scene.engine = this;
    this._sceneStack.push(scene);

    if (typeof scene.onEnter === 'function') {
      scene.onEnter();
    }
  }

  /**
   * 弹出栈顶场景（恢复下层场景）
   * @returns {Scene|null} 被弹出的场景
   */
  popScene() {
    const popped = this._sceneStack.pop();
    if (popped) {
      if (typeof popped.onExit === 'function') {
        popped.onExit();
      }
      popped.engine = null;
    }

    const current = this._currentScene();
    if (current && typeof current.onResume === 'function') {
      current.onResume();
    }

    return popped || null;
  }

  /**
   * 替换栈顶场景
   * @param {Scene} scene
   */
  replaceScene(scene) {
    const old = this._sceneStack.pop();
    if (old) {
      if (typeof old.onExit === 'function') {
        old.onExit();
      }
      old.engine = null;
    }

    scene.engine = this;
    this._sceneStack.push(scene);

    if (typeof scene.onEnter === 'function') {
      scene.onEnter();
    }
  }

  // ==================== 触摸事件 ====================

  /**
   * 注册全局触摸事件监听
   * @private
   */
  _bindTouchEvents() {
    const canvas = this._canvas;

    // clientX/clientY 是 CSS 逻辑像素，canvas 全屏时与逻辑坐标系一致
    const getOffset = () => canvas.getBoundingClientRect();

    const convertTouch = (rawTouch) => {
      const rect = getOffset();
      const x = rawTouch.clientX - rect.left;
      const y = rawTouch.clientY - rect.top;
      return { identifier: rawTouch.identifier, x, y, rawX: x, rawY: y };
    };

    const convertEvent = (e) => ({
      touches: Array.from(e.touches).map(convertTouch),
      changedTouches: Array.from(e.changedTouches).map(convertTouch),
      timeStamp: e.timeStamp,
    });

    // 触摸事件
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const scene = this._currentScene();
      if (scene && typeof scene.onTouchStart === 'function') {
        scene.onTouchStart(convertEvent(e));
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const scene = this._currentScene();
      if (scene && typeof scene.onTouchMove === 'function') {
        scene.onTouchMove(convertEvent(e));
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const scene = this._currentScene();
      if (scene && typeof scene.onTouchEnd === 'function') {
        scene.onTouchEnd(convertEvent(e));
      }
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
      const scene = this._currentScene();
      if (scene && typeof scene.onTouchEnd === 'function') {
        scene.onTouchEnd(convertEvent(e));
      }
    });

    // 鼠标事件兜底（桌面浏览器调试用）
    let mouseDown = false;
    const mouseToTouch = (e) => ({
      identifier: 0,
      clientX: e.clientX,
      clientY: e.clientY,
    });

    canvas.addEventListener('mousedown', (e) => {
      mouseDown = true;
      const scene = this._currentScene();
      const t = mouseToTouch(e);
      if (scene && typeof scene.onTouchStart === 'function') {
        scene.onTouchStart({ touches: [convertTouch(t)], changedTouches: [convertTouch(t)], timeStamp: e.timeStamp });
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!mouseDown) return;
      const scene = this._currentScene();
      const t = mouseToTouch(e);
      if (scene && typeof scene.onTouchMove === 'function') {
        scene.onTouchMove({ touches: [convertTouch(t)], changedTouches: [convertTouch(t)], timeStamp: e.timeStamp });
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      mouseDown = false;
      const scene = this._currentScene();
      const t = mouseToTouch(e);
      if (scene && typeof scene.onTouchEnd === 'function') {
        scene.onTouchEnd({ touches: [], changedTouches: [convertTouch(t)], timeStamp: e.timeStamp });
      }
    });
  }
}
