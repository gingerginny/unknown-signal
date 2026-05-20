/**
 * Graphics.js - 自由绘制组件
 * 通过命令队列实现链式调用绘制几何图形、切角卡片、波形等
 */

import { Node } from './Node.js';

export class Graphics extends Node {
  /**
   * @param {Object} options
   * @param {string} [options.fillColor='#ffffff'] - 默认填充色
   * @param {string} [options.strokeColor='#ffffff'] - 默认描边色
   * @param {number} [options.lineWidth=1] - 默认描边宽度
   */
  constructor(options = {}) {
    super();

    this.fillColor = options.fillColor || '#ffffff';
    this.strokeColor = options.strokeColor || '#ffffff';
    this.lineWidth = options.lineWidth || 1;

    /** @private 绘制命令队列 */
    this._commands = [];
  }

  // ==================== 链式绘制方法 ====================

  /**
   * 清空命令队列
   * @returns {Graphics} this
   */
  clear() {
    this._commands = [];
    return this;
  }

  /**
   * 开始新路径
   * @returns {Graphics} this
   */
  beginPath() {
    this._commands.push({ cmd: 'beginPath' });
    return this;
  }

  /**
   * 移动画笔到指定位置
   * @param {number} x
   * @param {number} y
   * @returns {Graphics} this
   */
  moveTo(x, y) {
    this._commands.push({ cmd: 'moveTo', x, y });
    return this;
  }

  /**
   * 画线到指定位置
   * @param {number} x
   * @param {number} y
   * @returns {Graphics} this
   */
  lineTo(x, y) {
    this._commands.push({ cmd: 'lineTo', x, y });
    return this;
  }

  /**
   * 绘制圆弧
   * @param {number} x - 圆心 X
   * @param {number} y - 圆心 Y
   * @param {number} r - 半径
   * @param {number} startAngle - 起始角度（弧度）
   * @param {number} endAngle - 结束角度（弧度）
   * @param {boolean} [counterclockwise=false] - 是否逆时针
   * @returns {Graphics} this
   */
  arc(x, y, r, startAngle, endAngle, counterclockwise = false) {
    this._commands.push({ cmd: 'arc', x, y, r, startAngle, endAngle, counterclockwise });
    return this;
  }

  /**
   * 绘制矩形路径
   * @param {number} x
   * @param {number} y
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @returns {Graphics} this
   */
  rect(x, y, w, h) {
    this._commands.push({ cmd: 'rect', x, y, w, h });
    return this;
  }

  /**
   * 绘制圆角矩形路径
   * @param {number} x
   * @param {number} y
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {number} radius - 圆角半径
   * @returns {Graphics} this
   */
  roundRect(x, y, w, h, radius) {
    this._commands.push({ cmd: 'roundRect', x, y, w, h, radius });
    return this;
  }

  /**
   * 绘制切角矩形（augmented-ui 风格）
   * 四个角被切掉，形成科幻风格的多边形
   * @param {number} x
   * @param {number} y
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {number} cutSize - 切角尺寸
   * @returns {Graphics} this
   */
  augmentedRect(x, y, w, h, cutSize) {
    this._commands.push({ cmd: 'augmentedRect', x, y, w, h, cutSize });
    return this;
  }

  /**
   * 填充当前路径
   * @param {string} [color] - 填充颜色（可选，不传则用默认 fillColor）
   * @returns {Graphics} this
   */
  fill(color) {
    this._commands.push({ cmd: 'fill', color: color || null });
    return this;
  }

  /**
   * 描边当前路径
   * @param {string} [color] - 描边颜色
   * @param {number} [lineWidth] - 描边宽度
   * @returns {Graphics} this
   */
  stroke(color, lineWidth) {
    this._commands.push({ cmd: 'stroke', color: color || null, lineWidth: lineWidth || null });
    return this;
  }

  /**
   * 关闭路径
   * @returns {Graphics} this
   */
  closePath() {
    this._commands.push({ cmd: 'closePath' });
    return this;
  }

  /**
   * 设置阴影
   * @param {string} color - 阴影颜色
   * @param {number} blur - 模糊半径
   * @param {number} [offsetX=0] - X 偏移
   * @param {number} [offsetY=0] - Y 偏移
   * @returns {Graphics} this
   */
  shadow(color, blur, offsetX = 0, offsetY = 0) {
    this._commands.push({ cmd: 'shadow', color, blur, offsetX, offsetY });
    return this;
  }

  /**
   * 重置阴影
   * @returns {Graphics} this
   */
  noShadow() {
    this._commands.push({ cmd: 'noShadow' });
    return this;
  }

  /**
   * 绘制实现 —— 遍历命令队列执行 canvas 操作
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    for (const c of this._commands) {
      switch (c.cmd) {
        case 'beginPath':
          ctx.beginPath();
          break;

        case 'moveTo':
          ctx.moveTo(c.x, c.y);
          break;

        case 'lineTo':
          ctx.lineTo(c.x, c.y);
          break;

        case 'arc':
          ctx.arc(c.x, c.y, c.r, c.startAngle, c.endAngle, c.counterclockwise);
          break;

        case 'rect':
          ctx.rect(c.x, c.y, c.w, c.h);
          break;

        case 'roundRect': {
          const x = c.x;
          const y = c.y;
          const w = c.w;
          const h = c.h;
          const r = c.radius;
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
          break;
        }

        case 'augmentedRect': {
          // 切角矩形：四个角各切掉 cutSize 大小的三角形
          const x = c.x;
          const y = c.y;
          const w = c.w;
          const h = c.h;
          const cut = c.cutSize;
          ctx.beginPath();
          ctx.moveTo(x + cut, y);           // 左上切角 → 右上
          ctx.lineTo(x + w - cut, y);       // 顶边
          ctx.lineTo(x + w, y + cut);       // 右上切角
          ctx.lineTo(x + w, y + h - cut);   // 右边
          ctx.lineTo(x + w - cut, y + h);   // 右下切角
          ctx.lineTo(x + cut, y + h);       // 底边
          ctx.lineTo(x, y + h - cut);       // 左下切角
          ctx.lineTo(x, y + cut);           // 左边
          ctx.closePath();
          break;
        }

        case 'fill':
          ctx.fillStyle = c.color || this.fillColor;
          ctx.fill();
          break;

        case 'stroke':
          ctx.strokeStyle = c.color || this.strokeColor;
          ctx.lineWidth = c.lineWidth || this.lineWidth;
          ctx.stroke();
          break;

        case 'closePath':
          ctx.closePath();
          break;

        case 'shadow':
          ctx.shadowColor = c.color;
          ctx.shadowBlur = c.blur;
          ctx.shadowOffsetX = c.offsetX;
          ctx.shadowOffsetY = c.offsetY;
          break;

        case 'noShadow':
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          break;
      }
    }
  }
}
