/**
 * EditBox.js - 输入框组件
 * 使用微信小游戏原生键盘（wx.showKeyboard）实现文字输入
 */

import { Node } from './Node.js';

export class EditBox extends Node {
  /**
   * @param {Object} options
   * @param {string} [options.text=''] - 当前输入文字
   * @param {string} [options.placeholder=''] - 占位文字
   * @param {string} [options.placeholderColor='#666666'] - 占位文字颜色
   * @param {number} [options.maxLength=140] - 最大长度
   * @param {number} [options.fontSize=14] - 字号
   * @param {string} [options.color='#ffffff'] - 文字颜色
   * @param {string} [options.bgColor='#1a1e3a'] - 背景色
   * @param {string} [options.borderColor='#333366'] - 边框色
   * @param {number} [options.borderWidth=1] - 边框宽度
   * @param {number} [options.cornerRadius=6] - 圆角
   * @param {number} [options.paddingX=10] - 水平内边距
   * @param {number} [options.width=200] - 输入框宽度
   * @param {number} [options.height=36] - 输入框高度
   * @param {string} [options.fontFamily] - 字体
   */
  constructor(options = {}) {
    super();

    this.text = options.text || '';
    this.placeholder = options.placeholder || '';
    this.placeholderColor = options.placeholderColor || '#666666';
    this.maxLength = options.maxLength || 140;
    this.fontSize = options.fontSize || 14;
    this.color = options.color || '#ffffff';
    this.bgColor = options.bgColor || '#1a1e3a';
    this.borderColor = options.borderColor || '#333366';
    this.borderWidth = options.borderWidth !== undefined ? options.borderWidth : 1;
    this.cornerRadius = options.cornerRadius || 6;
    this.paddingX = options.paddingX || 10;
    this.width = options.width || 200;
    this.height = options.height || 36;
    this.fontFamily = options.fontFamily || 'PingFang SC, Microsoft YaHei, sans-serif';

    /** @private 是否聚焦 */
    this._isFocused = false;
    /** @private 光标是否可见（闪烁用） */
    this._cursorVisible = false;
    /** @private 光标闪烁计时器 */
    this._cursorTimer = 0;
    /** @private 光标闪烁间隔（毫秒） */
    this._cursorBlinkInterval = 500;
    /** @private 原生输入框实例（wx.createInput 返回） */
    this._nativeInput = null;
    /** @private 键盘输入回调引用（用于解绑） */
    this._onInputCallback = null;
    /** @private 键盘确认回调引用 */
    this._onConfirmCallback = null;
    /** @private 键盘收起回调引用 */
    this._onKeyboardCompleteCallback = null;
    /** @private 聚焦时的边框颜色 */
    this.focusBorderColor = options.focusBorderColor || '#00f5d4';
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
    const px = this.paddingX;

    // 1. 绘制背景
    if (this.bgColor) {
      this._roundRectPath(ctx, 0, 0, w, h, r);
      ctx.fillStyle = this.bgColor;
      ctx.fill();
    }

    // 2. 绘制边框
    if (this.borderColor && this.borderWidth > 0) {
      this._roundRectPath(ctx, 0, 0, w, h, r);
      ctx.strokeStyle = this._isFocused ? this.focusBorderColor : this.borderColor;
      ctx.lineWidth = this.borderWidth;
      ctx.stroke();
    }

    // 3. 设置字体
    const fontStr = `${this.fontSize}px ${this.fontFamily}`;
    ctx.font = fontStr;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const textY = h / 2;
    const textX = px;
    const maxTextWidth = w - px * 2;

    if (this.text) {
      // 绘制输入文字
      ctx.fillStyle = this.color;

      // 裁剪文字不超出输入框
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, 0, maxTextWidth, h);
      ctx.clip();
      ctx.fillText(this.text, textX, textY);
      ctx.restore();

      // 4. 聚焦时绘制光标
      if (this._isFocused && this._cursorVisible) {
        const textWidth = ctx.measureText(this.text).width;
        const cursorX = textX + Math.min(textWidth, maxTextWidth);
        ctx.fillStyle = this.color;
        ctx.fillRect(cursorX, h * 0.2, 1.5, h * 0.6);
      }
    } else {
      // 绘制占位文字
      ctx.fillStyle = this.placeholderColor;
      ctx.fillText(this.placeholder, textX, textY);

      // 聚焦时绘制光标
      if (this._isFocused && this._cursorVisible) {
        ctx.fillStyle = this.color;
        ctx.fillRect(textX, h * 0.2, 1.5, h * 0.6);
      }
    }
  }

  /**
   * 更新（处理光标闪烁）
   * @param {number} dt - 帧间隔（毫秒）
   */
  update(dt) {
    if (this._isFocused) {
      this._cursorTimer += dt;
      if (this._cursorTimer >= this._cursorBlinkInterval) {
        this._cursorTimer -= this._cursorBlinkInterval;
        this._cursorVisible = !this._cursorVisible;
      }
    }
  }

  /**
   * 点击输入框 —— 弹出键盘
   */
  onTap() {
    if (this._isFocused) return;
    this.focus();
  }

  /**
   * 聚焦并弹出键盘
   * 优先用 wx.createInput（≥2.31.1）将原生输入框叠加在 Canvas EditBox 上实现实时显示；
   * 不支持时降级到 wx.showKeyboard。
   */
  focus() {
    if (this._isFocused) return;
    this._isFocused = true;
    this._cursorVisible = true;
    this._cursorTimer = 0;

    this._onInputCallback = (res) => {
      this.text = res.value;
      this.emit('input', { value: this.text });
    };

    this._onConfirmCallback = (res) => {
      this.text = res.value;
      this.blur();
      this.emit('confirm', { value: this.text });
    };

    this._onKeyboardCompleteCallback = () => {
      if (this._isFocused) this.blur();
    };

    // 浏览器方案：透明 HTML input 覆盖在 Canvas 对应位置，Canvas 负责视觉渲染
    const worldPos = this.getWorldPosition();
    const gameCanvas = window._gameCanvas || document.querySelector('canvas');
    const rect = gameCanvas ? gameCanvas.getBoundingClientRect() : { left: 0, top: 0 };

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.text;
    input.maxLength = this.maxLength;
    input.style.cssText = `
      position: fixed;
      left: ${rect.left + worldPos.x}px;
      top: ${rect.top + worldPos.y}px;
      width: ${this.width}px;
      height: ${this.height}px;
      opacity: 0;
      z-index: 9999;
      border: none;
      outline: none;
      background: transparent;
      font-size: ${this.fontSize}px;
      padding: 0 ${this.paddingX}px;
    `;

    input.addEventListener('input', (e) => {
      this._onInputCallback({ value: e.target.value });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._onConfirmCallback({ value: input.value });
      }
    });

    input.addEventListener('blur', () => {
      this._onKeyboardCompleteCallback();
    });

    document.body.appendChild(input);
    this._nativeInput = input;
    // 延迟 focus 确保 DOM 已挂载
    setTimeout(() => input.focus(), 50);
  }

  /**
   * 从父节点移除时自动失焦，防止原生输入框残留
   */
  removeFromParent() {
    if (this._isFocused) this.blur();
    super.removeFromParent();
  }

  /**
   * 失焦并销毁原生输入框 / 隐藏键盘
   */
  blur() {
    if (!this._isFocused) return;
    this._isFocused = false;
    this._cursorVisible = false;

    if (this._nativeInput) {
      // 移除 HTML input 覆盖层
      if (this._nativeInput.parentNode) {
        this._nativeInput.parentNode.removeChild(this._nativeInput);
      }
      this._nativeInput = null;
    }

    this._onInputCallback = null;
    this._onConfirmCallback = null;
    this._onKeyboardCompleteCallback = null;

    this.emit('blur', { value: this.text });
  }

  /**
   * 设置输入文字
   * @param {string} text
   */
  setText(text) {
    this.text = text;
  }

  /**
   * 清空输入
   */
  clear() {
    this.text = '';
    this.emit('input', { value: '' });
  }
}
