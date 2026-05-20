/**
 * EvidenceCard.js - 证据卡片组件
 * 继承 Node，显示已收集的单条证据信息
 * 包含：图标 + 证据名称 + 描述文字 + 切角背景 + 已查看/未查看双态 + 新收集发光动画
 */

import { Node } from '../engine/Node.js';
import { Graphics } from '../engine/Graphics.js';
import { Label } from '../engine/Label.js';
import {
  RUNE_CYAN,
  TEXT_PRIMARY, TEXT_DIM, TEXT_SECONDARY,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_MD, FONT_SIZE_LG,
  SPACING_SM, SPACING_MD, SPACING_LG,
} from '../style/StyleConfig.js';

/** 未查看详情（isNew）→ 亮色；已查看 → 暗淡 */
const COLOR_UNVIEWED = RUNE_CYAN;
const COLOR_VIEWED   = 'rgba(0, 245, 212, 0.35)';

/** 切角尺寸 */
const CUT_SIZE = 8;

export default class EvidenceCard extends Node {
  /**
   * @param {Object} config
   * @param {string} config.id - 证据 ID
   * @param {string} config.name - 证据名称
   * @param {string} [config.desc=''] - 证据描述
   * @param {boolean} [config.isNew=false] - true=未查看详情（亮色），false=已查看（暗淡）
   * @param {number} [config.width=300] - 卡片宽度
   * @param {Function} [config.onTap] - 点击回调
   */
  constructor(config = {}) {
    super();

    this._id = config.id || '';
    this._name = config.name || '';
    this._desc = config.desc || '';
    this._isNew = config.isNew || false;
    this.width = config.width || 300;
    this.height = 0; // 动态计算
    this._onTap = config.onTap || null;

    this._color = this._isNew ? COLOR_UNVIEWED : COLOR_VIEWED;

    // 交互
    this.interactive = true;
    this._isPressed = false;
    this.on('tap', () => {
      if (this._onTap) this._onTap({ id: this._id, name: this._name });
    });
    this.on('touchstart', () => { this._isPressed = true; });
    this.on('touchend', () => { this._isPressed = false; });

    // 发光动画计时器
    this._glowTimer = 0;
    this._glowAlpha = 0;

    // 文字换行缓存（避免每帧 measureText）
    this._cachedLines = null;
    this._cachedCardH = 0;
    this._cachedWidth = 0;
    this._cachedDesc = '';
  }

  /**
   * 每帧更新：驱动新证据发光动画
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    if (this._isNew) {
      this._glowTimer += dt;
      // 2 秒周期的呼吸发光
      this._glowAlpha = 0.15 + 0.15 * Math.sin(this._glowTimer / 1000 * Math.PI);
    }
  }

  /**
   * 绘制切角矩形路径
   * @private
   */
  _clipPath(ctx, x, y, w, h, cut) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const w = this.width;
    const padding = SPACING_MD;
    const iconSize = 14;
    const nameFont = FONT_SIZE_LG;
    const descFont = FONT_SIZE_MD;
    const iconAreaW = 24;
    const contentX = padding + iconAreaW + SPACING_SM;
    const contentMaxW = w - contentX - padding;
    const color = this._color;

    // 计算描述文字行数（缓存，避免每帧 measureText）
    if (this._cachedLines === null || this._cachedWidth !== w || this._cachedDesc !== this._desc) {
      ctx.font = `${descFont}px ${FONT_PRIMARY}`;
      this._cachedLines = this._wrapText(ctx, this._desc, contentMaxW);
      const lineH = descFont * 1.6;
      const nameH = nameFont * 1.4;
      this._cachedCardH = padding + nameH + SPACING_SM + this._cachedLines.length * lineH + padding;
      this._cachedWidth = w;
      this._cachedDesc = this._desc;
    }
    const descLines = this._cachedLines;
    const lineH = descFont * 1.6;
    const nameH = nameFont * 1.4;
    const cardH = this._cachedCardH;
    this.height = cardH;

    ctx.save();

    // 按下缩放效果
    if (this._isPressed) {
      const s = 0.97;
      ctx.translate(w * (1 - s) / 2, cardH * (1 - s) / 2);
      ctx.scale(s, s);
    }

    const cut = CUT_SIZE;

    // 新证据发光效果（阴影）
    if (this._isNew) {
      ctx.save();
      ctx.shadowColor = `rgba(0, 245, 212, ${this._glowAlpha})`;
      ctx.shadowBlur = 16;
      this._clipPath(ctx, 0, 0, w, cardH, cut);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.01)';
      ctx.fill();
      ctx.restore();
    }

    // 1. 切角背景
    this._clipPath(ctx, 0, 0, w, cardH, cut);
    const bgGrad = ctx.createLinearGradient(0, 0, w, cardH);
    bgGrad.addColorStop(0, 'rgba(10, 20, 22, 0.92)');
    bgGrad.addColorStop(1, 'rgba(6, 14, 16, 0.96)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 2. 扫描线纹理（单次渐变遮罩替代逐行 loop）
    ctx.save();
    this._clipPath(ctx, 0, 0, w, cardH, cut);
    ctx.clip();
    const scanGrad = ctx.createLinearGradient(0, 0, 0, cardH);
    scanGrad.addColorStop(0,   'rgba(255,255,255,0.015)');
    scanGrad.addColorStop(0.5, 'rgba(255,255,255,0.005)');
    scanGrad.addColorStop(1,   'rgba(255,255,255,0.015)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, 0, w, cardH);
    ctx.restore();

    // 3. 边框
    this._clipPath(ctx, 0, 0, w, cardH, cut);
    const borderAlpha = this._isNew ? 0.35 : 0.12;
    ctx.strokeStyle = `rgba(0, 245, 212, ${borderAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. 底部发光线
    ctx.save();
    const lineGrad = ctx.createLinearGradient(w * 0.1, 0, w * 0.9, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, `rgba(0, 245, 212, 0.2)`);
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, cardH - 1);
    ctx.lineTo(w * 0.9, cardH - 1);
    ctx.stroke();
    ctx.restore();

    // 5. 图标 ◈
    const iconX = padding + iconAreaW / 2;
    const iconY = padding + nameH / 2;
    ctx.font = `${iconSize}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('◈', iconX, iconY); // ◈

    // 6. 证据名称
    ctx.font = `bold ${nameFont}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.fillText(this._name, contentX, padding);

    // 「点击检索 >」提示（右侧）
    const hintText = '\u70B9\u51FB\u68C0\u7D22 \u203A'; // 点击检索 ›
    ctx.font = `${10}px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0, 245, 212, 0.4)';
    ctx.fillText(hintText, w - padding, padding + (nameFont - 10) / 2);

    // 7. 描述文字
    ctx.font = `${descFont}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXT_DIM;
    const descStartY = padding + nameH + SPACING_SM;
    for (let i = 0; i < descLines.length; i++) {
      ctx.fillText(descLines[i], contentX, descStartY + i * lineH);
    }

    // 重置
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /**
   * 文字换行
   * @private
   */
  _wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    const lines = [];
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      if (para === '') { lines.push(''); continue; }
      let currentLine = '';
      for (let i = 0; i < para.length; i++) {
        const testLine = currentLine + para[i];
        if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = para[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [''];
  }

  /**
   * 设置新收集状态
   * @param {boolean} isNew
   */
  setNew(isNew) {
    this._isNew = isNew;
    this._color = isNew ? COLOR_UNVIEWED : COLOR_VIEWED;
    if (!isNew) {
      this._glowTimer = 0;
      this._glowAlpha = 0;
    }
  }
}
