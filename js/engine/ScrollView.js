/**
 * ScrollView.js - 滚动容器组件
 * 支持垂直滚动、惯性动画、弹性边界、滚动条显示
 */

import { Node } from './Node.js';

export class ScrollView extends Node {
  /**
   * @param {Object} options
   * @param {number} [options.width=300] - 可视区宽度
   * @param {number} [options.height=500] - 可视区高度
   * @param {number} [options.contentHeight=0] - 内容总高度
   * @param {string} [options.direction='vertical'] - 滚动方向
   * @param {boolean} [options.showScrollbar=true] - 是否显示滚动条
   * @param {boolean} [options.bounceEnabled=true] - 是否启用弹性边界
   */
  constructor(options = {}) {
    super();

    this.width = options.width || 300;
    this.height = options.height || 500;
    this.contentHeight = options.contentHeight || 0;
    this.direction = options.direction || 'vertical';
    this.showScrollbar = options.showScrollbar !== undefined ? options.showScrollbar : true;
    this.bounceEnabled = options.bounceEnabled !== undefined ? options.bounceEnabled : true;

    /** 当前滚动偏移（逻辑像素） */
    this.scrollY = 0;

    /** @private 惯性速度 */
    this._velocity = 0;
    /** @private 是否正在拖拽 */
    this._isDragging = false;
    /** @private 上次触摸 Y */
    this._lastTouchY = 0;
    /** @private 拖拽起始时间 */
    this._lastTouchTime = 0;
    /** @private 惯性动画是否运行中 */
    this._isAnimating = false;
    /** @private 滚动条透明度（用于自动隐藏） */
    this._scrollbarAlpha = 0;
    /** @private 滚动条隐藏计时器 */
    this._scrollbarTimer = 0;
    /** @private 弹性衰减系数 */
    this._bounceFriction = 0.4;
    /** @private 惯性衰减系数 */
    this._inertiaFriction = 0.95;
    /** @private 弹性回弹速度 */
    this._bounceSpeed = 0.15;
    /** @private 触摸起始 scrollY（用于判断是否触发了滚动） */
    this._touchStartScrollY = 0;
  }

  /**
   * 获取最大滚动值
   * @returns {number}
   */
  getMaxScroll() {
    return Math.max(0, this.contentHeight - this.height);
  }

  /**
   * 重写 render() —— ScrollView 自行管理子节点的裁剪和滚动偏移渲染，
   * 不能走 Node.render() 的默认子节点遍历（否则子节点会被渲染两次：
   * 一次在 _draw 中有 clip + scrollOffset，一次在 children loop 中无 clip）
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;

    ctx.save();

    // 与 Node.render() 相同的变换逻辑
    const ax = this.anchorX * this.width;
    const ay = this.anchorY * this.height;
    ctx.translate(this.x + ax, this.y + ay);
    if (this.rotation !== 0) ctx.rotate(this.rotation);
    if (this.scaleX !== 1 || this.scaleY !== 1) ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-ax, -ay);
    ctx.globalAlpha *= this.alpha;

    // ---- ScrollView 专有渲染 ----

    // 裁剪可视区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    // 应用滚动偏移
    ctx.translate(0, -this.scrollY);

    // 只绘制可见区域内的子节点（虚拟列表优化）
    for (const child of this.children) {
      if (!child.visible) continue;

      const childTop = child.y;
      const childBottom = child.y + child.height;

      // 判断是否在可视区域（逻辑像素）
      if (childBottom >= this.scrollY && childTop <= this.scrollY + this.height) {
        child.render(ctx);
      }
    }

    ctx.restore();

    // 绘制滚动条（在裁剪区域之外）
    if (this.showScrollbar && this._scrollbarAlpha > 0 && this.contentHeight > this.height) {
      this._drawScrollbar(ctx);
    }

    // 注意：不调用 Node.render() 的子节点遍历，因为已在上方自行处理
    ctx.restore();
  }

  /**
   * _draw 不再使用（渲染逻辑已移入 render()），保留空实现以防万一
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    // 渲染逻辑已在 render() 中完成
  }

  /**
   * 绘制滚动条
   * @private
   */
  _drawScrollbar(ctx) {
    const maxScroll = this.getMaxScroll();
    if (maxScroll <= 0) return;

    const trackHeight = this.height;
    const barHeight = Math.max(30, (this.height / this.contentHeight) * trackHeight);
    const scrollRatio = Math.max(0, Math.min(1, this.scrollY / maxScroll));
    const barY = scrollRatio * (trackHeight - barHeight);

    const barWidth = 3;
    const barX = this.width - barWidth - 2;

    ctx.save();
    ctx.globalAlpha = this._scrollbarAlpha * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();

    // 圆角滚动条
    const radius = barWidth / 2;
    ctx.moveTo(barX + radius, barY);
    ctx.lineTo(barX + barWidth - radius, barY);
    ctx.arcTo(barX + barWidth, barY, barX + barWidth, barY + radius, radius);
    ctx.lineTo(barX + barWidth, barY + barHeight - radius);
    ctx.arcTo(barX + barWidth, barY + barHeight, barX + barWidth - radius, barY + barHeight, radius);
    ctx.lineTo(barX + radius, barY + barHeight);
    ctx.arcTo(barX, barY + barHeight, barX, barY + barHeight - radius, radius);
    ctx.lineTo(barX, barY + radius);
    ctx.arcTo(barX, barY, barX + radius, barY, radius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 更新（每帧调用）—— 处理惯性动画和弹性回弹
   * @param {number} dt - 帧间隔（毫秒）
   */
  update(dt) {
    const maxScroll = this.getMaxScroll();

    if (!this._isDragging) {
      // 惯性动画
      if (Math.abs(this._velocity) > 0.5) {
        this.scrollY += this._velocity;
        this._velocity *= this._inertiaFriction;
        this._isAnimating = true;
      } else {
        this._velocity = 0;
        this._isAnimating = false;
      }

      // 弹性回弹
      if (this.bounceEnabled) {
        if (this.scrollY < 0) {
          this.scrollY += (0 - this.scrollY) * this._bounceSpeed;
          if (Math.abs(this.scrollY) < 0.5) this.scrollY = 0;
          this._velocity = 0;
        } else if (this.scrollY > maxScroll) {
          this.scrollY += (maxScroll - this.scrollY) * this._bounceSpeed;
          if (Math.abs(this.scrollY - maxScroll) < 0.5) this.scrollY = maxScroll;
          this._velocity = 0;
        }
      } else {
        // 硬边界
        this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY));
      }
    }

    // 滚动条自动隐藏
    if (this._isDragging || this._isAnimating) {
      this._scrollbarAlpha = 1;
      this._scrollbarTimer = 1000; // 停止后 1 秒消失
    } else if (this._scrollbarTimer > 0) {
      this._scrollbarTimer -= dt;
      if (this._scrollbarTimer <= 0) {
        this._scrollbarTimer = 0;
      }
      // 淡出
      if (this._scrollbarTimer < 300) {
        this._scrollbarAlpha = this._scrollbarTimer / 300;
      }
    }
  }

