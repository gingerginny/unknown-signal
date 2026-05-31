/**
 * ChatPage.js - 星河实时通讯页面
 * 继承 Scene，完整还原 chat 页面的所有 UI 和交互
 * 使用 ChatEngine 驱动消息流
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { EditBox } from '../engine/EditBox.js';
import { Tween } from '../engine/Tween.js';
import { MessageBubble } from '../components/MessageBubble.js';
import { Toast } from '../components/Toast.js';
import ChatEngine from '../core/ChatEngine.js';
import {
  RUNE_CYAN, RUNE_PURPLE, BG_DARK,
  TEXT_PRIMARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL,
  RADIUS_SM,
} from '../style/StyleConfig.js';

import { xingheDialogue } from '../data/story.js';

/** 导航栏高度（逻辑像素，与其他页面统一风格） */
const HEADER_HEIGHT = 56;
/** 信号状态条高度 */
const SIGNAL_BAR_HEIGHT = 20;
/** 输入区域高度 */
const INPUT_AREA_HEIGHT = 56;
/** 发送失败提示高度 */
const FAIL_HINT_HEIGHT = 20;
/** 消息区域内边距 */
const MSG_PADDING = 12;
/** 消息行间距 */
const MSG_GAP = 14;

export class ChatPage extends Scene {
  constructor() {
    super();

    /** @type {ChatEngine} 消息引擎 */
    this._chatEngine = null;

    /** @type {ScrollView} 消息滚动区域 */
    this._scrollView = null;

    /** @type {Node} 消息内容容器（ScrollView 的内容层） */
    this._msgContainer = null;

    /** @type {EditBox} 输入框 */
    this._editBox = null;

    /** @type {Toast} 证据收集提示 */
    this._toast = null;

    /** @type {MessageBubble[]} 消息气泡组件列表 */
    this._bubbles = [];

    /** @type {Node} 打字指示器 */
    this._typingIndicator = null;

    /** @type {boolean} 是否正在显示打字状态 */
    this._isTyping = false;

    /** @type {Label} 发送失败提示标签 */
    this._failHintLabel = null;

    /** @type {boolean} 是否显示发送失败提示 */
    this._showFailHint = false;

    /** @type {number} 信号灯闪烁计时器 */
    this._signalTimer = 0;

    /** @type {number} 信号灯透明度 */
    this._signalAlpha = 1;

    /** @type {number} 打字指示器动画计时器 */
    this._typingTimer = 0;

    /** @type {number[]} 三个打字圆点的透明度 */
    this._dotAlphas = [0.15, 0.15, 0.15];

    /** @type {number} 内容总高度 */
    this._contentHeight = 0;

    /** @type {number} 屏幕宽度 */
    this._screenWidth = 375;

    /** @type {number} 屏幕高度 */
    this._screenHeight = 667;

    /** @type {Node} 导航栏底部流光线节点 */
    this._flowLine = null;

    /** @type {number} 流光线动画偏移 */
    this._flowLineOffset = 0;
  }

  // ==================== 生命周期 ====================

  onEnter() {
    const engine = this.engine;
    this._screenWidth = engine.getWidth();
    this._screenHeight = engine.getHeight();

    // 获取状态栏高度和底部安全区
    try {
      const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this._statusBarHeight = sysInfo.statusBarHeight || 0;
      // 计算底部安全区高度（iPhone X 系列 home indicator）
      const safeArea = sysInfo.safeArea;
      if (safeArea) {
        this._safeAreaBottom = sysInfo.screenHeight - safeArea.bottom;
      } else {
        this._safeAreaBottom = 0;
      }
    } catch (e) {
      this._statusBarHeight = 0;
      this._safeAreaBottom = 0;
    }

    this.width = this._screenWidth;
    this.height = this._screenHeight;

    // 构建 UI
    this._buildBackground();
    this._buildHeader();
    this._buildMessageArea();
    this._buildInputArea();
    this._buildTypingIndicator();
    this._buildToast();

    // 初始化消息引擎
    this._chatEngine = new ChatEngine(xingheDialogue);
    this._bindEngineEvents();
    this._chatEngine.init();
  }

