/**
 * ConversationPage.js - 单条对话详情页面
 * 继承 Scene，完整还原 conversation 页面
 * 支持 6 种消息类型、关键词点击收集、隐私提示 Modal、收集 Toast
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { RichText } from '../engine/RichText.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { Tween } from '../engine/Tween.js';
import { Modal } from '../components/Modal.js';
import gameState from '../core/GameState.js';
import { conversations } from '../data/story.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_PURPLE, RUNE_AMBER,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL,
  ANIM_NORMAL, ANIM_FAST,
} from '../style/StyleConfig.js';

/** 导航栏高度 */
const HEADER_HEIGHT = 44;
/** 气泡最大宽度比例 */
const BUBBLE_MAX_WIDTH_RATIO = 0.75;
/** 气泡内边距 */
const BUBBLE_PAD_X = 14;
const BUBBLE_PAD_Y = 10;
/** 消息间距 */
const MSG_GAP = 12;
/** 列表左右边距 */
const LIST_PAD = 14;
/** 切角大小 */
const BUBBLE_CUT = 8;

export class ConversationPage extends Scene {
  /**
   * @param {string} contactId - 联系人 ID
   */
  constructor(contactId) {
    super();

    this._contactId = contactId;
    this._screenWidth = 0;
    this._screenHeight = 0;
    this._statusBarHeight = 22;

    // 联系人信息
    this._contactName = '';
    this._contactAvatar = '';
    this._isEncrypted = false;
    this._isPrivate = false;

    // 消息数据（已解析 segments）
    this._messages = [];

    // ScrollView
    this._scrollView = null;

    // 隐私提示 Modal
    this._privacyModal = null;
    this._showPrivacy = false;

    // 收集 Toast
    this._collectToastVisible = false;
    this._collectToastAlpha = 0;
    this._collectToastTimer = 0;

    // 导航栏未读
    this._hasUnreadChat = false;

    // 流光线动画
    this._flowTimer = 0;

    // 消息节点缓存（用于关键词点击区域检测）
    this._messageNodes = [];
  }

  // ==================== 生命周期 ====================

