/**
 * ScanlineEffect.js
 * 在 Canvas 上绘制扫描线覆盖效果（CRT 风格横条纹）
 * 每隔 2-4px 绘制 1px 高的半透明黑色线条
 * 支持缓慢向下滚动动画
 */

import { SCANLINE_ALPHA, SCANLINE_SPACING } from '../style/StyleConfig.js';

export default class ScanlineEffect {
  /**
   * @param {Object} options
   * @param {number} options.width - 画布宽度
   * @param {number} options.height - 画布高度
   * @param {number} [options.lineAlpha=0.06] - 扫描线透明度
   * @param {number} [options.spacing=4] - 扫描线间距（px）
   * @param {number} [options.scrollSpeed=0.3] - 滚动速度（px/帧）
   * @param {boolean} [options.animated=true] - 是否启用滚动动画
   */
  constructor(options = {}) {
    this.width = options.width || 300;
    this.height = options.height || 600;
    this.lineAlpha = options.lineAlpha ?? SCANLINE_ALPHA;
    this.spacing = options.spacing ?? SCANLINE_SPACING;
    this.scrollSpeed = options.scrollSpeed ?? 0.3;
    this.animated = options.animated !== false;

    /** @type {number} 当前滚动偏移量 */
    this._offset = 0;
  }

  /**
   * 更新滚动偏移
   * @param {number} dt - 帧间隔时间（ms）
   */
  update(dt) {
    if (!this.animated) return;
    this._offset += this.scrollSpeed * (dt / 16.67); // 归一化到 60fps
    if (this._offset >= this.spacing) {
      this._offset -= this.spacing;
    }
  }

  /**
   * 在 Canvas 上绘制扫描线
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
   */
  render(ctx) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${this.lineAlpha})`;

    const startY = this.animated ? -this.spacing + this._offset : 0;

    for (let y = startY; y < this.height; y += this.spacing) {
      // 每隔 spacing px 绘制 1px 高的半透明黑色线条
      ctx.fillRect(0, y, this.width, 1);
    }

    ctx.restore();
  }

  /**
   * 更新画布尺寸
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
}