  onExit() {
    if (this._chatEngine) {
      this._chatEngine.destroy();
      this._chatEngine = null;
    }
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
    Tween.stopAll(this);
    // 清理子节点上的 Tween（如失败提示动画）
    if (this._failHintLabel) Tween.stopAll(this._failHintLabel);
    // 确保键盘关闭，防止事件泄漏
    if (this._editBox && this._editBox._isFocused) this._editBox.blur();
  }

  // ==================== UI 构建 ====================

  /**
   * 构建深蓝背景 + 环境光
   * @private
   */
  _buildBackground() {
    const bg = new Graphics();
    bg.clear()
      .beginPath()
      .rect(0, 0, this._screenWidth, this._screenHeight)
      .fill(BG_DARK);
    bg.width = this._screenWidth;
    bg.height = this._screenHeight;
    bg.zIndex = -10;
    this.addChild(bg);

    // 环境光容器（在 _draw 中通过自定义绘制实现渐变）
    this._ambientNode = new Node();
    this._ambientNode.width = this._screenWidth;
    this._ambientNode.height = this._screenHeight;
    this._ambientNode.zIndex = -5;
    // 自定义绘制环境光
    this._ambientNode._draw = (ctx) => {
      const w = this._screenWidth;
      const h = this._screenHeight;

      // 底部青色环境光
      const bottomGlow = ctx.createRadialGradient(
        w * 0.5, h, w * 0.4,
        w * 0.5, h, h * 0.4
      );
      bottomGlow.addColorStop(0, 'rgba(0, 245, 212, 0.04)');
      bottomGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = bottomGlow;
      ctx.fillRect(0, 0, w, h);

      // 顶部紫色环境光
      const topGlow = ctx.createRadialGradient(
        w * 0.3, 0, w * 0.2,
        w * 0.3, 0, h * 0.3
      );
      topGlow.addColorStop(0, 'rgba(155, 93, 229, 0.03)');
      topGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, w, h);
    };
    const engine = this.engine;
    this.addChild(this._ambientNode);
  }

  /**
   * 构建自定义导航栏
   * @private
   */
  _buildHeader() {
    const sbh = this._statusBarHeight || 0;
    const headerNode = new Node();
    headerNode.width = this._screenWidth;
    headerNode.height = sbh + HEADER_HEIGHT + SIGNAL_BAR_HEIGHT;
    headerNode.zIndex = 100;
    this.addChild(headerNode);

    // 导航栏半透明背景（含状态栏区域）
    const headerBg = new Graphics();
    headerBg.clear()
      .beginPath()
      .rect(0, 0, this._screenWidth, sbh + HEADER_HEIGHT + SIGNAL_BAR_HEIGHT)
      .fill('rgba(10, 14, 39, 0.95)');
    headerNode.addChild(headerBg);

    // 返回按钮（偏移状态栏高度）
    const backBtn = new Node();
    backBtn.x = 12;
    backBtn.y = sbh + 8;
    backBtn.width = 28;
    backBtn.height = 28;
    backBtn.interactive = true;
    backBtn.on('tap', () => {
      this._onBack();
    });
    headerNode.addChild(backBtn);

    // 返回按钮背景
    const backBtnBg = new Graphics();
    backBtnBg.clear()
      .beginPath()
      .arc(14, 14, 14, 0, Math.PI * 2)
      .fill('rgba(0, 245, 212, 0.04)')
      .beginPath()
      .arc(14, 14, 14, 0, Math.PI * 2)
      .stroke('rgba(0, 245, 212, 0.2)', 0.5);
    backBtn.addChild(backBtnBg);

    // 返回箭头
    const backArrow = new Label({
      text: '＜',
      fontSize: 15,
      color: RUNE_CYAN,
      textAlign: 'center',
    });
    backArrow.width = 28;
    backArrow.y = 5;
    backBtn.addChild(backArrow);

    // 标题区域（状态栏下方）
    const titleY = sbh + 10;

    // ψ 装饰符
    const psiLabel = new Label({
      text: 'ψ',
      fontSize: 12,
      color: RUNE_CYAN,
      textAlign: 'center',
      shadowColor: 'rgba(0, 245, 212, 0.5)',
      shadowBlur: 3,
    });
    psiLabel.width = 20;
    psiLabel.x = this._screenWidth / 2 - 75;
    psiLabel.y = titleY;
    headerNode.addChild(psiLabel);

    // 标题文字「实时通讯·星河」
    const titleLabel = new Label({
      text: '实时通讯 · 星河',
      fontSize: 15,
      color: TEXT_PRIMARY,
      textAlign: 'center',
      shadowLayers: [
        { color: 'rgba(0, 245, 212, 0.4)', blur: 4 },
        { color: 'rgba(0, 245, 212, 0.2)', blur: 8 },
      ],
    });
    titleLabel.width = this._screenWidth;
    titleLabel.y = titleY;
    headerNode.addChild(titleLabel);

    // 信号状态条
    const signalY = sbh + HEADER_HEIGHT - SIGNAL_BAR_HEIGHT + 4;

    // 信号灯（会闪烁，在 update 中更新透明度）
    this._signalDot = new Graphics();
    this._signalDot.x = this._screenWidth / 2 - 60;
    this._signalDot.y = signalY + 6;
    this._updateSignalDot();
    headerNode.addChild(this._signalDot);

    // 信号状态文字
    const sigLabel1 = new Label({
      text: 'SIG:不稳定',
      fontSize: FONT_SIZE_XS,
      color: TEXT_DIM,
      fontFamily: FONT_MONO,
    });
    sigLabel1.x = this._screenWidth / 2 - 50;
    sigLabel1.y = signalY + 2;
    headerNode.addChild(sigLabel1);

    const sigDivider = new Label({
      text: '│',
      fontSize: FONT_SIZE_XS,
      color: 'rgba(155, 93, 229, 0.25)',
    });
    sigDivider.x = this._screenWidth / 2 + 10;
    sigDivider.y = signalY + 2;
    headerNode.addChild(sigDivider);

    const sigLabel2 = new Label({
      text: 'CH:LIVE',
      fontSize: FONT_SIZE_XS,
      color: TEXT_DIM,
      fontFamily: FONT_MONO,
    });
    sigLabel2.x = this._screenWidth / 2 + 20;
    sigLabel2.y = signalY + 2;
    headerNode.addChild(sigLabel2);

    // 导航栏底部流光线
    this._flowLineNode = new Node();
    this._flowLineNode.x = 0;
    this._flowLineNode.y = sbh + HEADER_HEIGHT + SIGNAL_BAR_HEIGHT - 1;
    this._flowLineNode.width = this._screenWidth;
    this._flowLineNode.height = 1;
    const self = this;
    this._flowLineNode._draw = function(ctx) {
      const w = self._screenWidth;

      // 静态渐变基线
      const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
      lineGrad.addColorStop(0, 'transparent');
      lineGrad.addColorStop(0.3, 'rgba(155, 93, 229, 0.08)');
      lineGrad.addColorStop(0.5, 'rgba(0, 245, 212, 0.12)');
      lineGrad.addColorStop(0.7, 'rgba(155, 93, 229, 0.08)');
      lineGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lineGrad;
      ctx.fillRect(0, 0, w, 1);

      // 扫描光点（动画）
      const scanWidth = 60;
      const scanX = (self._flowLineOffset % (w + scanWidth)) - scanWidth;
      const scanGrad = ctx.createLinearGradient(scanX, 0, scanX + scanWidth, 0);
      scanGrad.addColorStop(0, 'transparent');
      scanGrad.addColorStop(0.3, RUNE_CYAN);
      scanGrad.addColorStop(0.7, RUNE_PURPLE);
      scanGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(scanX, 0, scanWidth, 1);
    };
    headerNode.addChild(this._flowLineNode);

    this._headerNode = headerNode;
  }

  /**
   * 构建消息滚动区域
   * @private
   */
  _buildMessageArea() {
    const topOffset = (this._statusBarHeight || 0) + HEADER_HEIGHT + SIGNAL_BAR_HEIGHT;
    const bottomOffset = INPUT_AREA_HEIGHT + (this._safeAreaBottom || 0);
    const areaHeight = this._screenHeight - topOffset - bottomOffset;

    this._scrollView = new ScrollView({
      width: this._screenWidth,
      height: areaHeight,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });
    this._scrollView.x = 0;
    this._scrollView.y = topOffset;
    this._scrollView.zIndex = 1;
    this._scrollView.interactive = true;

    // 注册触摸事件用于滚动
    this._scrollView.on('touchstart', (e) => {
      this._scrollView.onTouchStart(e.y - this._scrollView.y);
      e.stopPropagation();
    });
    this._scrollView.on('touchmove', (e) => {
      this._scrollView.onTouchMove(e.y - this._scrollView.y);
      e.stopPropagation();
    });
    this._scrollView.on('touchend', (e) => {
      this._scrollView.onTouchEnd();
      // 如果没有发生滚动，检测关键词点击
      if (!this._scrollView.didScroll()) {
        this._handleMessageTap(e.x, e.y);
      }
    });

    this.addChild(this._scrollView);

    // 消息内容容器
    this._msgContainer = new Node();
    this._msgContainer.x = 0;
    this._msgContainer.y = MSG_PADDING;
    this._scrollView.addChild(this._msgContainer);

    this._contentHeight = MSG_PADDING;
  }

  /**
   * 构建输入区域
   * @private
   */
  _buildInputArea() {
    const safeBottom = this._safeAreaBottom || 0;
    const inputAreaY = this._screenHeight - INPUT_AREA_HEIGHT - safeBottom;

    // 输入区域背景
    const inputBg = new Node();
    inputBg.x = 0;
    inputBg.y = inputAreaY;
    inputBg.width = this._screenWidth;
    inputBg.height = INPUT_AREA_HEIGHT + FAIL_HINT_HEIGHT;
    inputBg.zIndex = 50;
    const self = this;
    inputBg._draw = function(ctx) {
      const w = self._screenWidth;
      const h = (INPUT_AREA_HEIGHT + FAIL_HINT_HEIGHT);

      // 渐变背景
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.2, 'rgba(10, 14, 39, 0.9)');
      grad.addColorStop(1, 'rgba(10, 14, 39, 0.98)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };
    this.addChild(inputBg);

    // 输入栏容器
    const barX = 12;
    const barY = inputAreaY + 8;
    const barWidth = this._screenWidth - 24;
    const barHeight = 36;

    // 输入栏背景（切角样式）
    const barBg = new Node();
    barBg.x = barX;
    barBg.y = barY;
    barBg.width = barWidth;
    barBg.height = barHeight;
    barBg.zIndex = 51;
    barBg._draw = function(ctx) {
      const w = barWidth;
      const h = barHeight;
      const cut = 8;

      // 背景
      ctx.beginPath();
      ctx.moveTo(cut, 0);
      ctx.lineTo(w - cut, 0);
      ctx.lineTo(w, cut);
      ctx.lineTo(w, h - cut);
      ctx.lineTo(w - cut, h);
      ctx.lineTo(cut, h);
      ctx.lineTo(0, h - cut);
      ctx.lineTo(0, cut);
      ctx.closePath();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };
    this.addChild(barBg);

    // 输入提示符 ›
    const promptLabel = new Label({
      text: '›',
      fontSize: FONT_SIZE_MD,
      color: 'rgba(155, 93, 229, 0.5)',
      fontFamily: FONT_MONO,
    });
    promptLabel.x = barX + 10;
    promptLabel.y = barY + (barHeight - FONT_SIZE_MD) / 2;
    promptLabel.zIndex = 52;
    this.addChild(promptLabel);

    // 输入框
    this._editBox = new EditBox({
      placeholder: '输入消息…',
      placeholderColor: '#3a4a5a',
      fontSize: FONT_SIZE_MD,
      color: '#c8d6e5',
      bgColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      cornerRadius: 0,
      paddingX: 0,
      width: barWidth - 65,
      height: barHeight,
    });
    this._editBox.x = barX + 24;
    this._editBox.y = barY;
    this._editBox.zIndex = 53;
    this._editBox.interactive = true;
    this._editBox.on('tap', () => {
      this._editBox.onTap();
    });
    this._editBox.on('confirm', (e) => {
      this._onSend();
    });
    this.addChild(this._editBox);

    // 发送按钮（六边形）
    const sendBtnSize = 28;
    const sendBtn = new Node();
    sendBtn.x = barX + barWidth - sendBtnSize - 8;
    sendBtn.y = barY + (barHeight - sendBtnSize) / 2;
    sendBtn.width = sendBtnSize;
    sendBtn.height = sendBtnSize;
    sendBtn.interactive = true;
    sendBtn.zIndex = 54;
    sendBtn._draw = function(ctx) {
      const s = sendBtnSize;
      const cx = s / 2;
      const cy = s / 2;
      const r = s / 2;

      // 六边形路径
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      ctx.fillStyle = 'rgba(0, 245, 212, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 上箭头
      ctx.fillStyle = RUNE_CYAN;
      ctx.font = `${FONT_SIZE_MD}px ${FONT_PRIMARY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↑', cx, cy);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    };
    sendBtn.on('tap', () => {
      this._onSend();
    });
    this.addChild(sendBtn);

    // 发送失败提示
    this._failHintLabel = new Label({
      text: '⚠ 跨维信号中断，发送失败',
      fontSize: FONT_SIZE_SM - 1,
      color: '#ef4444',
      fontFamily: FONT_MONO,
      textAlign: 'center',
      shadowColor: 'rgba(239, 68, 68, 0.3)',
      shadowBlur: 4,
    });
    this._failHintLabel.width = this._screenWidth;
    this._failHintLabel.x = 0;
    this._failHintLabel.y = inputAreaY + INPUT_AREA_HEIGHT - 8;
    this._failHintLabel.zIndex = 55;
    this._failHintLabel.visible = false;
    this._failHintLabel.alpha = 0;
    this.addChild(this._failHintLabel);
  }

  /**
   * 构建打字指示器（三个脉冲圆点）
   * @private
   */
  _buildTypingIndicator() {
    this._typingNode = new Node();
    this._typingNode.visible = false;
    this._typingNode.width = this._screenWidth;
    this._typingNode.height = 40;

    const self = this;
    this._typingNode._draw = function(ctx) {
      const padding = MSG_PADDING;

      // 头像背景
      const avatarX = padding;
      const avatarSize = 36;
      const avatarCX = avatarX + avatarSize / 2;
      const avatarCY = avatarSize / 2;

      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 245, 212, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 头像 emoji
      ctx.font = `${18}px ${FONT_PRIMARY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', avatarCX, avatarCY);

      // 气泡
      const bubbleX = (padding + avatarSize + 8);
      const bubbleW = 60;
      const bubbleH = 30;
      const cut = 8;

      ctx.beginPath();
      ctx.moveTo(bubbleX + cut, 3);
      ctx.lineTo(bubbleX + bubbleW, 3);
      ctx.lineTo(bubbleX + bubbleW, 3 + bubbleH);
      ctx.lineTo(bubbleX, 3 + bubbleH);
      ctx.lineTo(bubbleX, 3 + cut);
      ctx.closePath();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 三个脉冲圆点
      const dotRadius = 3;
      const dotY = 3 + bubbleH / 2;
      const dotStartX = bubbleX + 14;
      const dotGap = 12;

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(dotStartX + i * dotGap, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = RUNE_CYAN;
        ctx.globalAlpha = self._dotAlphas[i];
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 重置
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    };

    // 打字指示器不加入 ScrollView 子节点，会在 _updateTypingPosition 中动态定位
    this._scrollView.addChild(this._typingNode);
  }

  /**
   * 构建证据收集 Toast
   * @private
   */
  _buildToast() {
    this._toast = new Toast({
      parentWidth: this._screenWidth,
      parentHeight: this._screenHeight,
    });
    this._toast.zIndex = 500;
    this.addChild(this._toast);
  }

  // ==================== 信号灯更新 ====================

  /**
   * 更新信号灯绘制
   * @private
   */
  _updateSignalDot() {
    this._signalDot.clear()
      .beginPath()
      .arc(3, 3, 3, 0, Math.PI * 2)
      .shadow(RUNE_CYAN, 4)
      .fill(RUNE_CYAN)
      .noShadow();
  }

  // ==================== 引擎事件绑定 ====================

  /**
   * 绑定 ChatEngine 的事件
   * @private
   */
  _bindEngineEvents() {
    const engine = this._chatEngine;

    // 历史消息加载
    engine.on('historyLoaded', (messages) => {
      this._loadMessages(messages);
    });

    // 新消息推送
    engine.on('message', (msg) => {
      this._addMessage(msg);
    });

    // 打字状态变化
    engine.on('typing', (isTyping) => {
      this._setTyping(isTyping);
    });

    // 滚动到底部
    engine.on('scrollToBottom', () => {
      this._scrollToBottom();
    });

    // 发送失败提示
    engine.on('sendFailed', (show) => {
      this._showSendFailed(show);
    });

    // 证据收集提示
    engine.on('collectToast', (show) => {
      if (show) {
        this._toast.show();
        try {
          wx.vibrateShort({ type: 'light' });
        } catch (e) {
          // 振动 API 不可用时静默忽略
        }
      }
    });
  }

  // ==================== 消息管理 ====================

  /**
   * 加载历史消息列表（批量）
   * @private
   * @param {Array} messages
   */
  _loadMessages(messages) {
    // 清空现有气泡
    this._bubbles.forEach(b => b.removeFromParent());
    this._bubbles = [];
    this._contentHeight = MSG_PADDING;

    // 批量添加
    messages.forEach((msg, idx) => {
      this._createBubble(msg, idx, false);
    });

    this._updateScrollContent();
    this._scrollToBottom(false);
  }

  /**
   * 添加单条新消息
   * @private
   * @param {Object} msg
   */
  _addMessage(msg) {
    const idx = this._bubbles.length;
    this._createBubble(msg, idx, true);
    this._updateScrollContent();
    this._scrollToBottom(true);
  }

  /**
   * 创建消息气泡并添加到容器
   * @private
   * @param {Object} msg - 消息数据
   * @param {number} index - 消息索引
   * @param {boolean} animated - 是否有淡入动画
   */
  _createBubble(msg, index, animated) {
    const bubble = new MessageBubble({
      type: msg.type,
      text: msg.text || '',
      segments: msg.segments || null,
      containerWidth: this._screenWidth,
      msgIndex: index,
    });

    bubble.x = 0;
    bubble.y = this._contentHeight;

    // 初始高度估算（真实高度在首次渲染时确定）
    const estimatedHeight = this._estimateHeight(msg);
    bubble.height = estimatedHeight;

    this._msgContainer.addChild(bubble);
    this._bubbles.push(bubble);

    // 更新内容高度
    this._contentHeight += estimatedHeight + MSG_GAP;

    // 淡入动画
    if (animated) {
      bubble.alpha = 0;
      bubble.y += 15;
      Tween.create(bubble)
        .to({ alpha: 1, y: bubble.y - 15 }, 300, 'easeOut')
        .start();
    }
  }

  /**
   * 估算消息高度
   * @private
   * @param {Object} msg
   * @returns {number}
   */
  _estimateHeight(msg) {
    if (msg.type === 'system') {
      return 30;
    }

    // 基于文字长度估算
    const text = msg.text || '';
    const maxCharsPerLine = Math.floor((BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2) / FONT_SIZE_MD);
    const lineCount = Math.max(1, Math.ceil(text.length / maxCharsPerLine));
    return lineCount * FONT_SIZE_MD * 1.7 + BUBBLE_PADDING_Y * 2 + SPACING_MD;
  }

  /**
   * 更新 ScrollView 的内容高度
   * @private
   */
  _updateScrollContent() {
    this._scrollView.contentHeight = this._contentHeight + MSG_PADDING;
    // 同步更新容器高度，否则 ScrollView 虚拟列表会在滚动后判定容器不可见
    this._msgContainer.height = this._contentHeight + MSG_PADDING;
  }

  /**
   * 滚动到底部
   * @private
   * @param {boolean} [animated=true]
   */
  _scrollToBottom(animated = true) {
    // 使用延迟以确保布局已更新
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null;
      this._scrollView.scrollToBottom(animated);
    }, 50);
  }

  // ==================== 打字状态 ====================

  /**
   * 设置打字状态
   * @private
   * @param {boolean} isTyping
   */
  _setTyping(isTyping) {
    this._isTyping = isTyping;
    this._typingNode.visible = isTyping;

    if (isTyping) {
      this._typingNode.y = this._contentHeight;
      this._typingTimer = 0;
      // 临时扩展 contentHeight，让 scrollToBottom 能滚到打字指示器位置
      const h = this._contentHeight + 54 + MSG_PADDING;
      this._scrollView.contentHeight = h;
      this._msgContainer.height = h;
    } else {
      // 恢复正常高度
      this._updateScrollContent();
    }
  }

  // ==================== 交互处理 ====================

  /**
   * 返回上一页
   * @private
   */
  _draw(ctx) {
    // 右滑时补绘左侧背景
    if (this.x > 0) {
      const sh = this._screenHeight || 667;
      ctx.save();
      ctx.translate(-this.x, 0);
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, this.x + 1, sh);
      const _swipeShadow = ctx.createLinearGradient(0, 0, this.x, 0);
      _swipeShadow.addColorStop(0, 'rgba(0,0,0,0.25)');
      _swipeShadow.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = _swipeShadow;
      ctx.fillRect(0, 0, this.x + 1, sh);
      ctx.restore();
    }
  }

  onTouchStart(event) {
    super.onTouchStart(event);
    if (event.changedTouches && event.changedTouches.length > 0) {
      const t = event.changedTouches[0];
      this._swipeStartX = t.x;
      this._swipeStartY = t.y;
      this._swipeActive = false;
    }
  }

  onTouchMove(event) {
    if (event.changedTouches && event.changedTouches.length > 0) {
      const t = event.changedTouches[0];
      const dx = t.x - this._swipeStartX;
      const dy = t.y - this._swipeStartY;
      if (!this._swipeActive && this._swipeStartX < 60 && dx > 10 && Math.abs(dx) > Math.abs(dy)) {
        this._swipeActive = true;
      }
      if (this._swipeActive) {
        this.x = Math.max(0, dx);
        return;
      }
    }
    super.onTouchMove(event);
  }

  onTouchEnd(event) {
    if (this._swipeActive) {
      this._swipeActive = false;
      const sw = this._screenWidth || 375;
      if (this.x > sw * 0.35) {
        Tween.create(this).to({ x: sw }, 200, 'easeOut').call(() => {
          this.x = 0;
          this._onBack();
        }).start();
      } else {
        Tween.create(this).to({ x: 0 }, 180, 'easeOut').start();
      }
      return;
    }
    super.onTouchEnd(event);
  }

    _onBack() {
    if (this.engine) {
      this.engine.popScene();
    }
  }

  /**
   * 发送消息（始终失败）
   * @private
   */
  _onSend() {
    const text = this._editBox.text;
    if (!text || !text.trim()) return;

    this._editBox.clear();
    if (this._editBox._isFocused) {
      this._editBox.blur();
    }

    // 委托给引擎处理
    this._chatEngine.handleSend(text);
  }

  /**
   * 显示/隐藏发送失败提示
   * @private
   * @param {boolean} show
   */
  _showSendFailed(show) {
    this._showFailHint = show;
    if (show) {
      this._failHintLabel.visible = true;
      Tween.stopAll(this._failHintLabel);
      Tween.create(this._failHintLabel)
        .to({ alpha: 0.9 }, 200, 'easeOut')
        .start();
    } else {
      Tween.stopAll(this._failHintLabel);
      Tween.create(this._failHintLabel)
        .to({ alpha: 0 }, 200, 'easeIn')
        .call(() => {
          this._failHintLabel.visible = false;
        })
        .start();
    }
  }

  /**
   * 处理消息区域的点击（检测关键词命中）
   * @private
   * @param {number} tapX - 逻辑 X 坐标
   * @param {number} tapY - 逻辑 Y 坐标
   */
  _handleMessageTap(tapX, tapY) {
    // 将触摸坐标转换为 _msgContainer 本地坐标
    // tapY → scrollView content → msgContainer local（减去 MSG_PADDING 因为 _msgContainer.y = MSG_PADDING）
    const contentY = tapY - this._scrollView.y + this._scrollView.scrollY - MSG_PADDING;
    const contentX = tapX - (this._scrollView.x || 0);

    // 遍历气泡检测命中
    for (let i = this._bubbles.length - 1; i >= 0; i--) {
      const bubble = this._bubbles[i];
      if (!bubble.richText) continue;

      // 转换为气泡本地坐标
      const localX = contentX - bubble.x;
      const localY = contentY - bubble.y;
      if (localY < 0 || localY > bubble.height) continue;
      if (localX < 0 || localX > bubble.width) continue;

      const hit = bubble.hitTestKeyword(localX, localY);
      if (hit && hit.evidenceId) {
        // 收集关键词
        this._chatEngine.collectKeyword(hit.msgIndex, hit.segIndex, hit.evidenceId);

        // 标记所有含相同 evidenceId 的气泡
        this._bubbles.forEach(b => {
          b.markKeywordCollected(hit.evidenceId);
        });
        break;
      }
    }
  }

  // ==================== 每帧更新 ====================

  /**
   * 每帧更新
   * @param {number} dt - 帧间隔（毫秒）
   */
  update(dt) {
    // 更新子节点
    super.update(dt);

    // 信号灯闪烁动画
    this._signalTimer += dt;
    const flickerCycle = 2500;
    const t = (this._signalTimer % flickerCycle) / flickerCycle;
    // 模拟原始 CSS 动画的闪烁模式
    if (t < 0.45) {
      this._signalAlpha = 1;
    } else if (t < 0.5) {
      this._signalAlpha = 0.3;
    } else if (t < 0.55) {
      this._signalAlpha = 0.9;
    } else if (t < 0.7) {
      this._signalAlpha = 1;
    } else if (t < 0.85) {
      this._signalAlpha = 0.4 + (t - 0.7) / 0.15 * 0.6;
    } else {
      this._signalAlpha = 1;
    }
    this._signalDot.alpha = this._signalAlpha;

    // 流光线动画
    this._flowLineOffset += dt * 0.08;

    // 打字指示器圆点脉冲动画
    if (this._isTyping) {
      this._typingTimer += dt;
      const dotCycle = 1400;
      for (let i = 0; i < 3; i++) {
        const phase = (this._typingTimer - i * 300) / dotCycle;
        const normalizedPhase = ((phase % 1) + 1) % 1;
        // 0.3~0.5 区间为高亮
        if (normalizedPhase >= 0.2 && normalizedPhase <= 0.5) {
          this._dotAlphas[i] = 0.15 + (1 - 0.15) * Math.sin((normalizedPhase - 0.2) / 0.3 * Math.PI);
        } else {
          this._dotAlphas[i] = 0.15;
        }
      }
    }

    // 更新 ScrollView 物理
    if (this._scrollView) {
      this._scrollView.update(dt);
    }

    // 重新计算气泡位置（如果高度变化）
    this._relayoutBubbles();
  }

  /**
   * 重新排列气泡位置
   * 在气泡首次渲染后，其高度可能与估算值不同，需要重排
   * @private
   */
  _relayoutBubbles() {
    const sv = this._scrollView;
    // 视口裁剪范围（相对于 _msgContainer 的 Y 坐标空间）
    const visTop = sv ? sv.scrollY - MSG_PADDING - 60 : 0;
    const visBottom = sv ? sv.scrollY + sv.height + 60 : Infinity;

    let y = 0;
    let changed = false;

    for (const bubble of this._bubbles) {
      if (Math.abs(bubble.y - y) > 1) {
        bubble.y = y;
        changed = true;
      }
      const h = bubble.getHeight();
      y += (h > 0 ? h : 40) + MSG_GAP;

      // 视口外的气泡跳过渲染（不影响布局计算）
      bubble.visible = (bubble.y + h >= visTop) && (bubble.y <= visBottom);
    }

    if (changed || Math.abs(y - this._contentHeight) > 1) {
      this._contentHeight = y;
      this._updateScrollContent();
    }
  }
}

// 与 MessageBubble.js 中一致的常量（用于高度估算）
const BUBBLE_MAX_WIDTH = 270;
const BUBBLE_PADDING_X = 14;
const BUBBLE_PADDING_Y = 10;
