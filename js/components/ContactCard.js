/**
 * ContactCard.js - 联系人卡片组件
 * 继承 Node，用于通讯记录列表中的联系人显示
 * 包含头像圈（emoji）、联系人名字、预览文字、箭头、未读/线索指示点、私密标签、加密状态
 */

import { Node } from '../engine/Node.js';
import {
  RUNE_CYAN, RUNE_AMBER, RUNE_PURPLE, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO, SPACING_SM, SPACING_MD, SPACING_LG,
  FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG,
} from '../style/StyleConfig.js';

/** 卡片高度（逻辑像素） */
const CARD_HEIGHT = 56;
/** 头像尺寸 */
const AVATAR_SIZE = 44;
/** 切角大小 */
const CUT_SIZE = 12;

export class ContactCard extends Node {
  /**
   * @param {Object} options
   * @param {string} options.id - 联系人 ID
   * @param {string} options.name - 联系人名字
   * @param {string} options.avatar - 头像 emoji
   * @param {string} options.preview - 预览文字
   * @param {boolean} [options.isEncrypted=false] - 是否加密
   * @param {boolean} [options.isPrivate=false] - 是否私密
   * @param {boolean} [options.isClue=false] - 是否线索
   * @param {boolean} [options.isViewed=false] - 是否已查看
   * @param {number} options.cardWidth - 卡片宽度
   */
  constructor(options = {}) {
    super();

    this.contactId = options.id || '';
    this.contactName = options.name || '';
    this.contactAvatar = options.avatar || '';
    this.contactPreview = options.preview || '';
    this.isEncrypted = options.isEncrypted || false;
    this.isPrivate = options.isPrivate || false;
    this.isClue = options.isClue || false;
    this.isViewed = options.isViewed || false;

    this.width = options.cardWidth || 320;
    this.height = CARD_HEIGHT;

    this.interactive = true;

    // 按下状态
    this._isPressed = false;

    // 动画计时器（闪烁效果）
    this._pulseTimer = 0;
  }

