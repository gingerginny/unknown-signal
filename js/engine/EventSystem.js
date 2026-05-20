/**
 * EventSystem.js - 触摸事件系统
 * 管理节点的事件监听、命中测试、事件冒泡、tap/longpress 检测
 */

/** 长按触发时间阈值（毫秒） */
const LONGPRESS_THRESHOLD = 350;
/** 长按最大移动距离（像素） */
const LONGPRESS_MAX_DISTANCE = 10;
/** tap 最大时间（毫秒） */
const TAP_MAX_DURATION = 300;
/** tap 最大移动距离（像素） */
const TAP_MAX_DISTANCE = 10;

export class EventSystem {
  constructor() {
    /** 触摸开始坐标 */
    this._startX = 0;
    this._startY = 0;

    /** 触摸开始时间戳 */
    this._startTime = 0;

    /** 长按定时器 */
    this._longpressTimer = null;

    /** 长按是否已触发 */
    this._longpressFired = false;

    /** 触摸开始时命中的节点列表（从上到下） */
    this._hitNodes = [];
  }

  /**
   * 对场景节点树进行命中测试
   * 递归遍历节点树，返回包含该坐标点的所有节点（从最上层到最下层）
   * @param {Node} root - 根节点（通常是 Scene）
   * @param {number} x - 逻辑 x 坐标
   * @param {number} y - 逻辑 y 坐标
   * @returns {Node[]} 被命中的节点列表，按渲染顺序从上到下排列
   */
  hitTest(root, x, y) {
    const result = [];
    this._hitTestRecursive(root, x, y, result);
    // 反转结果：先添加的是底层节点，反转后最上层在前
    result.reverse();
    return result;
  }

  /**
   * 递归命中测试
   * @private
   */
  _hitTestRecursive(node, x, y, result) {
    if (!node.visible || node.alpha <= 0) return;

    // 先检测子节点（按 zIndex 从高到低反序遍历）
    for (let i = node.children.length - 1; i >= 0; i--) {
      this._hitTestRecursive(node.children[i], x, y, result);
    }

    // 再检测自身（仅交互节点参与命中测试）
    if (node.interactive && node.containsPoint(x, y)) {
      result.push(node);
    }
  }

  /**
   * 处理触摸开始
   * @param {Scene} scene - 当前场景
   * @param {Object} touch - 逻辑坐标触摸点 { x, y, identifier }
   * @param {number} timeStamp - 事件时间戳
   */
  handleTouchStart(scene, touch, timeStamp) {
    this._startX = touch.x;
    this._startY = touch.y;
    this._startTime = timeStamp;
    this._longpressFired = false;

    // 命中测试
    this._hitNodes = this.hitTest(scene, touch.x, touch.y);

    // 分发 touchstart 事件
    this._dispatchEvent('touchstart', touch);

    // 启动长按检测定时器
    this._clearLongpressTimer();
    this._longpressTimer = setTimeout(() => {
      if (!this._longpressFired) {
        this._longpressFired = true;
        this._dispatchEvent('longpress', touch);
      }
    }, LONGPRESS_THRESHOLD);
  }

  /**
   * 处理触摸移动
   * @param {Scene} scene - 当前场景
   * @param {Object} touch - 逻辑坐标触摸点
   * @param {number} timeStamp - 事件时间戳
   */
  handleTouchMove(scene, touch, timeStamp) {
    // 检查是否移动超出阈值，取消长按检测
    const dx = touch.x - this._startX;
    const dy = touch.y - this._startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > LONGPRESS_MAX_DISTANCE) {
      this._clearLongpressTimer();
    }

    // 分发 touchmove 事件给初始命中的节点
    this._dispatchEvent('touchmove', touch);
  }

  /**
   * 处理触摸结束
   * @param {Scene} scene - 当前场景
   * @param {Object} touch - 逻辑坐标触摸点
   * @param {number} timeStamp - 事件时间戳
   */
  handleTouchEnd(scene, touch, timeStamp) {
    this._clearLongpressTimer();

    // 分发 touchend 事件
    this._dispatchEvent('touchend', touch);

    // 检测 tap：移动距离小、时间短、未触发长按
    if (!this._longpressFired) {
      const dx = touch.x - this._startX;
      const dy = touch.y - this._startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = timeStamp - this._startTime;

      if (dist < TAP_MAX_DISTANCE && duration < TAP_MAX_DURATION) {
        this._dispatchEvent('tap', touch);
      }
    }

    // 清理
    this._hitNodes = [];
  }

  /**
   * 向命中节点列表分发事件（支持冒泡）
   * @param {string} eventType - 事件类型
   * @param {Object} touch - 触摸信息
   * @private
   */
  _dispatchEvent(eventType, touch) {
    if (this._hitNodes.length === 0) return;

    // 创建事件对象
    const event = {
      type: eventType,
      x: touch.x,
      y: touch.y,
      identifier: touch.identifier,
      _propagationStopped: false,
      stopPropagation() {
        this._propagationStopped = true;
      },
    };

    // 从最上层节点开始分发，支持冒泡
    for (const node of this._hitNodes) {
      node.emit(eventType, event);

      if (event._propagationStopped) break;

      // 如果节点未处理，沿 parent 链冒泡
      if (!event._propagationStopped) {
        let parent = node.parent;
        while (parent && !event._propagationStopped) {
          // 仅向有该事件监听器的父节点冒泡
          if (parent._listeners && parent._listeners[eventType]) {
            parent.emit(eventType, event);
          }
          parent = parent.parent;
        }
      }

      // 如果事件已被阻止传播，不继续分发给下层命中节点
      if (event._propagationStopped) break;
    }
  }

  /**
   * 清除长按定时器
   * @private
   */
  _clearLongpressTimer() {
    if (this._longpressTimer !== null) {
      clearTimeout(this._longpressTimer);
      this._longpressTimer = null;
    }
  }
}
