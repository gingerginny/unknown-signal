/**
 * Label.js - 文字渲染组件
 * 支持自动换行、描边、多层阴影（霓虹发光）、加粗等
 */

import { Node } from './Node.js';

export class Label extends Node {
  /**
   * @param {Object} options
   * @param {string} options.text - 显示文字
   * @param {number} [options.fontSize=16] - 字号（逻辑像素）
   * @param {string} [options.fontFamily] - 字体
   * @param {string} [options.color='#ffffff'] - 文字颜色
   * @param {string} [options.textAlign='left'] - 对齐方式
   * @param {number} [options.lineHeight=1.4] - 行高倍数
   * @param {number} [options.maxWidth=0] - 最大宽度（0 表示不限制）
   * @param {string} [options.shadowColor] - 阴影颜色
   * @param {number} [options.shadowBlur=0] - 阴影模糊半径
   * @param {Array} [options.shadowLayers] - 多层阴影 [{ color, blur }]
   * @param {string} [options.strokeColor] - 描边颜色
   * @param {number} [options.strokeWidth=0] - 描边宽度
   * @param {boolean} [options.bold=false] - 是否加粗
   */
  constructor(options = {}) {
    super();

    this.text = options.text || '';
    this.fontSize = options.fontSize || 16;
    this.fontFamily = options.fontFamily || 'PingFang SC, Microsoft YaHei, sans-serif';
    this.color = options.color || '#ffffff';
    this.textAlign = options.textAlign || 'left';
    this.lineHeight = options.lineHeight || 1.4;
    this.maxWidth = options.maxWidth || 0;
    this.shadowColor = options.shadowColor || null;
    this.shadowBlur = options.shadowBlur || 0;
    this.shadowLayers = options.shadowLayers || null; // [{ color, blur }]
    this.strokeColor = options.strokeColor || null;
    this.strokeWidth = options.strokeWidth || 0;
    this.bold = options.bold || false;

    /** @private 缓存的换行结果 */
    this._lines = null;
    /** @private 上次计算时的文本 */
    this._cachedText = null;
    /** @private 上次计算时的最大宽度 */
    this._cachedMaxWidth = null;
    /** @private 上次计算时的字体 */
    this._cachedFont = null;
  }

  /**
   * 构建字体字符串
   * @private
   * @returns {string}
   */
  _buildFont() {
    const prefix = this.bold ? 'bold ' : '';
    return `${prefix}${this.fontSize}px ${this.fontFamily}`;
  }

  /**
   * 自动换行计算
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text - 要换行的文本
   * @param {number} maxWidth - 最大宽度（物理像素）
   * @returns {string[]} 行数组
   */
  _wrapText(ctx, text, maxWidth) {
    if (!text) return [''];

    const lines = [];
    // 先按换行符分段
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph === '') {
        lines.push('');
        continue;
      }

      let currentLine = '';

      // 逐字检查宽度
      for (let i = 0; i < paragraph.length; i++) {
        const char = paragraph[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }

      // 最后一行
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    if (!this.text && this.text !== 0) return;

    const text = String(this.text);
    const font = this._buildFont();
    const lineHeightPx = this.fontSize * this.lineHeight;

    ctx.font = font;
    ctx.textBaseline = 'top';

    // 计算换行
    let lines;
    if (this.maxWidth > 0) {
      // 使用缓存避免重复计算
      if (text !== this._cachedText || this.maxWidth !== this._cachedMaxWidth || font !== this._cachedFont) {
        this._lines = this._wrapText(ctx, text, this.maxWidth);
        this._cachedText = text;
        this._cachedMaxWidth = this.maxWidth;
        this._cachedFont = font;
      }
      lines = this._lines;
    } else {
      lines = text.split('\n');
    }

    // 计算文字对齐的 x 偏移
    let alignX = 0;
    ctx.textAlign = this.textAlign;
    if (this.textAlign === 'center') {
      alignX = this.width / 2;
    } else if (this.textAlign === 'right') {
      alignX = this.width;
    }

    // 逐行绘制
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = i * lineHeightPx;

      // 1. 描边
      if (this.strokeColor && this.strokeWidth > 0) {
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.strokeText(line, alignX, y);
      }

      // 2. 多层阴影（霓虹发光效果）
      if (this.shadowLayers && this.shadowLayers.length > 0) {
        for (const layer of this.shadowLayers) {
          ctx.shadowColor = layer.color;
          ctx.shadowBlur = layer.blur;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.fillStyle = this.color;
          ctx.fillText(line, alignX, y);
        }
        // 重置阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else if (this.shadowColor && this.shadowBlur > 0) {
        // 单层阴影
        ctx.shadowColor = this.shadowColor;
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = this.color;
        ctx.fillText(line, alignX, y);
        // 重置阴影
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // 3. 主体文字
      ctx.fillStyle = this.color;
      ctx.fillText(line, alignX, y);
    }

    // 重置 textAlign 避免影响其他组件
    ctx.textAlign = 'left';

    // 更新组件高度
    this.height = lines.length * this.fontSize * this.lineHeight;
  }

  /**
   * 获取文字宽度（逻辑像素）
   * @param {CanvasRenderingContext2D} ctx
   * @returns {number}
   */
  getTextWidth(ctx) {
    ctx.font = this._buildFont();
    const metrics = ctx.measureText(String(this.text));
    return metrics.width;
  }
}
