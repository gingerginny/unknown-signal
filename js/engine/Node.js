/**
 * Node.js - 节点树基类
 * 所有 UI 元素的基类，提供变换、子节点管理、命中检测等能力
 * 坐标系：左上角为原点，x 向右，y 向下
 */

export class Node {
  constructor() {
    /** 相对父节点的 x 坐标 */
    this.x = 0;
    /** 相对父节点的 y 坐标 */
    this.y = 0;
    /** 节点宽度 */
    this.width = 0;
    /** 节点高度 */
    this.height = 0;

    /** 透明度 0~1 */
    this.alpha = 1;
    /** 是否可见 */
    this.visible = true;

    /** 水平缩放 */
    this.scaleX = 1;
    /** 垂直缩放 */
    this.scaleY = 1;
    /** 旋转角度（弧度） */
    this.rotation = 0;

    /** 锚点 X（0~1，相对宽度的比例） */
    this.anchorX = 0;
    /** 锚点 Y（0~1，相对高度的比例） */
    this.anchorY = 0;

    /** 渲染排序，值大的在上层 */
    this.zIndex = 0;

    /** 子节点列表 */
    this.children = [];
    /** 父节点引用 */
    this.parent = null;

    /** 是否可交互（接收触摸事件） */
    this.interactive = false;

    /** 事件监听器映射 { eventType: [handler, ...] } */
    this._listeners = {};
  }

  // ==================== 子节点管理 ====================

  /**
   * 添加子节点
   * @param {Node} child
   * @returns {Node} this（支持链式调用）
   */
  addChild(child) {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    // 按 zIndex 排序
    this._sortChildren();
    return this;
  }

  /**
   * 移除指定子节点
   * @param {Node} child
   * @returns {Node} this
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
    return this;
  }

  /**
   * 移除所有子节点
   * @returns {Node} this
   */
  removeAllChildren() {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
    return this;
  }

  /**
   * 从父节点中移除自身
   * @returns {Node} this
   */
  removeFromParent() {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    return this;
  }

  /**
   * 按 zIndex 排序子节点（稳定排序）
   * @private
   */
  _sortChildren() {
    this.children.sort((a, b) => a.zIndex - b.zIndex);
  }

  // ==================== 渲染 ====================

  /**
   * 渲染节点及其子节点
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;

    ctx.save();

    // 计算锚点偏移
    const ax = this.anchorX * this.width;
    const ay = this.anchorY * this.height;

    // 先移动到节点位置 + 锚点
    ctx.translate(this.x + ax, this.y + ay);

    // 应用旋转
    if (this.rotation !== 0) {
      ctx.rotate(this.rotation);
    }

    // 应用缩放
    if (this.scaleX !== 1 || this.scaleY !== 1) {
      ctx.scale(this.scaleX, this.scaleY);
    }

    // 回退锚点偏移（使绘制从 0,0 开始）
    ctx.translate(-ax, -ay);

    // 应用透明度
    ctx.globalAlpha *= this.alpha;

    // 子类实现的具体绘制
    this._draw(ctx);

    // 渲染子节点（已按 zIndex 排序）
    for (const child of this.children) {
      child.render(ctx);
    }

    ctx.restore();
  }

  /**
   * 子类重写此方法实现具体绘制逻辑
   * @param {CanvasRenderingContext2D} ctx
   * @protected
   */
  _draw(ctx) {
    // 默认不绘制任何内容
  }

  /**
   * 每帧更新（子类可重写）
   * @param {number} dt - 帧间隔毫秒数
   */
  update(dt) {
    for (const child of this.children) {
      if (typeof child.update === 'function') {
        child.update(dt);
      }
    }
  }

  // ==================== 坐标与命中检测 ====================

  /**
   * 获取节点在世界坐标中的位置
   * @returns {{ x: number, y: number }}
   */
  getWorldPosition() {
    let wx = 0;
    let wy = 0;
    let node = this;

    while (node) {
      wx += node.x;
      wy += node.y;
      // ScrollView 的子节点需要减去滚动偏移
      if (node.parent && node.parent.scrollY !== undefined) {
        wy -= node.parent.scrollY;
      }
      node = node.parent;
    }

    return { x: wx, y: wy };
  }

  /**
   * 判断世界坐标点是否在节点区域内
   * 使用简化的 AABB 检测（不考虑旋转后的精确碰撞）
   * @param {number} worldX - 世界 x 坐标
   * @param {number} worldY - 世界 y 坐标
   * @returns {boolean}
   */
  containsPoint(worldX, worldY) {
    const pos = this.getWorldPosition();

    // 考虑锚点偏移（锚点决定了节点的旋转/缩放中心）
    const ax = this.anchorX * this.width;
    const ay = this.anchorY * this.height;
    const left = pos.x - ax;
    const top = pos.y - ay;
    const right = left + this.width * this.scaleX;
    const bottom = top + this.height * this.scaleY;

    return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
  }

  // ==================== 引擎引用 ====================

  /**
   * 沿节点树向上查找 Engine 引用
   * Scene 节点的 engine 属性由 Engine.pushScene/replaceScene 设置
   * @returns {Engine|null}
   */
  getEngine() {
    let node = this;
    while (node) {
      if (node.engine) return node.engine;
      node = node.parent;
    }
    return null;
  }

  // ==================== 事件 ====================

  /**
   * 注册事件监听
   * @param {string} eventType - 事件类型
   * @param {Function} handler - 回调函数
   * @returns {Node} this
   */
  on(eventType, handler) {
    if (!this._listeners[eventType]) {
      this._listeners[eventType] = [];
    }
    this._listeners[eventType].push(handler);
    return this;
  }

  /**
   * 移除事件监听
   * @param {string} eventType - 事件类型
   * @param {Function} [handler] - 回调函数，不传则移除该类型所有监听
   * @returns {Node} this
   */
  off(eventType, handler) {
    if (!this._listeners[eventType]) return this;

    if (!handler) {
      delete this._listeners[eventType];
    } else {
      const list = this._listeners[eventType];
      const idx = list.indexOf(handler);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
    return this;
  }

  /**
   * 触发事件
   * @param {string} eventType - 事件类型
   * @param {Object} event - 事件对象
   */
  emit(eventType, event) {
    const handlers = this._listeners[eventType];
    if (!handlers) return;

    for (const handler of handlers) {
      handler.call(this, event);
    }
  }
}
