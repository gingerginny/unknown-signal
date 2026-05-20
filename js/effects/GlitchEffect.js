/**
 * GlitchEffect.js
 * 故障效果
 * - 随机水平偏移若干行
 * - RGB 通道分离（简化版：叠加偏移色块）
 * - 持续时间可配置
 * - 提供 play(duration) 方法触发
 */

import { RUNE_CYAN, RUNE_RED } from '../style/StyleConfig.js';

export default class GlitchEffect {
  /**
   * @param {Object} options
   * @param {number} options.width - 画布宽度
   * @param {number} options.height - 画布高度
   * @param {number} [options.sliceCount=8] - 故障切片数量
   * @param {number} [options.maxOffset=20] - 最大水平偏移（px）
   * @param {number} [options.rgbShift=3] - RGB 通道偏移量（px）
   */
  constructor(options = {}) {
    this.width = options.width || 300;
    this.height = options.height || 600;
    this.sliceCount = options.sliceCount ?? 8;
    this.maxOffset = options.maxOffset ?? 20;
    this.rgbShift = options.rgbShift ?? 3;

    /** @type {boolean} 是否正在播放 */
    this._active = false;

    /** @type {number} 剩余持续时间（ms） */
    this._remaining = 0;

    /** @type {number} 总持续时间（ms） */
    this._duration = 0;

    /** @type {Array<Object>} 当前帧的切片数据 */
    this._slices = [];

    /** @type {number} 切片刷新计时器 */
    this._refreshTimer = 0;
  }

  /**
   * 播放故障效果
   * @param {number} [duration=300] - 持续时间（ms）
   */
  play(duration = 300) {
    this._active = true;
    this._remaining = duration;
    this._duration = duration;
    this._refreshTimer = 0;
    this._generateSlices();
  }

  /** 立即停止效果 */
  stop() {
    this._active = false;
    this._remaining = 0;
    this._slices = [];
  }

  /** @returns {boolean} 是否正在播放 */
  isActive() {
    return this._active;
  }

  /**
   * 更新效果状态
   * @param {number} dt - 帧间隔时间（ms）
   */
  update(dt) {
    if (!this._active) return;

    this._remaining -= dt;
    if (this._remaining <= 0) {
      this.stop();
      return;
    }

    // 每 50ms 刷新一次切片数据，产生闪烁感
    this._refreshTimer += dt;
    if (this._refreshTimer >= 50) {
      this._refreshTimer = 0;
      this._generateSlices();
    }
  }

  /**
   * 在 Canvas 上绘制故障效果
   * 应在主内容绘制完成后调用
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
   */
  render(ctx) {
    if (!this._active || this._slices.length === 0) return;

    // 衰减强度：越接近结束越弱
    const intensity = Math.min(1, this._remaining / this._duration * 2);

    ctx.save();

    // 绘制水平切片偏移
    this._slices.forEach(slice => {
      const offsetX = slice.offset * intensity;

      // RGB 通道分离效果：偏移的半透明色块
      // 红色通道（右偏）
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 0, 0, ${0.08 * intensity})`;
      ctx.fillRect(
        offsetX + this.rgbShift * intensity,
        slice.y,
        this.width,
        slice.height
      );

      // 青色通道（左偏）
      ctx.fillStyle = `rgba(0, 255, 212, ${0.06 * intensity})`;
      ctx.fillRect(
        offsetX - this.rgbShift * intensity,
        slice.y,
        this.width,
        slice.height
      );

      // 水平偏移区域的半透明白色条
      ctx.globalCompositeOperation = 'source-over';
      if (Math.abs(offsetX) > 2) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.03 * intensity})`;
        ctx.fillRect(0, slice.y, this.width, slice.height);
      }
    });

    // 随机闪烁白线（故障感增强）
    if (Math.random() < 0.3 * intensity) {
      const lineY = Math.random() * this.height;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * intensity})`;
      ctx.fillRect(0, lineY, this.width, 1 + Math.random() * 2);
    }

    ctx.restore();
  }

  /** 生成随机切片数据 */
  _generateSlices() {
    this._slices = [];
    for (let i = 0; i < this.sliceCount; i++) {
      const y = Math.random() * this.height;
      const height = 2 + Math.random() * (this.height / this.sliceCount);
      const offset = (Math.random() - 0.5) * 2 * this.maxOffset;
      this._slices.push({ y, height, offset });
    }
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
