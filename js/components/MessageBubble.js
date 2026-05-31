/**
 * MessageBubble.js - 消息气泡组件
 * 可复用于 chat 和 conversation 页面
 * 支持多种 sender 类型：xinghe（左）、alias（右）、system（居中）、other（左）
 */

import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { RichText } from '../engine/RichText.js';
import { Graphics } from '../engine/Graphics.js';
import {
  RUNE_CYAN, RUNE_PURPLE, TEXT_PRIMARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO, FONT_SIZE_SM, FONT_SIZE_MD,
  SPACING_SM, SPACING_MD, SPACING_LG,
} from '../style/StyleConfig.js';

/** 头像区域尺寸 */
const AVATAR_SIZE = 36;
/** 头像右边距 */
const AVATAR_MARGIN = 8;
/** 气泡最大宽度 */
const BUBBLE_MAX_WIDTH = 270;
/** 气泡内边距 */
const BUBBLE_PADDING_X = 14;
const BUBBLE_PADDING_Y = 10;
/** 切角尺寸 */
const BUBBLE_CUT = 8;
/** 系统消息分隔线高度 */
const SYSTEM_LINE_HEIGHT = 0.5;

export class MessageBubble extends Node {
  /**
   * @param {Object} options
   * @param {string} options.type - 消息类型：'xinghe' | 'system' | 'alias' | 'other'
   * @param {string} [options.text=''] - 纯文本内容（system 类型使用）
   * @param {Array} [options.segments] - 富文本段落数组（xinghe/other 类型使用）
   * @param {number} [options.containerWidth=375] - 容器宽度（用于定位）
   * @param {number} [options.msgIndex=0] - 消息在列表中的索引
   */
  constructor(options = {}) {
    super();

    this.msgType = options.type || 'xinghe';
    this.msgText = options.text || '';
    this.msgSegments = options.segments || null;
    this.containerWidth = options.containerWidth || 375;
    this.msgIndex = options.msgIndex || 0;

    /** @type {RichText|null} 富文本组件引用（用于外部关键词命中检测） */
    this.richText = null;

    // 根据类型创建对应 UI
    this._buildUI();
  }

  /**
   * 构建 UI 结构
   * @private
   */
  _buildUI() {
    switch (this.msgType) {
      case 'xinghe':
        this._buildXingheBubble();
        break;
      case 'other':
        this._buildOtherBubble();
        break;
      case 'alias':
        this._buildAliasBubble();
        break;
      case 'system':
        this._buildSystemMessage();
        break;
      default:
        this._buildXingheBubble();
        break;
    }
  }

  /**
   * 构建星河消息气泡（左对齐，带头像）
   * @private
   */
  _buildXingheBubble() {
    this._buildLeftBubble('⭐', RUNE_CYAN);
  }

  /**
   * 构建其他人消息气泡（左对齐，带头像）
   * @private
   */
  _buildOtherBubble() {
    this._buildLeftBubble('👤', RUNE_PURPLE);
  }

  /**
   * 构建左对齐气泡（通用）
   * @private
   * @param {string} avatarEmoji - 头像文字
   * @param {string} accentColor - 强调颜色
   */
  _buildLeftBubble(avatarEmoji, accentColor) {
    const padding = SPACING_MD;

    // 头像背景
    const avatarBg = new Graphics();
    avatarBg.clear()
      .beginPath()
      .arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
      .fill('rgba(0, 245, 212, 0.08)')
      .beginPath()
      .arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
      .stroke('rgba(0, 245, 212, 0.2)', 0.5);
    avatarBg.x = padding;
    avatarBg.y = 0;
    avatarBg.width = AVATAR_SIZE;
    avatarBg.height = AVATAR_SIZE;
    this.addChild(avatarBg);

    // 头像 emoji
    const avatarLabel = new Label({
      text: avatarEmoji,
      fontSize: 18,
      textAlign: 'center',
    });
    avatarLabel.x = padding;
    avatarLabel.y = (AVATAR_SIZE - 18) / 2;
    avatarLabel.width = AVATAR_SIZE;
    this.addChild(avatarLabel);

    // 气泡区域 x 起始位置
    const bubbleX = padding + AVATAR_SIZE + AVATAR_MARGIN;
    const textMaxWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2;

    // 气泡内容（RichText 或 Label）—— 立即 addChild 以确保首帧即可参与渲染
    if (this.msgSegments && this.msgSegments.length > 0) {
      this.richText = new RichText({
        segments: this.msgSegments,
        fontSize: FONT_SIZE_MD,
        color: '#c8d6e5',
        keywordColor: RUNE_CYAN,
        keywordCollectedColor: 'rgba(0, 245, 212, 0.25)',
        maxWidth: textMaxWidth,
        lineHeight: 1.7,
      });
      this.richText.x = bubbleX + BUBBLE_PADDING_X;
      this.richText.y = BUBBLE_PADDING_Y;
      this.richText.interactive = true;
      this.addChild(this.richText);
    } else {
      // 纯文本回退
      this.richText = null;
      const textLabel = new Label({
        text: this.msgText,
        fontSize: FONT_SIZE_MD,
        color: '#c8d6e5',
        maxWidth: textMaxWidth,
        lineHeight: 1.7,
      });
      textLabel.x = bubbleX + BUBBLE_PADDING_X;
      textLabel.y = BUBBLE_PADDING_Y;
      this.addChild(textLabel);
      this._textLabel = textLabel;
    }

    // 气泡背景在 _draw 中动态绘制
    this._bubbleX = bubbleX;
    this._accentColor = accentColor;
    this._isLeftBubble = true;
    this._padding = padding;

    // 内容已添加到节点树，首帧即可渲染
    this._contentReady = true;
  }

