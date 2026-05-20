/**
 * AugmentedCard.js - 切角卡片组件
 * augmented-ui 风格的科幻切角卡片
 * 用于主页应用图标网格、模块面板等
 */

import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import {
  RUNE_CYAN, TEXT_PRIMARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
} from '../style/StyleConfig.js';

export default class AugmentedCard extends Node {
  /**
   * @param {Object} config
   * @param {number} [config.width=120] - 卡片宽度
   * @param {number} [config.height=120] - 卡片高度
   * @param {string} [config.icon=''] - 图标文字（如 ◈、⟡、⊞、ψ）
   * @param {string} [config.name=''] - 模块名称
   * @param {string} [config.desc=''] - 英文描述
   * @param {string} [config.color='#00f5d4'] - 主色调
   * @param {string} [config.bgGradientStart] - 背景渐变起始色
   * @param {number} [config.cutSize=16] - 切角尺寸
   * @param {boolean} [config.locked=false] - 是否锁定
   * @param {Function} [config.onTap] - 点击回调
   */
  constructor(config = {}) {
    super();

    this.width = config.width || 120;
    this.height = config.height || 120;
    this._icon = config.icon || '';
    this._name = config.name || '';
    this._desc = config.desc || '';
    this._color = config.color || RUNE_CYAN;
    this._bgStart = config.bgGradientStart || 'rgba(8, 12, 32, 0.85)';
    this._cutSize = config.cutSize || 16;
    this._locked = config.locked || false;
    this._onTap = config.onTap || null;

    // 角标相关
    this._showBadge = false;
    this._badgeText = '';

    // 按下状态
    this._isPressed = false;

    // 扫描线纹理偏移（动画装饰）
    this._scanOffset = Math.random() * 100;

    // 启用交互
    this.interactive = true;
    this.on('tap', (e) => {
      if (this._onTap) this._onTap(e);
    });
    this.on('touchstart', () => {
      this._isPressed = true;
    });
    this.on('touchend', () => {
      this._isPressed = false;
    });
  }

  /**
   * 设置锁定状态
   * @param {boolean} locked
   */
  setLocked(locked) {
    this._locked = locked;
  }

  /**
   * 设置角标
   * @param {boolean} show - 是否显示
   * @param {string} [text=''] - 角标文字（如证据数量）
   */
  setBadge(show, text = '') {
    this._showBadge = show;
    this._badgeText = text;
  }

  /**
   * 绘制切角矩形路径
   * @private
   */
  _clipPath(ctx, x, y, w, h, cut) {
    // 左上大切角、右下大切角，其余小切角
    const sm = Math.min(3, cut * 0.2);
    // 顶部缺口（augmented-ui edge notch）
    const notchW = 12;
    const notchH = 3;

    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w / 2 - notchW, y);
    ctx.lineTo(x + w / 2, y + notchH);
    ctx.lineTo(x + w / 2 + notchW, y);
    ctx.lineTo(x + w - sm, y);
    ctx.lineTo(x + w, y + sm);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + sm, y + h);
    ctx.lineTo(x, y + h - sm);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  }

  /**
   * 绘制卡片
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const w = this.width;
    const h = this.height;
    const cut = this._cutSize;
    const locked = this._locked;

    ctx.save();

    // 按下缩放效果
    if (this._isPressed && !locked) {
      const s = 0.96;
      ctx.translate(w * (1 - s) / 2, h * (1 - s) / 2);
      ctx.scale(s, s);
    }

    // 锁定时降低透明度
    if (locked) {
      ctx.globalAlpha *= 0.3;
    }

    // 1. 背景填充（切角路径）
    this._clipPath(ctx, 0, 0, w, h, cut);
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, locked ? 'rgba(8, 12, 32, 0.85)' : this._bgStart);
    bgGrad.addColorStop(1, 'rgba(8, 12, 32, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 2. 扫描线纹理
    ctx.save();
    this._clipPath(ctx, 0, 0, w, h, cut);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let sy = this._scanOffset % 5; sy < h; sy += 5) {
      ctx.fillRect(0, sy, w, 1);
    }
    ctx.restore();

    // 3. 边框（切角轮廓描边 + ARWES 渐变）
    this._clipPath(ctx, 0, 0, w, h, cut);
    const borderColor = locked ? 'rgba(255, 255, 255, 0.1)' : this._color;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = locked ? 0.3 : 0.5;
    ctx.stroke();
    ctx.globalAlpha = locked ? 0.3 : 1;

    // 4. 图标
    const iconSize = locked ? 28 : 36;
    const iconY = h * 0.32;
    ctx.font = `${iconSize}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (!locked) {
      // 霓虹发光效果
      ctx.shadowColor = this._color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = this._color;
      ctx.fillText(this._icon, w / 2, iconY);
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.5;
      ctx.fillText(this._icon, w / 2, iconY);
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      // 锁定图标
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText('◌', w / 2, iconY);
    }

    // 5. 名称
    const nameY = h * 0.62;
    ctx.font = `bold 13px ${FONT_PRIMARY}`;
    ctx.fillStyle = locked ? TEXT_DIM : TEXT_PRIMARY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._name, w / 2, nameY);

    // 6. 英文描述（仅解锁时显示）
    if (!locked && this._desc) {
      const descY = h * 0.77;
      ctx.font = `8px ${FONT_MONO}`;
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(this._desc, w / 2, descY);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 7. 角标（红点 / 数量）
    if (this._showBadge && !locked) {
      const badgeR = this._badgeText ? 8 : 5;
      const badgeX = w - 8;
      const badgeY = 8;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      if (this._badgeText) {
        // 带数字的角标
        ctx.fillStyle = 'rgba(155, 93, 229, 0.9)';
        ctx.fill();
        ctx.shadowColor = 'rgba(155, 93, 229, 0.5)';
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.font = `bold 9px ${FONT_MONO}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._badgeText, badgeX, badgeY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      } else {
        // 红点角标
        ctx.fillStyle = '#ff4757';
        ctx.fill();
        ctx.shadowColor = 'rgba(255, 71, 87, 0.8)';
        ctx.shadowBlur = 7;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }
}