  /**
   * 每帧更新（脉冲动画）
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    this._pulseTimer += dt;
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const w = this.width;
    const h = this.height;
    const cut = CUT_SIZE;
    const isEnc = this.isEncrypted;

    ctx.save();

    // 按下状态缩放
    if (this._isPressed) {
      const cx = w / 2;
      const cy = h / 2;
      ctx.translate(cx, cy);
      ctx.scale(0.98, 0.98);
      ctx.translate(-cx, -cy);
    }

    // 整体透明度（加密 0.5）
    if (isEnc) {
      ctx.globalAlpha *= 0.5;
    }

    // ====== 阴影（双色） ======
    if (!isEnc) {
      ctx.shadowColor = 'rgba(0, 245, 212, 0.08)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // ====== 卡片背景（切角矩形：左上 + 右下） ======
    ctx.beginPath();
    ctx.moveTo(cut, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h - cut);
    ctx.lineTo(w - cut, h);
    ctx.lineTo(0, h);
    ctx.lineTo(0, cut);
    ctx.closePath();

    // 填充渐变
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, 'rgba(12, 18, 48, 0.9)');
    bgGrad.addColorStop(1, 'rgba(8, 12, 32, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 扫描线纹理
    ctx.save();
    ctx.clip();
    for (let sy = 0; sy < h; sy += 5) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.fillRect(0, sy, w, 1);
    }
    ctx.restore();

    // 边框（渐变双色）
    ctx.beginPath();
    ctx.moveTo(cut, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h - cut);
    ctx.lineTo(w - cut, h);
    ctx.lineTo(0, h);
    ctx.lineTo(0, cut);
    ctx.closePath();
    if (isEnc) {
      ctx.strokeStyle = 'rgba(127, 140, 155, 0.15)';
    } else {
      const borderGrad = ctx.createLinearGradient(0, 0, w, h);
      borderGrad.addColorStop(0, 'rgba(0, 245, 212, 0.3)');
      borderGrad.addColorStop(1, 'rgba(245, 166, 35, 0.12)');
      ctx.strokeStyle = borderGrad;
    }
    ctx.lineWidth = 1;
    ctx.stroke();

    // ====== 头像 ======
    const avatarR = (AVATAR_SIZE / 2);
    const avatarCX = (10 + AVATAR_SIZE / 2);
    const avatarCY = h / 2;

    // 头像圆圈
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    if (isEnc) {
      ctx.fillStyle = 'rgba(127, 140, 155, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(127, 140, 155, 0.25)';
    } else {
      const avatarGrad = ctx.createLinearGradient(
        avatarCX - avatarR, avatarCY - avatarR,
        avatarCX + avatarR, avatarCY + avatarR
      );
      avatarGrad.addColorStop(0, 'rgba(0, 245, 212, 0.08)');
      avatarGrad.addColorStop(1, 'rgba(245, 166, 35, 0.06)');
      ctx.fillStyle = avatarGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';

      // 头像发光
      ctx.shadowColor = 'rgba(0, 245, 212, 0.1)';
      ctx.shadowBlur = 6;
    }
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Emoji 文字
    ctx.font = `${20}px ${FONT_PRIMARY}`;
    ctx.fillStyle = isEnc ? 'rgba(127, 140, 155, 0.6)' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.contactAvatar, avatarCX, avatarCY);

    // ====== 联系人信息 ======
    const infoX = (10 + AVATAR_SIZE + 12);
    const arrowWidth = 20;
    const infoMaxWidth = w - infoX - arrowWidth - 10;

    // 名字
    ctx.font = `500 ${FONT_SIZE_LG}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const nameY = h / 2 - FONT_SIZE_LG - 2;

    if (isEnc) {
      // 加密名字闪烁效果
      const glitchAlpha = 0.5 + Math.sin(this._pulseTimer / 300) * 0.2;
      ctx.globalAlpha *= glitchAlpha;
    }
    ctx.fillText(this.contactName, infoX, nameY);

    // 私密标签
    if (this.isPrivate && !isEnc) {
      const nameWidth = ctx.measureText(this.contactName).width;
      const tagX = infoX + nameWidth + 6;
      const tagText = '私密';
      ctx.font = `${FONT_SIZE_SM * 0.9}px ${FONT_MONO}`;
      const tagWidth = ctx.measureText(tagText).width + 10;

      ctx.strokeStyle = 'rgba(245, 166, 35, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tagX, nameY - 1, tagWidth, FONT_SIZE_SM + 4);
      ctx.fillStyle = RUNE_AMBER;
      ctx.shadowColor = 'rgba(245, 166, 35, 0.3)';
      ctx.shadowBlur = 3;
      ctx.fillText(tagText, tagX + 5, nameY);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    if (isEnc) {
      // 恢复透明度
      ctx.globalAlpha = ctx.globalAlpha; // 已经乘过了
    }

    // 预览文字
    ctx.font = `${FONT_SIZE_SM}px ${FONT_PRIMARY}`;
    ctx.fillStyle = isEnc ? TEXT_DIM : TEXT_SECONDARY;
    ctx.textBaseline = 'top';
    const previewY = h / 2 + 2;

    // 截断预览文字
    let preview = this.contactPreview;
    while (ctx.measureText(preview).width > infoMaxWidth && preview.length > 0) {
      preview = preview.slice(0, -1);
    }
    if (preview.length < this.contactPreview.length) {
      preview = preview.slice(0, -1) + '...';
    }
    if (isEnc) {
      // 加密预览用等宽字体
      ctx.font = `${FONT_SIZE_SM}px ${FONT_MONO}`;
      ctx.letterSpacing = `${2}px`;
    }
    ctx.fillText(preview, infoX, previewY);

    // ====== 箭头 ======
    ctx.font = `${FONT_SIZE_MD}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u203A', w - 15, h / 2);

    // ====== 指示点 ======
    const dotR = 3.5;
    const dotX = w - 7;
    const dotY = 7;

    if (this.isClue && !this.isViewed) {
      // 线索指示点（琥珀色脉冲）
      const pulseScale = 1 + Math.sin(this._pulseTimer / 300) * 0.3;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = RUNE_AMBER;
      ctx.shadowColor = 'rgba(245, 166, 35, 0.7)';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else if (!this.isViewed && !this.isClue) {
      // 未读指示点（青色）
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = RUNE_CYAN;
      ctx.shadowColor = 'rgba(0, 245, 212, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /**
   * 触摸按下
   */
  onPressDown() {
    this._isPressed = true;
  }

  /**
   * 触摸抬起
   */
  onPressUp() {
    this._isPressed = false;
  }

  /**
   * 检测是否命中
   * @param {number} localX - 相对卡片的 x
   * @param {number} localY - 相对卡片的 y
   * @returns {boolean}
   */
  hitTest(localX, localY) {
    return localX >= 0 && localX <= this.width &&
           localY >= 0 && localY <= this.height;
  }
}
