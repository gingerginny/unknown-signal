/**
 * Mask.js - 裁剪遮罩组件
 * 支持矩形、圆形、多边形三种裁剪形状，可反转遮罩
 */

import { Node } from './Node.js';

export class Mask extends Node {
  /**
   * @param {Object} options
   * @param {string} [options.shape='rect'] - 裁剪形状 'rect' | 'circle' | 'polygon'
   * @param {Array} [options.points] - polygon 模式的顶点数组 [{ x, y }]
   * @param {number} [options.radius] - circle 模式的半径
   * @param {boolean} [options.inverted=false] - 是否反转遮罩
   * @param {number} [options.width=100] - 宽度（rect 模式）
   * @param {number} [options.height=100] - 高度（rect 模式）
   */
  constructor(options = {}) {
    super();

    this.shape = options.shape || 'rect';
    this.points = options.points || [];
    this.radius = options.radius || 50;
    this.inverted = options.inverted || false;
    this.width = options.width || 100;
    this.height = options.height || 100;
  }

  /**
   * 重写 render 方法，实现裁剪遮罩逻辑
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;

    ctx.save();

    // 应用节点自身的变换（位置、缩放、旋转等）
    ctx.translate(this.x, this.y);

    if (this.rotation !== 0) {
      const anchorXPx = this.anchorX * this.width;
      const anchorYPx = this.anchorY * this.height;
      ctx.translate(anchorXPx, anchorYPx);
      ctx.rotate(this.rotation);
      ctx.translate(-anchorXPx, -anchorYPx);
    }

    if (this.scaleX !== 1 || this.scaleY !== 1) {
      const anchorXPx = this.anchorX * this.width;
      const anchorYPx = this.anchorY * this.height;
      ctx.translate(anchorXPx, anchorYPx);
      ctx.scale(this.scaleX, this.scaleY);
      ctx.translate(-anchorXPx, -anchorYPx);
    }

    if (this.alpha < 1) {
      ctx.globalAlpha *= this.alpha;
    }

    // 创建裁剪路径
    ctx.beginPath();

    if (this.inverted) {
      // 反转遮罩：先画一个大矩形覆盖全部区域，再挖出形状
      // 使用 evenodd 规则实现反转
      const bigSize = 10000;
      ctx.rect(-bigSize, -bigSize, bigSize * 2, bigSize * 2);
    }

    switch (this.shape) {
      case 'rect':
        ctx.rect(0, 0, this.width, this.height);
        break;

      case 'circle': {
        const cx = (this.width / 2);
        const cy = (this.height / 2);
        const r = this.radius;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      }

      case 'polygon': {
        if (this.points.length < 3) break;
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
          ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        break;
      }
    }

    // 应用裁剪
    if (this.inverted) {
      // 使用 evenodd 填充规则实现反转遮罩
      ctx.clip('evenodd');
    } else {
      ctx.clip();
    }

    // 渲染子节点（在裁剪区域内）
    for (const child of this.children) {
      if (child.visible) {
        child.render(ctx);
      }
    }

    ctx.restore();
  }

  /**
   * 不需要 _draw（render 已被完全重写）
   */
  _draw() {
    // 裁剪逻辑在 render() 中完成
  }
}
