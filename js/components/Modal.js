/**
 * Modal.js - 模态对话框组件
 * 继承 Node，提供全屏遮罩 + 居中内容区域 + 标题/内容/按钮组
 * 支持显示/隐藏动画、点击遮罩关闭
 * 通用组件，可用于隐私提示、重置确认等
 */

import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Button } from '../engine/Button.js';
import { Graphics } from '../engine/Graphics.js';
import { Tween } from '../engine/Tween.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_PURPLE, TEXT_PRIMARY, TEXT_SECONDARY,
  FONT_PRIMARY, FONT_MONO, SPACING_MD, SPACING_LG, SPACING_XL,
  FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG, FONT_SIZE_XL,
  ANIM_NORMAL, RADIUS_MD,
} from '../style/StyleConfig.js';

export class Modal extends Node {
  /**
   * @param {Object} options
   * @param {number} options.screenWidth - 屏幕逻辑宽度
   * @param {number} options.screenHeight - 屏幕逻辑高度
   * @param {string} [options.title=''] - 标题文字
   * @param {string} [options.content=''] - 内容文字
   * @param {string} [options.icon=''] - 图标 emoji（显示在标题上方的圆圈中）
   * @param {Array}  [options.buttons=[]] - 按钮配置 [{ text, type: 'primary'|'secondary', onTap }]
   * @param {boolean} [options.closeOnOverlay=false] - 点击遮罩是否关闭
   * @param {string} [options.accentColor] - 主题色（默认紫色）
   */
  constructor(options = {}) {
    super();

    this._screenWidth = options.screenWidth || 375;
    this._screenHeight = options.screenHeight || 667;
    this.width = this._screenWidth;
    this.height = this._screenHeight;

    this._titleText = options.title || '';
    this._contentText = options.content || '';
    this._icon = options.icon || '';
    this._buttonConfigs = options.buttons || [];
    this._closeOnOverlay = options.closeOnOverlay !== undefined ? options.closeOnOverlay : false;
    this._accentColor = options.accentColor || RUNE_PURPLE;

    // 对话框内容区域尺寸
    this._cardWidth = Math.min(this._screenWidth - 60, 300);
    this._cardHeight = 0; // 动态计算

    // 动画状态
    this._overlayAlpha = 0;
    this._cardScale = 0.8;
    this._cardAlpha = 0;
    this._isShowing = false;
    this._isHiding = false;

    // 可交互
    this.interactive = true;
    this.visible = false;

    // 内部节点
    this._overlay = null;
    this._cardContainer = null;
    this._buttons = [];

    this._buildUI();
  }

