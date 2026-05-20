/**
 * CRTEffect.js
 * 在 Canvas 上绘制 CRT 暗角效果
 * 使用径向渐变从中心到四角，中心透明，边缘半透明黑色
 * 支持微弱的屏幕闪烁（opacity 随时间在 0.85-1.0 间波动）
 */

import { CRT_VIGNETTE_ALPHA, SCREEN_FLICKER_MIN, SCREEN_FLICKER_MAX } from '../style/StyleConfig.js';

export default class CRTEffect {
  /**
   * @param {Object} options
   * @param {number} options.width - 画布宽度
   * @param {number} options.height - 画布高度
   * @param {number} [options.vignetteAlpha=0.4] - 暗角最大透明度
   * @param {boolean} [options.flicker=true] - 是否启用闪烁
   * @param {number} [options.flickerMin=0.85] - 闪烁最低透明度
   * @param {number} [options.flickerMax=1.0] - 闪烁最高透明度
   * @param {number} [options.flickerSpeed=0.001] - 闪烁速度（越大越快）
   */
  constructor(options = {}) {
    this.width = options.width || 300;
    this.height = options.height || 600;
    this.vignetteAlpha = options.vignetteAlpha ?? CRT_VIGNETTE_ALPHA;
    this.flicker = options.flicker !== false;
    this.flickerMin = options.flickerMin ?? SCREEN_FLICKER_MIN;
    this.flickerMax = options.flickerMax ?? SCREEN_FLICKER_MAX;
    this.flickerSpeed = options.flickerSpeed ?? 0.001;

    /** @type {number} 当前全局透明度（用于闪烁） */
    this._globalAlpha = 1.0;

    /** @type {number} 累计时间 */
    this._elapsed = 0;
  }

  /**
   * 更新闪烁状态
   * @param {number} dt - 帧间隔时间（ms）
   */
  update(dt) {
    if (!this.flicker) return;

    this._elapsed += dt;

    // 基础正弦波 + 随机脉冲模拟 CRT 磷光闪烁
    const base = Math.sin(this._elapsed * this.flickerSpeed) * 0.5 + 0.5;
    const range = this.flickerMax - this.flickerMin;
    this._globalAlpha = this.flickerMin + base * range;

    // 偶尔产生快速闪烁（约 2% 概率）
    if (Math.random() < 0.02) {
      this._globalAlpha = this.flickerMin + Math.random() * range * 0.5;
    }
  }

  /**
   * 在 Canvas 上绘制 CRT 暗角
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
   */
  render(ctx) {
    ctx.save();

    if (this.flicker) {
      ctx.globalAlpha = this._globalAlpha;
    }

    const cx = this.width / 2;
    const cy = this.height / 2;
    // 椭圆半径取画布对角线的一半，确保覆盖整个画布
    const radius = Math.sqrt(cx * cx + cy * cy);

    // 暗角渐变：中心透明 → 边缘半透明黑色
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${this.vignetteAlpha * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${this.vignetteAlpha})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // 左上角高光（模拟屏幕反光）
    const highlightGradient = ctx.createRadialGradient(
      this.width * 0.2, this.height * 0.2, 0,
      this.width * 0.2, this.height * 0.2, radius * 0.5
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = highlightGradient;
    ctx.fillRect(0, 0, this.width, this.height);

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
