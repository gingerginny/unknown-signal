/**
 * Button.js - 按钮组件
 * 支持圆角背景、边框、按下反馈、禁用状态
 */

import { Node } from './Node.js';
import { Label } from './Label.js';

export class Button extends Node {
  /**
   * @param {Object} options
   * @param {string} [options.text=''] - 按钮文字
   * @param {number} [options.fontSize=16] - 文字字号
   * @param {string} [options.fontColor='#ffffff'] - 文字颜色
   * @param {string} [options.bgColor='transparent'] - 背景颜色
   * @param {string} [options.borderColor='#00f5d4'] - 边框颜色
   * @param {number} [options.borderWidth=1] - 边框宽度
   * @param {number} [options.cornerRadius=8] - 圆角半径
   * @param {number} [options.pressedAlpha=0.7] - 按下时透明度
   * @param {boolean} [options.disabled=false] - 是否禁用
   * @param {number} [options.width=120] - 按钮宽度
   * @param {number} [options.height=44] - 按钮高度
   * @param {boolean} [options.bold=false] - 文字是否加粗
   */
  constructor(options = {}) {
    super();

    this.width = options.width || 120;
    this.height = options.height || 44;
    this.bgColor = options.bgColor || 'transparent';
    this.borderColor = options.borderColor || '#00f5d4';
    this.borderWidth = options.borderWidth !== undefined ? options.borderWidth : 1;
    this.cornerRadius = options.cornerRadius || 8;
    this.pressedAlpha = options.pressedAlpha || 0.7;
    this.disabled = options.disabled || false;

    /** @private 是否按下状态 */
    this._isPressed = false;

    // 创建文字标签作为子节点
    this.label = new Label({
      text: options.text || '',
      fontSize: options.fontSize || 16,
      color: options.fontColor || '#ffffff',
      textAlign: 'center',
      bold: options.bold || false,
    });
    this.label.width = this.width;
  }

  /**
   * 绘制圆角矩形路径
   * @private
   */
  _roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const w = this.width;
    const h = this.height;
    const r = this.cornerRadius;

    // 按下或禁用时降低透明度
    if (this._isPressed) {
      ctx.globalAlpha = this.pressedAlpha;
    }
    if (this.disabled) {
      ctx.globalAlpha = 0.4;
    }

    // 绘制背景
    if (this.bgColor && this.bgColor !== 'transparent') {
      this._roundRectPath(ctx, 0, 0, w, h, r);
      ctx.fillStyle = this.bgColor;
      ctx.fill();
    }

    // 绘制边框
    if (this.borderColor && this.borderWidth > 0) {
      this._roundRectPath(ctx, 0, 0, w, h, r);
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.borderWidth;
      ctx.stroke();
    }

    // 绘制文字（居中）
    if (this.label && this.label.text) {
      this.label.width = this.width;
      // 垂直居中：计算 label y 偏移
      const labelFontSize = this.label.fontSize;
      this.label.x = 0;
      this.label.y = (this.height - labelFontSize) / 2;

      // label 使用自己的 render 方法
      this.label.render(ctx);
    }

    // 重置透明度
    ctx.globalAlpha = 1;
  }

  /**
   * 设置按钮文字
   * @param {string} text
   */
  setText(text) {
    this.label.text = text;
  }

  /**
   * 触摸开始 —— 进入按下状态
   */
  onTouchStart() {
    if (this.disabled) return;
    this._isPressed = true;
  }

  /**
   * 触摸结束 —— 恢复状态并触发点击事件
   */
  onTouchEnd() {
    if (this.disabled) return;
    if (this._isPressed) {
      this._isPressed = false;
      this.emit('tap');
    }
  }

  /**
   * 触摸取消 —— 恢复状态但不触发事件
   */
  onTouchCancel() {
    this._isPressed = false;
  }
}