  /**
   * 构建 UI 结构
   * @private
   */
  _buildUI() {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const cw = this._cardWidth;

    // 计算内容高度
    let cardContentHeight = SPACING_XL; // 顶部内边距

    // 图标区域
    if (this._icon) {
      cardContentHeight += 48 + SPACING_LG; // 图标圆圈 + 间距
    }

    // 标题
    if (this._titleText) {
      cardContentHeight += FONT_SIZE_MD + SPACING_LG;
    }

    // 内容（估算行数）
    if (this._contentText) {
      const charsPerLine = Math.floor((cw - SPACING_XL * 2) / FONT_SIZE_MD);
      const lines = Math.ceil(this._contentText.length / charsPerLine);
      cardContentHeight += lines * FONT_SIZE_MD * 1.8 + SPACING_XL;
    }

    // 按钮区域
    if (this._buttonConfigs.length > 0) {
      cardContentHeight += 38 + SPACING_XL;
    }

    // 底部内边距
    cardContentHeight += SPACING_XL;

    this._cardHeight = cardContentHeight;

    // 卡片左上角坐标
    this._cardX = (sw - cw) / 2;
    this._cardY = (sh - this._cardHeight) / 2;
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    if (!this.visible) return;

    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const cw = this._cardWidth;
    const ch = this._cardHeight;
    const cx = this._cardX;
    const cy = this._cardY;
    const accent = this._accentColor;

    // ====== 遮罩层 ======
    ctx.save();
    ctx.globalAlpha = this._overlayAlpha * 0.92;
    ctx.fillStyle = BG_DARK;
    ctx.fillRect(0, 0, sw, sh);
    ctx.restore();

    // ====== 卡片 ======
    ctx.save();

    // 卡片变换（缩放 + 透明度）
    const cardCenterX = (cx + cw / 2);
    const cardCenterY = (cy + ch / 2);
    ctx.translate(cardCenterX, cardCenterY);
    ctx.scale(this._cardScale, this._cardScale);
    ctx.translate(-cardCenterX, -cardCenterY);
    ctx.globalAlpha = this._cardAlpha;

    // 卡片背景（切角矩形）
    const cutSize = 16;
    const x = cx;
    const y = cy;
    const w = cw;
    const h = ch;

    ctx.beginPath();
    ctx.moveTo(x + cutSize, y);
    ctx.lineTo(x + w - cutSize, y);
    ctx.lineTo(x + w, y + cutSize);
    ctx.lineTo(x + w, y + h - cutSize);
    ctx.lineTo(x + w - cutSize, y + h);
    ctx.lineTo(x + cutSize, y + h);
    ctx.lineTo(x, y + h - cutSize);
    ctx.lineTo(x, y + cutSize);
    ctx.closePath();

    ctx.fillStyle = 'rgba(12, 18, 48, 0.95)';
    ctx.fill();

    // 卡片边框
    ctx.strokeStyle = `rgba(155, 93, 229, 0.25)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // HUD 角线装饰（左上）
    const cornerLen = 20;
    const cornerOffset = 4;
    ctx.beginPath();
    ctx.moveTo(x + cornerOffset, y + cornerOffset + cornerLen);
    ctx.lineTo(x + cornerOffset, y + cornerOffset);
    ctx.lineTo(x + cornerOffset + cornerLen, y + cornerOffset);
    ctx.strokeStyle = `rgba(155, 93, 229, 0.5)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // HUD 角线装饰（右下）
    ctx.beginPath();
    ctx.moveTo(x + w - cornerOffset - cornerLen, y + h - cornerOffset);
    ctx.lineTo(x + w - cornerOffset, y + h - cornerOffset);
    ctx.lineTo(x + w - cornerOffset, y + h - cornerOffset - cornerLen);
    ctx.stroke();

    // ====== 内容绘制 ======
    let curY = cy + SPACING_XL;

    // 图标
    if (this._icon) {
      const iconR = 24;
      const iconCX = (cx + cw / 2);
      const iconCY = curY + iconR;

      // 圆圈背景
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(155, 93, 229, 0.08)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(155, 93, 229, 0.35)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 发光效果
      ctx.shadowColor = `rgba(155, 93, 229, 0.15)`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Emoji 图标
      ctx.font = `${22}px ${FONT_PRIMARY}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._icon, iconCX, iconCY);

      curY += iconR * 2 + SPACING_LG;
    }

    // 标题
    if (this._titleText) {
      ctx.font = `${FONT_SIZE_MD}px ${FONT_MONO}`;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.letterSpacing = `${2}px`;
      ctx.fillText(this._titleText, (cx + cw / 2), curY);
      curY += FONT_SIZE_MD + SPACING_LG;
    }

    // 内容
    if (this._contentText) {
      ctx.font = `${FONT_SIZE_MD}px ${FONT_PRIMARY}`;
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // 手动换行
      const maxWidth = (cw - SPACING_XL * 2);
      const lineHeight = FONT_SIZE_MD * 1.8;
      const lines = this._wrapText(ctx, this._contentText, maxWidth);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], (cx + cw / 2), curY + i * lineHeight);
      }
      curY += lines.length * lineHeight + SPACING_XL;
    }

    // 按钮组
    if (this._buttonConfigs.length > 0) {
      const btnGap = 14;
      const totalBtnWidth = cw - SPACING_XL * 2;
      const singleBtnWidth = (totalBtnWidth - btnGap * (this._buttonConfigs.length - 1)) / this._buttonConfigs.length;
      const btnHeight = 38;
      const btnStartX = cx + SPACING_XL;

      // 记录按钮区域用于点击检测
      this._buttonRects = [];

      for (let i = 0; i < this._buttonConfigs.length; i++) {
        const btnConfig = this._buttonConfigs[i];
        const bx = btnStartX + i * (singleBtnWidth + btnGap);
        const by = curY;

        // 按钮切角
        const btnCut = 6;
        ctx.beginPath();
        if (btnConfig.type === 'secondary' || i === 0) {
          // 左切角
          ctx.moveTo(bx + btnCut, by);
          ctx.lineTo(bx + singleBtnWidth, by);
          ctx.lineTo(bx + singleBtnWidth, by + btnHeight);
          ctx.lineTo(bx, by + btnHeight);
          ctx.lineTo(bx, by + btnCut);
        } else {
          // 右切角
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + singleBtnWidth, by);
          ctx.lineTo(bx + singleBtnWidth - btnCut, by + btnHeight);
          ctx.lineTo(bx, by + btnHeight);
        }
        ctx.closePath();

        if (btnConfig.type === 'primary') {
          ctx.fillStyle = 'rgba(0, 245, 212, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 245, 212, 0.3)';
        } else {
          ctx.fillStyle = 'rgba(127, 140, 155, 0.1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(127, 140, 155, 0.25)';
        }
        ctx.lineWidth = 1;
        ctx.stroke();

        // 按钮文字
        ctx.font = `${FONT_SIZE_MD}px ${FONT_PRIMARY}`;
        ctx.fillStyle = btnConfig.type === 'primary' ? RUNE_CYAN : TEXT_SECONDARY;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btnConfig.text, bx + singleBtnWidth / 2, by + btnHeight / 2);

        // 存储按钮区域（逻辑像素）
        this._buttonRects.push({
          x: bx,
          y: by,
          width: singleBtnWidth,
          height: btnHeight,
          onTap: btnConfig.onTap,
        });
      }
    }

    ctx.restore();
  }

  /**
   * 文字换行
   * @private
   */
  _wrapText(ctx, text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      if (para === '') {
        lines.push('');
        continue;
      }
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
   * 显示模态框（带动画）
   */
  show() {
    if (this._isShowing) return;
    this._isShowing = true;
    this._isHiding = false;
    this.visible = true;
    this._overlayAlpha = 0;
    this._cardScale = 0.8;
    this._cardAlpha = 0;

    Tween.stopAll(this);
    Tween.create(this)
      .to({
        _overlayAlpha: 1,
        _cardScale: 1,
        _cardAlpha: 1,
      }, ANIM_NORMAL, 'easeOut')
      .call(() => {
        this._isShowing = false;
      })
      .start();
  }

  /**
   * 隐藏模态框（带动画）
   * @param {Function} [callback] - 隐藏完成后的回调
   */
  hide(callback) {
    if (this._isHiding) return;
    this._isHiding = true;
    this._isShowing = false;

    Tween.stopAll(this);
    Tween.create(this)
      .to({
        _overlayAlpha: 0,
        _cardScale: 0.8,
        _cardAlpha: 0,
      }, ANIM_NORMAL, 'easeIn')
      .call(() => {
        this.visible = false;
        this._isHiding = false;
        if (callback) callback();
      })
      .start();
  }

  /**
   * 处理触摸点击
   * @param {number} worldX - 逻辑像素
   * @param {number} worldY - 逻辑像素
   * @returns {boolean} 是否消费了事件
   */
  handleTap(worldX, worldY) {
    if (!this.visible) return false;

    // 检查按钮点击
    if (this._buttonRects) {
      for (const rect of this._buttonRects) {
        if (
          worldX >= rect.x && worldX <= rect.x + rect.width &&
          worldY >= rect.y && worldY <= rect.y + rect.height
        ) {
          if (rect.onTap) rect.onTap();
          return true;
        }
      }
    }

    // 检查是否点在卡片外（遮罩区域）
    const cx = this._cardX;
    const cy = this._cardY;
    const cw = this._cardWidth;
    const ch = this._cardHeight;
    const inCard = worldX >= cx && worldX <= cx + cw &&
                   worldY >= cy && worldY <= cy + ch;

    if (!inCard && this._closeOnOverlay) {
      this.hide();
      this.emit('close');
      return true;
    }

    // 模态框消费所有点击（防止穿透）
    return true;
  }
}