  /**
   * 构建被害人消息气泡（右对齐）
   * @private
   */
  _buildAliasBubble() {
    const padding = SPACING_MD;
    const textMaxWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2;

    if (this.msgSegments && this.msgSegments.length > 0) {
      this.richText = new RichText({
        segments: this.msgSegments,
        fontSize: FONT_SIZE_MD,
        color: '#c8d6e5',
        keywordColor: RUNE_CYAN,
        keywordCollectedColor: 'rgba(0, 245, 212, 0.25)',
        maxWidth: textMaxWidth,
        lineHeight: 1.7,
      });
      this.richText.interactive = true;
      this.addChild(this.richText);
    } else {
      const textLabel = new Label({
        text: this.msgText,
        fontSize: FONT_SIZE_MD,
        color: '#c8d6e5',
        maxWidth: textMaxWidth,
        lineHeight: 1.7,
      });
      this._textLabel = textLabel;
      this.addChild(textLabel);
    }

    this._isLeftBubble = false;
    this._padding = padding;
    this._accentColor = RUNE_PURPLE;
    this._contentReady = true;
  }

  /**
   * 构建系统消息（居中，两侧横线）
   * @private
   */
  _buildSystemMessage() {
    const padding = SPACING_MD;

    // 系统消息标签
    this._systemLabel = new Label({
      text: this.msgText,
      fontSize: FONT_SIZE_SM,
      color: 'rgba(0, 245, 212, 0.85)',
      fontFamily: FONT_MONO,
      textAlign: 'center',
      shadowColor: 'rgba(0, 245, 212, 0.4)',
      shadowBlur: 4,
    });
    this._systemLabel.width = this.containerWidth;
    this.addChild(this._systemLabel);

    // 系统消息高度（标签高度 + 上下边距）
    const msgHeight = FONT_SIZE_SM * 1.4 + SPACING_MD * 2;
    this.width = this.containerWidth;
    this.height = msgHeight;

    this._systemLabel.y = SPACING_MD;
    this._isSystem = true;
    this._contentReady = true;
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    if (this._isSystem) {
      this._drawSystemMessage(ctx);
      return;
    }

    this._drawBubbleMessage(ctx);
  }

  /**
   * 绘制系统消息（居中文字 + 两侧渐变线）
   * @private
   */
  _drawSystemMessage(ctx) {
    const w = this.containerWidth;
    const lineY = (this.height / 2);

    // measureText + 渐变均缓存，避免每帧重建
    if (this._cachedSysTextWidth === undefined) {
      ctx.font = `${FONT_SIZE_SM}px ${FONT_MONO}`;
      this._cachedSysTextWidth = ctx.measureText(this.msgText).width;
    }
    const textWidth = this._cachedSysTextWidth;
    const textAreaWidth = textWidth + 24;
    const centerX = w / 2;
    const textLeft = centerX - textAreaWidth / 2;
    const textRight = centerX + textAreaWidth / 2;

    if (!this._cachedSysLeftGrad) {
      this._cachedSysLeftGrad = ctx.createLinearGradient(SPACING_MD, 0, textLeft, 0);
      this._cachedSysLeftGrad.addColorStop(0, 'transparent');
      this._cachedSysLeftGrad.addColorStop(0.4, 'rgba(155, 93, 229, 0.25)');
      this._cachedSysLeftGrad.addColorStop(0.7, 'rgba(0, 245, 212, 0.2)');
      this._cachedSysLeftGrad.addColorStop(1, 'transparent');
    }
    if (!this._cachedSysRightGrad) {
      this._cachedSysRightGrad = ctx.createLinearGradient(textRight, 0, w - SPACING_MD, 0);
      this._cachedSysRightGrad.addColorStop(0, 'transparent');
      this._cachedSysRightGrad.addColorStop(0.3, 'rgba(0, 245, 212, 0.2)');
      this._cachedSysRightGrad.addColorStop(0.6, 'rgba(155, 93, 229, 0.25)');
      this._cachedSysRightGrad.addColorStop(1, 'transparent');
    }

    ctx.fillStyle = this._cachedSysLeftGrad;
    ctx.fillRect(SPACING_MD, lineY, textLeft - SPACING_MD, SYSTEM_LINE_HEIGHT);

    ctx.fillStyle = this._cachedSysRightGrad;
    ctx.fillRect(textRight, lineY, w - SPACING_MD - textRight, SYSTEM_LINE_HEIGHT);

    // 文字背景
    const bgPadX = 12;
    const bgPadY = 3;
    const bgH = (FONT_SIZE_SM - 2) + bgPadY * 2;
    const bgY = lineY - bgH / 2;

    ctx.fillStyle = 'rgba(0, 245, 212, 0.06)';
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.fillRect(textLeft, bgY, textAreaWidth, bgH);
    ctx.strokeRect(textLeft, bgY, textAreaWidth, bgH);
  }