  /**
   * 触摸开始
   * @param {number} y - 触摸 Y 坐标（逻辑像素）
   */
  onTouchStart(y) {
    this._isDragging = true;
    this._lastTouchY = y;
    this._lastTouchTime = Date.now();
    this._velocity = 0;
    this._isAnimating = false;
    this._touchStartScrollY = this.scrollY;
  }

  /**
   * 触摸移动
   * @param {number} y - 触摸 Y 坐标（逻辑像素）
   */
  onTouchMove(y) {
    if (!this._isDragging) return;

    const deltaY = this._lastTouchY - y;
    const now = Date.now();
    const dt = now - this._lastTouchTime;

    // 弹性边界阻尼
    const maxScroll = this.getMaxScroll();
    if (this.bounceEnabled && (this.scrollY < 0 || this.scrollY > maxScroll)) {
      // 超出边界时，移动量衰减
      this.scrollY += deltaY * this._bounceFriction;
    } else {
      this.scrollY += deltaY;
    }

    // 计算瞬时速度
    if (dt > 0) {
      this._velocity = deltaY / (dt / 16); // 归一化到 16ms 帧率
    }

    this._lastTouchY = y;
    this._lastTouchTime = now;
  }

  /**
   * 触摸结束
   */
  onTouchEnd() {
    this._isDragging = false;
    // 速度衰减初始化（惯性动画在 update 中处理）
  }

  /**
   * 判断是否发生了滚动（用于区分点击和滚动）
   * @returns {boolean}
   */
  didScroll() {
    return Math.abs(this.scrollY - this._touchStartScrollY) > 20;
  }

  /**
   * 滚动到指定位置
   * @param {number} y - 目标位置（逻辑像素）
   * @param {boolean} [animated=true] - 是否动画
   */
  scrollTo(y, animated = true) {
    const maxScroll = this.getMaxScroll();
    const targetY = Math.max(0, Math.min(maxScroll, y));

    if (!animated) {
      this.scrollY = targetY;
      this._velocity = 0;
      return;
    }

    // 使用速度驱动的简单动画
    const distance = targetY - this.scrollY;
    this._velocity = distance * 0.1;
    this._isAnimating = true;
  }

  /**
   * 滚动到底部
   * @param {boolean} [animated=true] - 是否动画
   */
  scrollToBottom(animated = true) {
    this.scrollTo(this.getMaxScroll(), animated);
  }

  /**
   * 检测坐标是否在滚动区域内
   * @param {number} x - 逻辑像素
   * @param {number} y - 逻辑像素
   * @returns {boolean}
   */
  containsPoint(x, y) {
    const pos = this.getWorldPosition();
    return x >= pos.x && x <= pos.x + this.width &&
           y >= pos.y && y <= pos.y + this.height;
  }
}