  onEnter() {
    const engine = this.engine;
    this._screenWidth = engine.getWidth();
    this._screenHeight = engine.getHeight();

    try {
      const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this._statusBarHeight = sysInfo.statusBarHeight || 22;
    } catch (e) {
      this._statusBarHeight = 22;
    }

    this.width = this._screenWidth;
    this.height = this._screenHeight;

    this._hasUnreadChat = gameState.hasUnreadChat();

    // 加载数据
    this._loadConversation();

    // 构建 UI
    this._buildUI();

    // 滚动到底部
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null;
      if (this._scrollView) {
        this._scrollView.scrollToBottom(false);
      }
    }, 100);
  }

  onExit() {
    Tween.stopAll(this);
    if (this._privacyModal) Tween.stopAll(this._privacyModal);
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
  }

  // ==================== 数据加载 ====================

  /**
   * 加载对话数据并解析关键词
   * @private
   */
  _loadConversation() {
    const conv = conversations[this._contactId];
    if (!conv) return;

    this._contactName = conv.name;
    this._contactAvatar = conv.avatar;
    this._isEncrypted = !!conv.isEncrypted;
    this._isPrivate = !!conv.isPrivate;
    this._showPrivacy = !!conv.isPrivate;

    const state = gameState.get();
    const collectedEvidence = state.collectedEvidence || [];

    // 解析消息（同 conversation.js 逻辑）
    this._messages = conv.messages.map((msg, index) => {
      const segments = this._parseSegments(msg.text, msg.keywords, collectedEvidence);
      return Object.assign({}, msg, {
        _index: index,
        segments: (msg.keywords && msg.keywords.length > 0) ? segments : null,
      });
    });

    // 如果不是私密对话，直接标记已读
    if (!conv.isPrivate) {
      gameState.markViewed('Conversations', this._contactId);
    }
  }

  /**
   * 关键词段落解析（同 chat.js / conversation.js 逻辑）
   * @private
   */
  _parseSegments(text, keywords, collectedIds) {
    if (!keywords || keywords.length === 0) {
      return [{ type: 'text', content: text }];
    }
    if (!collectedIds) {
      collectedIds = gameState.get().collectedEvidence || [];
    }

    const positions = [];
    keywords.forEach(kw => {
      let idx = 0;
      while (true) {
        const found = text.indexOf(kw.word, idx);
        if (found === -1) break;
        positions.push({
          start: found,
          end: found + kw.word.length,
          word: kw.word,
          evidenceId: kw.evidenceId,
        });
        idx = found + kw.word.length;
      }
    });

    positions.sort((a, b) => a.start - b.start);
    const segments = [];
    let pos = 0;
    positions.forEach(p => {
      if (p.start > pos) {
        segments.push({ type: 'text', content: text.slice(pos, p.start) });
      }
      segments.push({
        type: 'keyword',
        content: p.word,
        evidenceId: p.evidenceId,
        collected: collectedIds.includes(p.evidenceId),
      });
      pos = p.end;
    });
    if (pos < text.length) {
      segments.push({ type: 'text', content: text.slice(pos) });
    }
    return segments.length > 0 ? segments : [{ type: 'text', content: text }];
  }

  // ==================== UI 构建 ====================

  /**
   * 构建页面 UI
   * @private
   */
  _buildUI() {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const headerTop = this._statusBarHeight;
    const headerTotal = headerTop + HEADER_HEIGHT + 8;
    const bubbleMaxWidth = sw * BUBBLE_MAX_WIDTH_RATIO;

    // ====== ScrollView（消息列表） ======
    this._scrollView = new ScrollView({
      width: sw,
      height: sh - headerTotal,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });
    this._scrollView.x = 0;
    this._scrollView.y = headerTotal;
    this.addChild(this._scrollView);

    // 构建消息节点
    this._buildMessages(bubbleMaxWidth);

    // ====== 隐私提示 Modal ======
    if (this._showPrivacy) {
      this._privacyModal = new Modal({
        screenWidth: sw,
        screenHeight: sh,
        icon: '\u2B50',
        title: '星河',
        content: '......这条好像是他的私人内容。你可以跳过。',
        accentColor: RUNE_PURPLE,
        buttons: [
          {
            text: '跳过',
            type: 'secondary',
            onTap: () => this._skipPrivate(),
          },
          {
            text: '继续查看',
            type: 'primary',
            onTap: () => this._continueViewing(),
          },
        ],
      });
      this._privacyModal.zIndex = 200;
      this.addChild(this._privacyModal);
      this._privacyModal.show();
    }
  }

  /**
   * 构建消息节点列表
   * @private
   */
  _buildMessages(bubbleMaxWidth) {
    this._messageNodes = [];
    let curY = SPACING_LG;

    for (let i = 0; i < this._messages.length; i++) {
      const msg = this._messages[i];
      const node = this._createMessageNode(msg, i, bubbleMaxWidth);

      if (node) {
        node.y = curY;
        this._scrollView.addChild(node);
        this._messageNodes.push({ node, msg, index: i });
        curY += node.height + MSG_GAP;
      }
    }

    // 底部提示
    curY += SPACING_XL;
    const bottomLabel = new Label({
      text: '\u2014 你正在查看阿里亚斯的通讯记录 \u2014',
      fontSize: FONT_SIZE_XS,
      color: TEXT_DIM,
      textAlign: 'center',
      fontFamily: FONT_MONO,
    });
    bottomLabel.width = this._screenWidth;
    bottomLabel.x = 0;
    bottomLabel.y = curY;
    bottomLabel.height = FONT_SIZE_XS * 1.4;
    this._scrollView.addChild(bottomLabel);
    curY += bottomLabel.height + SPACING_XL;

    this._scrollView.contentHeight = curY;
  }

  /**
   * 创建单条消息节点
   * @private
   * @returns {Node|null}
   */
  _createMessageNode(msg, index, bubbleMaxWidth) {
    const sw = this._screenWidth;
    const sender = msg.sender;

    switch (sender) {
      case 'divider':
        return this._createDividerNode(msg, sw);
      case 'system':
        return this._createSystemNode(msg, index, sw);
      case 'encrypted':
        return this._createEncryptedNode(msg, sw);
      case 'foreign':
        return this._createForeignNode(msg, index, bubbleMaxWidth);
      case 'alias':
        return this._createAliasNode(msg, index, bubbleMaxWidth);
      default:
        // 'other' 或其他 → 左侧气泡
        return this._createOtherNode(msg, index, bubbleMaxWidth);
    }
  }

  /**
   * 创建分割线节点
   * @private
   */
  _createDividerNode(msg, sw) {
    const node = new Node();
    node.width = sw;
    node.height = FONT_SIZE_XS * 1.4 + SPACING_MD * 2;

    node._text = msg.text;
    node._draw = (ctx) => {
      const w = sw;
      const centerY = node.height / 2;

      // 测量文字宽度
      ctx.font = `${FONT_SIZE_XS}px ${FONT_MONO}`;
      const textWidth = ctx.measureText(msg.text).width;
      const textPadding = 10;
      const textStartX = (w - textWidth) / 2;

      // 左侧线
      const lineGrad1 = ctx.createLinearGradient(LIST_PAD, 0, textStartX - textPadding, 0);
      lineGrad1.addColorStop(0, 'transparent');
      lineGrad1.addColorStop(0.5, 'rgba(155, 93, 229, 0.1)');
      lineGrad1.addColorStop(1, 'rgba(0, 245, 212, 0.08)');
      ctx.fillStyle = lineGrad1;
      ctx.fillRect(LIST_PAD, centerY, textStartX - textPadding - LIST_PAD, 0.5);

      // 右侧线
      const lineGrad2 = ctx.createLinearGradient(textStartX + textWidth + textPadding, 0, (sw - LIST_PAD), 0);
      lineGrad2.addColorStop(0, 'rgba(0, 245, 212, 0.08)');
      lineGrad2.addColorStop(0.5, 'rgba(155, 93, 229, 0.1)');
      lineGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = lineGrad2;
      ctx.fillRect(textStartX + textWidth + textPadding, centerY,
        (sw - LIST_PAD) - (textStartX + textWidth + textPadding), 0.5);

      // 文字
      ctx.fillStyle = TEXT_DIM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg.text, w / 2, centerY);
    };

    return node;
  }

  /**
   * 创建系统消息节点
   * @private
   */
  _createSystemNode(msg, index, sw) {
    const node = new Node();
    node.width = sw;

    const maxTextWidth = sw - LIST_PAD * 4;  // 左右各留 2×LIST_PAD，避免溢出
    const fontSize = FONT_SIZE_SM;           // 12px，比原 XS(10px) 大一档
    const lineHeightPx = fontSize * 1.6;
    const bgPadX = 14;
    const bgPadY = 6;
    const bgW = maxTextWidth + bgPadX * 2;
    const bgX = (sw - bgW) / 2;

    // 辅助：按字符数估算行数（中文字符约占 1em 宽）
    const estLines = (text) => {
      const charsPerLine = Math.max(1, Math.floor(maxTextWidth / (fontSize * 1.0)));
      return Math.max(1, Math.ceil(text.length / charsPerLine));
    };

    if (msg.segments) {
      const richText = new RichText({
        segments: msg.segments,
        fontSize: fontSize,
        color: 'rgba(0, 245, 212, 0.9)',
        keywordColor: RUNE_CYAN,
        keywordCollectedColor: 'rgba(0, 245, 212, 0.25)',
        maxWidth: maxTextWidth,
        fontFamily: FONT_MONO,
      });
      richText.x = bgX + bgPadX;
      richText.y = SPACING_SM + bgPadY;
      richText.interactive = true;
      node.addChild(richText);

      const totalLen = msg.segments.reduce((n, s) => n + (s.content ? s.content.length : 0), 0);
      node.height = estLines({ length: totalLen }) * lineHeightPx + bgPadY * 2 + SPACING_SM * 2;
      node._richText = richText;
      node._msgIndex = index;
    } else {
      // 用 Label 实现自动换行 + 居中
      const label = new Label({
        text: msg.text,
        fontSize: fontSize,
        color: 'rgba(0, 245, 212, 0.9)',
        fontFamily: FONT_MONO,
        textAlign: 'center',
        maxWidth: maxTextWidth,
        lineHeight: 1.6,
        shadowColor: 'rgba(0, 245, 212, 0.4)',
        shadowBlur: 4,
      });
      label.width = maxTextWidth;
      label.x = bgX + bgPadX;
      label.y = SPACING_SM + bgPadY;
      node.addChild(label);

      // 预估高度用于布局（label 实际高度在首帧 _draw 后确定）
      node.height = estLines(msg.text) * lineHeightPx + bgPadY * 2 + SPACING_SM * 2;

      // 背景框跟随 label 实际高度动态更新
      node._draw = (ctx) => {
        const labelH = label.height || lineHeightPx;
        const bgH = labelH + bgPadY * 2;
        const bgY = SPACING_SM;
        node.height = bgH + SPACING_SM * 2;

        ctx.fillStyle = 'rgba(0, 245, 212, 0.05)';
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.fillRect(bgX, bgY, bgW, bgH);
        ctx.strokeRect(bgX, bgY, bgW, bgH);
      };
    }

    return node;
  }

  /**
   * 创建加密消息节点
   * @private
   */
  _createEncryptedNode(msg, sw) {
    const node = new Node();
    node.width = sw;
    node.height = FONT_SIZE_MD * 1.4 + SPACING_MD * 2;

    node._draw = (ctx) => {
      const w = sw;

      ctx.font = `${FONT_SIZE_MD}px ${FONT_MONO}`;
      const lockText = '\u25CC';
      const garbledText = msg.text;
      const lockWidth = ctx.measureText(lockText).width;
      const textWidth = ctx.measureText(garbledText).width;
      const totalWidth = lockWidth + 6 + textWidth;
      const padX = 12;
      const padY = 8;
      const bgW = totalWidth + padX * 2;
      const bgH = FONT_SIZE_MD * 1.4 + padY * 2;
      const bgX = (w - bgW) / 2;
      const bgY = (node.height - bgH) / 2;
      const cutEnc = 6;

      // 切角背景
      ctx.beginPath();
      ctx.moveTo(bgX + cutEnc, bgY);
      ctx.lineTo(bgX + bgW - cutEnc, bgY);
      ctx.lineTo(bgX + bgW, bgY + cutEnc);
      ctx.lineTo(bgX + bgW, bgY + bgH - cutEnc);
      ctx.lineTo(bgX + bgW - cutEnc, bgY + bgH);
      ctx.lineTo(bgX + cutEnc, bgY + bgH);
      ctx.lineTo(bgX, bgY + bgH - cutEnc);
      ctx.lineTo(bgX, bgY + cutEnc);
      ctx.closePath();
      ctx.fillStyle = 'rgba(127, 140, 155, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(127, 140, 155, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 扫描线
      ctx.save();
      ctx.clip();
      for (let sy = bgY; sy < bgY + bgH; sy += 4) {
        ctx.fillStyle = 'rgba(127, 140, 155, 0.04)';
        ctx.fillRect(bgX, sy, bgW, 2);
      }
      ctx.restore();

      // lock 图标
      ctx.fillStyle = TEXT_DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textStartX = (w - totalWidth) / 2;
      ctx.fillText(lockText, textStartX, node.height / 2);

      // 乱码文字
      ctx.font = `${FONT_SIZE_MD}px monospace`;
      ctx.fillText(garbledText, textStartX + lockWidth + 6, node.height / 2);
    };

    return node;
  }

  /**
   * 创建外来文字（foreign）节点
   * @private
   */
  _createForeignNode(msg, index, bubbleMaxWidth) {
    const sw = this._screenWidth;
    const textMaxWidth = bubbleMaxWidth - BUBBLE_PAD_X * 2;
    const node = new Node();
    node.width = sw;

    if (msg.segments) {
      const richText = new RichText({
        segments: msg.segments,
        fontSize: FONT_SIZE_MD,
        color: '#ffd59e',
        keywordColor: RUNE_CYAN,
        keywordCollectedColor: 'rgba(0, 245, 212, 0.25)',
        maxWidth: textMaxWidth,
      });
      richText.x = LIST_PAD + BUBBLE_PAD_X;
      richText.y = BUBBLE_PAD_Y;
      richText.interactive = true;
      node.addChild(richText);
      node._richText = richText;
      node._msgIndex = index;

      // 高度需要预估（RichText 会在绘制时计算）；减去尾行间距使文字视觉居中
      const estimatedLines = Math.ceil((msg.text || '').length / Math.floor(textMaxWidth / FONT_SIZE_MD));
      const estimatedHeight = estimatedLines * FONT_SIZE_MD * 1.8;
      node.height = estimatedHeight - FONT_SIZE_MD * 0.8 + BUBBLE_PAD_Y * 2;
    } else {
      // 纯文本
      const textLabel = new Label({
        text: msg.text,
        fontSize: FONT_SIZE_MD,
        color: '#ffd59e',
        maxWidth: textMaxWidth,
        lineHeight: 1.8,
      });
      textLabel.x = LIST_PAD + BUBBLE_PAD_X;
      textLabel.y = BUBBLE_PAD_Y;
      node.addChild(textLabel);

      const lines = (msg.text || '').split('\n');
      const estimatedHeight = lines.length * FONT_SIZE_MD * 1.8;
      node.height = Math.max(estimatedHeight - FONT_SIZE_MD * 0.8, FONT_SIZE_MD) + BUBBLE_PAD_Y * 2;
    }

    // 气泡背景绘制
    const bubbleW = bubbleMaxWidth;
    node._bubbleX = LIST_PAD;
    node._bubbleW = bubbleW;

    const originalDraw = node._draw;
    node._draw = (ctx) => {
      const bx = LIST_PAD;
      const by = 0;
      const bw = bubbleW;
      const bh = node.height;
      const cut = BUBBLE_CUT;

      // 切角气泡路径
      ctx.beginPath();
      ctx.moveTo(bx + cut, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx, by + cut);
      ctx.closePath();

      // 金色背景
      const bgGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      bgGrad.addColorStop(0, 'rgba(255, 183, 77, 0.06)');
      bgGrad.addColorStop(1, 'rgba(245, 166, 35, 0.03)');
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // 边框
      ctx.strokeStyle = 'rgba(255, 183, 77, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 发光
      ctx.shadowColor = 'rgba(255, 183, 77, 0.08)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      if (originalDraw) originalDraw.call(node, ctx);
    };

    return node;
  }

  /**
   * 创建阿里亚斯消息节点（右侧气泡）
   * @private
   */
  _createAliasNode(msg, index, bubbleMaxWidth) {
    const sw = this._screenWidth;
    const textMaxWidth = bubbleMaxWidth - BUBBLE_PAD_X * 2;
    const node = new Node();
    node.width = sw;

    let contentNode;
    if (msg.segments) {
      contentNode = new RichText({
        segments: msg.segments,
        fontSize: FONT_SIZE_MD,
        color: '#d0f0ea',
        keywordColor: RUNE_CYAN,
        keywordCollectedColor: 'rgba(0, 245, 212, 0.25)',
        maxWidth: textMaxWidth,
      });
      contentNode.interactive = true;
      node._richText = contentNode;
      node._msgIndex = index;
    } else {
      contentNode = new Label({
        text: msg.text,
        fontSize: FONT_SIZE_MD,
        color: '#d0f0ea',
        maxWidth: textMaxWidth,
        lineHeight: 1.7,
      });
    }

    // 估算尺寸
    const lines = (msg.text || '').split('\n');
    let estimatedLines = 0;
    const charsPerLine = Math.floor(textMaxWidth / FONT_SIZE_MD);
    for (const line of lines) {
      estimatedLines += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    const textHeight = estimatedLines * FONT_SIZE_MD * 1.7;
    node.height = textHeight - FONT_SIZE_MD * 0.7 + BUBBLE_PAD_Y * 2;

    // 估算气泡宽度
    const maxTextLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    const estimatedTextWidth = Math.min(maxTextLine.length * FONT_SIZE_MD, textMaxWidth);
    const bubbleW = estimatedTextWidth + BUBBLE_PAD_X * 2;
    const bubbleX = sw - LIST_PAD - bubbleW;

    contentNode.x = bubbleX + BUBBLE_PAD_X;
    contentNode.y = BUBBLE_PAD_Y;
    contentNode.width = textMaxWidth;
    node.addChild(contentNode);

    // 气泡背景
    node._draw = (ctx) => {
      const bx = bubbleX;
      const by = 0;
      const bw = bubbleW;
      const bh = node.height;
      const cut = BUBBLE_CUT;

      // 右上切角
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + bw - cut, by);
      ctx.lineTo(bx + bw, by + cut);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.closePath();

      // 青+紫渐变背景
      const bgGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      bgGrad.addColorStop(0, 'rgba(0, 245, 212, 0.06)');
      bgGrad.addColorStop(1, 'rgba(155, 93, 229, 0.03)');
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // 右侧渐变边框
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.18)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 右边框加粗渐变
      const rightBorderGrad = ctx.createLinearGradient(bx + bw, by, bx + bw, by + bh);
      rightBorderGrad.addColorStop(0, RUNE_CYAN);
      rightBorderGrad.addColorStop(1, RUNE_PURPLE);
      ctx.beginPath();
      ctx.moveTo(bx + bw, by + cut);
      ctx.lineTo(bx + bw, by + bh);
      ctx.strokeStyle = rightBorderGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    return node;
  }

  /**
   * 创建对方消息节点（左侧气泡）
   * @private
   */
  _createOtherNode(msg, index, bubbleMaxWidth) {
    const sw = this._screenWidth;
    const textMaxWidth = bubbleMaxWidth - BUBBLE_PAD_X * 2;
    const node = new Node();
    node.width = sw;

    let startY = 0;

    // 发言人姓名
    if (msg.senderName) {
      const nameLabel = new Label({
        text: msg.senderName,
        fontSize: FONT_SIZE_XS,
        color: RUNE_CYAN,
        fontFamily: FONT_MONO,
      });
      nameLabel.x = LIST_PAD + 2;
      nameLabel.y = 0;
      nameLabel.alpha = 0.7;
      nameLabel.height = FONT_SIZE_XS * 1.4;
      node.addChild(nameLabel);
      startY = FONT_SIZE_XS * 1.4 + 2;
    }

    let contentNode;
    if (msg.segments) {
      contentNode = new RichText({
        segments: msg.segments,
        fontSize: FONT_SIZE_MD,
        color: TEXT_PRIMARY,
        keywordColor: RUNE_CYAN,
        keywordCollectedColor: 'rgba(0, 245, 212, 0.25)',
        maxWidth: textMaxWidth,
      });
      contentNode.interactive = true;
      node._richText = contentNode;
      node._msgIndex = index;
    } else {
      contentNode = new Label({
        text: msg.text,
        fontSize: FONT_SIZE_MD,
        color: TEXT_PRIMARY,
        maxWidth: textMaxWidth,
        lineHeight: 1.7,
      });
    }

    // 估算尺寸
    const lines = (msg.text || '').split('\n');
    let estimatedLines = 0;
    const charsPerLine = Math.floor(textMaxWidth / FONT_SIZE_MD);
    for (const line of lines) {
      estimatedLines += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    const textHeight = estimatedLines * FONT_SIZE_MD * 1.7;
    const bubbleH = textHeight - FONT_SIZE_MD * 0.7 + BUBBLE_PAD_Y * 2;
    node.height = startY + bubbleH;

    // 估算气泡宽度
    const maxTextLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    const estimatedTextWidth = Math.min(maxTextLine.length * FONT_SIZE_MD, textMaxWidth);
    const bubbleW = estimatedTextWidth + BUBBLE_PAD_X * 2;

    contentNode.x = LIST_PAD + BUBBLE_PAD_X;
    contentNode.y = startY + BUBBLE_PAD_Y;
    contentNode.width = textMaxWidth;
    node.addChild(contentNode);

    // 气泡背景
    const bubbleStartY = startY;
    node._draw = (ctx) => {
      const bx = LIST_PAD;
      const by = bubbleStartY;
      const bw = bubbleW;
      const bh = bubbleH;
      const cut = BUBBLE_CUT;

      // 左上切角
      ctx.beginPath();
      ctx.moveTo(bx + cut, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx, by + cut);
      ctx.closePath();

      // 紫+青渐变背景
      const bgGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      bgGrad.addColorStop(0, 'rgba(155, 93, 229, 0.03)');
      bgGrad.addColorStop(1, 'rgba(0, 245, 212, 0.02)');
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // 边框
      ctx.strokeStyle = 'rgba(155, 93, 229, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 左边框加粗渐变
      const leftBorderGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      leftBorderGrad.addColorStop(0, RUNE_PURPLE);
      leftBorderGrad.addColorStop(1, RUNE_CYAN);
      ctx.beginPath();
      ctx.moveTo(bx, by + cut);
      ctx.lineTo(bx, by + bh);
      ctx.strokeStyle = leftBorderGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    return node;
  }

  // ==================== 渲染 ====================

  /**
   * 绘制导航栏、背景、Toast
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    // 右滑时补绘左侧背景（在平移坐标系内退回，防止黑边）
    if (this.x > 0) {
      ctx.save();
      ctx.translate(-this.x, 0);
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, this.x + 1, sh);
      const _swipeShadow = ctx.createLinearGradient(0, 0, this.x, 0);
      _swipeShadow.addColorStop(0, 'rgba(0,0,0,0.25)');
      _swipeShadow.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = _swipeShadow;
      ctx.fillRect(0, 0, this.x + 1, sh);
      ctx.restore();
    }

    const headerTop = this._statusBarHeight;

    // ====== 背景 ======
    ctx.fillStyle = BG_DARK;
    ctx.fillRect(0, 0, sw, sh);

    // 环境光
    const ambientGrad1 = ctx.createRadialGradient(
      sw * 0.5, sh, 0,
      sw * 0.5, sh, sw * 0.8
    );
    ambientGrad1.addColorStop(0, 'rgba(0, 245, 212, 0.03)');
    ambientGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad1;
    ctx.fillRect(0, 0, sw, sh);

    const ambientGrad2 = ctx.createRadialGradient(
      sw * 0.3, 0, 0,
      sw * 0.3, 0, sw * 0.6
    );
    ambientGrad2.addColorStop(0, 'rgba(155, 93, 229, 0.03)');
    ambientGrad2.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad2;
    ctx.fillRect(0, 0, sw, sh);

    // ====== 导航栏背景 ======
    const headerH = (headerTop + HEADER_HEIGHT);
    const headerGrad = ctx.createLinearGradient(0, 0, 0, headerH);
    headerGrad.addColorStop(0, 'rgba(10, 14, 39, 0.98)');
    headerGrad.addColorStop(1, 'rgba(10, 14, 39, 0.85)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, sw, headerH);

    // ====== 返回按钮 ======
    const btnR = 14;
    const btnCX = (12 + 14);
    const btnCY = (headerTop + HEADER_HEIGHT / 2);

    ctx.beginPath();
    ctx.arc(btnCX, btnCY, btnR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(0, 245, 212, 0.04)';
    ctx.fill();
    ctx.stroke();

    ctx.font = `${15}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uFF1C', btnCX, btnCY);

    // 未读红点
    if (this._hasUnreadChat) {
      ctx.beginPath();
      ctx.arc(btnCX + btnR * 0.7, btnCY - btnR * 0.7, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4757';
      ctx.fill();
    }

    // ====== 联系人信息（居中） ======
    const centerX = sw * 0.5;
    const centerY = (headerTop + HEADER_HEIGHT / 2);

    // 头像圆圈
    const avatarR = 14;
    const avatarCX = centerX - 30;

    ctx.beginPath();
    ctx.arc(avatarCX, centerY, avatarR, 0, Math.PI * 2);
    if (this._isEncrypted) {
      ctx.fillStyle = 'rgba(127, 140, 155, 0.06)';
      ctx.strokeStyle = 'rgba(127, 140, 155, 0.25)';
    } else {
      const avatarGrad = ctx.createLinearGradient(
        avatarCX - avatarR, centerY - avatarR,
        avatarCX + avatarR, centerY + avatarR
      );
      avatarGrad.addColorStop(0, 'rgba(0, 245, 212, 0.08)');
      avatarGrad.addColorStop(1, 'rgba(155, 93, 229, 0.06)');
      ctx.fillStyle = avatarGrad;
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';

      ctx.shadowColor = 'rgba(0, 245, 212, 0.1)';
      ctx.shadowBlur = 5;
    }
    ctx.fill();
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 头像 Emoji
    ctx.font = `${14}px ${FONT_PRIMARY}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._contactAvatar, avatarCX, centerY);

    // 联系人名字
    ctx.font = `bold ${15}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 245, 212, 0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(this._contactName, avatarCX + avatarR + 7, centerY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // ====== 流光线 ======
    const flowLineY = headerH;
    const flowGrad = ctx.createLinearGradient(0, 0, sw, 0);
    flowGrad.addColorStop(0, 'transparent');
    flowGrad.addColorStop(0.3, 'rgba(155, 93, 229, 0.08)');
    flowGrad.addColorStop(0.5, 'rgba(0, 245, 212, 0.12)');
    flowGrad.addColorStop(0.7, 'rgba(155, 93, 229, 0.08)');
    flowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flowGrad;
    ctx.fillRect(0, flowLineY, sw, 1);

    // 流光扫描
    const scanWidth = 60;
    const scanCycle = 4000;
    const scanPos = ((this._flowTimer % scanCycle) / scanCycle) * (sw + scanWidth) - scanWidth;
    const scanGrad = ctx.createLinearGradient(scanPos, 0, scanPos + scanWidth, 0);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.3, RUNE_CYAN);
    scanGrad.addColorStop(0.7, RUNE_PURPLE);
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(scanPos, flowLineY, scanWidth, 1);
    ctx.globalAlpha = 1;

    // ====== 收集 Toast ======
    if (this._collectToastVisible && this._collectToastAlpha > 0) {
      this._drawCollectToast(ctx);
    }
  }

  /**
   * 绘制收集成功 Toast
   * @private
   */
  _drawCollectToast(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const cx = sw / 2;
    const cy = sh / 2;

    ctx.save();
    ctx.globalAlpha = this._collectToastAlpha;

    const text = '\u25C8 已收集至证据板';
    ctx.font = `${FONT_SIZE_MD}px ${FONT_MONO}`;
    const textWidth = ctx.measureText(text).width;
    const padX = 24;
    const padY = 8;
    const toastW = textWidth + padX * 2;
    const toastH = FONT_SIZE_MD * 1.4 + padY * 2;
    const tx = cx - toastW / 2;
    const ty = cy - toastH / 2;

    // 菱形切角
    const cut = 8;
    ctx.beginPath();
    ctx.moveTo(tx + cut, ty);
    ctx.lineTo(tx + toastW - cut, ty);
    ctx.lineTo(tx + toastW, ty + toastH / 2);
    ctx.lineTo(tx + toastW - cut, ty + toastH);
    ctx.lineTo(tx + cut, ty + toastH);
    ctx.lineTo(tx, ty + toastH / 2);
    ctx.closePath();

    // 渐变背景
    const bgGrad = ctx.createLinearGradient(tx, ty, tx + toastW, ty + toastH);
    bgGrad.addColorStop(0, 'rgba(0, 245, 212, 0.1)');
    bgGrad.addColorStop(1, 'rgba(155, 93, 229, 0.06)');
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 发光
    ctx.shadowColor = 'rgba(0, 245, 212, 0.15)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 文字
    ctx.fillStyle = RUNE_CYAN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);

    ctx.restore();
  }

  /**
   * 每帧更新
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    this._flowTimer += dt;

    if (this._scrollView) {
      this._scrollView.update(dt);
    }

    // Toast 计时
    if (this._collectToastVisible) {
      this._collectToastTimer += dt;
      if (this._collectToastTimer < 150) {
        // 淡入
        this._collectToastAlpha = this._collectToastTimer / 150;
      } else if (this._collectToastTimer < 1050) {
        // 显示
        this._collectToastAlpha = 1;
      } else if (this._collectToastTimer < 1500) {
        // 淡出
        this._collectToastAlpha = 1 - (this._collectToastTimer - 1050) / 450;
      } else {
        this._collectToastVisible = false;
        this._collectToastAlpha = 0;
      }
    }
  }

  // ==================== 触摸事件 ====================

  onTouchStart(event) {
    if (event.changedTouches.length === 0) return;
    const touch = event.changedTouches[0];
    const x = touch.x;
    const y = touch.y;
    this._swipeStartX = x;
    this._swipeStartY = y;
    this._swipeActive = false;

    // Modal 拦截
    if (this._privacyModal && this._privacyModal.visible) {
      return;
    }

    // ScrollView
    if (this._scrollView && this._scrollView.containsPoint(x, y)) {
      this._scrollView.onTouchStart(y);
    }
  }

  onTouchMove(event) {
    if (event.changedTouches.length === 0) return;
    const touch = event.changedTouches[0];
    // 右滑手势
    if (!this._swipeActive && this._swipeStartX < 60) {
      const dx = touch.x - this._swipeStartX;
      const dy = touch.y - this._swipeStartY;
      if (dx > 10 && Math.abs(dx) > Math.abs(dy)) {
        this._swipeActive = true;
      }
    }
    if (this._swipeActive) {
      this.x = Math.max(0, touch.x - this._swipeStartX);
      return;
    }

    const y = touch.y;

    if (this._privacyModal && this._privacyModal.visible) return;

    if (this._scrollView) {
      this._scrollView.onTouchMove(y);
    }
  }

  onTouchEnd(event) {
    if (event.changedTouches.length === 0) return;
    const touch = event.changedTouches[0];
    // 右滑退出
    if (this._swipeActive) {
      this._swipeActive = false;
      const sw = this._screenWidth;
      if (this.x > sw * 0.35) {
        Tween.create(this).to({ x: sw }, 200, 'easeOut').call(() => {
          this.x = 0;
          this._goBack();
        }).start();
      } else {
        Tween.create(this).to({ x: 0 }, 180, 'easeOut').start();
      }
      return;
    }

    const x = touch.x;
    const y = touch.y;

    // Modal 拦截
    if (this._privacyModal && this._privacyModal.visible) {
      this._privacyModal.handleTap(x, y);
      return;
    }

    // 检查返回按钮
    const headerTop = this._statusBarHeight;
    const btnCX = 12 + 14;
    const btnCY = headerTop + HEADER_HEIGHT / 2;
    const dist = Math.sqrt((x - btnCX) ** 2 + (y - btnCY) ** 2);
    if (dist <= 20) {
      this._goBack();
      if (this._scrollView) this._scrollView.onTouchEnd();
      return;
    }

    // ScrollView
    if (this._scrollView) {
      const didScroll = this._scrollView.didScroll();
      this._scrollView.onTouchEnd();

      // 如果没有滚动，检查关键词点击
      if (!didScroll) {
        this._checkKeywordTap(x, y);
      }
    }
  }

  // ==================== 交互逻辑 ====================

  /**
   * 检查关键词点击
   * @private
   */
  _checkKeywordTap(x, y) {
    if (!this._scrollView) return;

    // 转换为 ScrollView 内部坐标
    const scrollLocalX = x;
    const scrollLocalY = y - this._scrollView.y + this._scrollView.scrollY;

    for (const item of this._messageNodes) {
      const { node, msg, index } = item;
      if (!node._richText) continue;

      // 检查是否在此消息节点范围内
      const nodeTop = node.y;
      const nodeBottom = node.y + node.height;
      if (scrollLocalY < nodeTop || scrollLocalY > nodeBottom) continue;

      // RichText 点击检测
      const richText = node._richText;
      const localX = scrollLocalX - richText.x;
      const localY = scrollLocalY - nodeTop - richText.y;

      // 在 hitAreas 中查找
      for (const area of richText._hitAreas) {
        if (localX >= area.x && localX <= area.x + area.width &&
            localY >= area.y && localY <= area.y + area.height) {
          this._collectKeyword(area.evidenceId, index, area.segIndex);
          return;
        }
      }
    }
  }

  /**
   * 收集关键词
   * @private
   */
  _collectKeyword(evidenceId, msgIndex, segIndex) {
    if (!evidenceId) return;

    // 检查是否已收集
    const msg = this._messages[msgIndex];
    if (msg && msg.segments && msg.segments[segIndex] && msg.segments[segIndex].collected) {
      return;
    }

    // 收集
    gameState.collectEvidence(evidenceId);

    // 振动
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) {}

    // 标记所有消息中相同 evidenceId 的关键词为已收集
    for (const m of this._messages) {
      if (!m.segments) continue;
      for (const seg of m.segments) {
        if (seg.type === 'keyword' && seg.evidenceId === evidenceId) {
          seg.collected = true;
        }
      }
    }

    // 更新 RichText 组件
    for (const item of this._messageNodes) {
      if (item.node._richText) {
        item.node._richText.markCollected(evidenceId);
      }
    }

    // 显示 Toast
    this._collectToastVisible = true;
    this._collectToastAlpha = 0;
    this._collectToastTimer = 0;
  }

  /**
   * 隐私提示 - 跳过（返回）
   * @private
   */
  _skipPrivate() {
    if (this._privacyModal) {
      this._privacyModal.hide(() => {
        this._goBack();
      });
    }
  }

  /**
   * 隐私提示 - 继续查看
   * @private
   */
  _continueViewing() {
    if (this._privacyModal) {
      this._privacyModal.hide();
    }
    this._showPrivacy = false;

    // 标记已读
    gameState.markViewed('Conversations', this._contactId);

    // 滚动到底部
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null;
      if (this._scrollView) {
        this._scrollView.scrollToBottom(true);
      }
    }, 300);
  }

  /**
   * 返回上一页
   * @private
   */
  _goBack() {
    if (this.engine) {
      this.engine.popScene();
    }
  }
}