  /**
   * 绘制气泡消息（左对齐或右对齐）
   * @private
   */
  _drawBubbleMessage(ctx) {
    // 获取文字实际高度（RichText/Label 已在构建时 addChild）
    let contentHeight;
    if (this.richText) {
      contentHeight = this.richText.height || FONT_SIZE_MD * 1.7;
    } else if (this._textLabel) {
      contentHeight = this._textLabel.height || FONT_SIZE_MD * 1.7;
    } else {
      contentHeight = FONT_SIZE_MD * 1.7;
    }

    // Label/RichText.height 末尾含一行行距尾缀（fontSize×0.7），去掉它
    // 使气泡上下内边距视觉对称
    const lineGapTrailing = FONT_SIZE_MD * 0.7;
    const bubbleHeight = (contentHeight - lineGapTrailing) + BUBBLE_PADDING_Y * 2;
    const bubbleWidth = BUBBLE_MAX_WIDTH;

    if (this._isLeftBubble) {
      const bx = this._bubbleX;
      const by = 0;
      const bw = bubbleWidth;
      const bh = bubbleHeight;
      const cut = BUBBLE_CUT;

      // 气泡背景 — 半透明 + 切角
      ctx.save();

      // 绘制切角路径（左上角切角）
      ctx.beginPath();
      ctx.moveTo(bx + cut, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx, by + cut);
      ctx.closePath();

      // 填充半透明背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();

      // 左侧强调边框（渐变色）—— 缓存 gradient 避免每帧重建
      if (!this._cachedBorderGrad || this._cachedBorderGradH !== bh) {
        this._cachedBorderGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
        this._cachedBorderGrad.addColorStop(0, RUNE_CYAN);
        this._cachedBorderGrad.addColorStop(1, RUNE_PURPLE);
        this._cachedBorderGradH = bh;
      }
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 左侧强调线
      ctx.beginPath();
      ctx.moveTo(bx, by + cut);
      ctx.lineTo(bx, by + bh);
      ctx.strokeStyle = this._cachedBorderGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // 设定高度
      this.height = bubbleHeight + SPACING_MD;
      this.width = this.containerWidth;
    } else {
      // 右对齐气泡（alias）
      const bw = bubbleWidth;
      const bh = bubbleHeight;
      const bx = (this.containerWidth - this._padding - bubbleWidth);
      const by = 0;
      const cut = BUBBLE_CUT;

      ctx.save();

      // 切角路径（右上角切角）
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw - cut, by);
      ctx.lineTo(bx + bw, by + cut);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.closePath();

      // 半透明紫色背景
      ctx.fillStyle = 'rgba(155, 93, 229, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(155, 93, 229, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 右侧强调线
      ctx.beginPath();
      ctx.moveTo(bx + bw, by + cut);
      ctx.lineTo(bx + bw, by + bh);
      ctx.strokeStyle = RUNE_PURPLE;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // 定位文字
      if (this.richText) {
        this.richText.x = (this.containerWidth - this._padding - bubbleWidth + BUBBLE_PADDING_X);
        this.richText.y = BUBBLE_PADDING_Y;
      } else if (this._textLabel) {
        this._textLabel.x = (this.containerWidth - this._padding - bubbleWidth + BUBBLE_PADDING_X);
        this._textLabel.y = BUBBLE_PADDING_Y;
      }

      this.height = bubbleHeight + SPACING_MD;
      this.width = this.containerWidth;
    }
  }

  /**
   * 检测点击是否命中关键词
   * @param {number} localX - 组件本地 X 坐标
   * @param {number} localY - 组件本地 Y 坐标
   * @returns {{ segIndex: number, evidenceId: string, msgIndex: number } | null}
   */
  hitTestKeyword(localX, localY) {
    if (!this.richText) return null;

    // localX/localY 已是气泡本地坐标，转换到 RichText 本地坐标
    const rtLocalX = localX - this.richText.x;
    const rtLocalY = localY - this.richText.y;

    // 直接检测 hitAreas（避免 onTap 的二次世界坐标转换）
    const hit = this.richText.hitTest(rtLocalX, rtLocalY);
    if (hit) {
      return {
        segIndex: hit.segIndex,
        evidenceId: hit.evidenceId,
        msgIndex: this.msgIndex,
      };
    }
    return null;
  }

  /**
   * 标记某关键词为已收集
   * @param {string} evidenceId
   */
  markKeywordCollected(evidenceId) {
    if (this.richText) {
      this.richText.markCollected(evidenceId);
    }
  }

  /**
   * 获取消息气泡的实际高度（含底部间距）
   * @returns {number}
   */
  getHeight() {
    return this.height || 40;
  }
}
