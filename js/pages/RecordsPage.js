/**
 * RecordsPage.js - 通讯记录列表页面
 * 继承 Scene，完整还原 records 页面
 * 自定义导航栏 + 联系人 ScrollView 列表 + 空状态提示
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { Tween } from '../engine/Tween.js';
import { ContactCard } from '../components/ContactCard.js';
import { ConversationPage } from './ConversationPage.js';
import gameState from '../core/GameState.js';
import { conversations } from '../data/story.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_AMBER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG, FONT_SIZE_XL,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL,
  ANIM_NORMAL,
} from '../style/StyleConfig.js';

/** 导航栏高度（不含状态栏） */
const HEADER_HEIGHT = 44;
/** 联系人卡片间距 */
const CARD_GAP = 10;
/** 列表左右内边距 */
const LIST_PADDING = 14;

export class RecordsPage extends Scene {
  constructor() {
    super();

    /** 屏幕尺寸（在 onEnter 中设置） */
    this._screenWidth = 0;
    this._screenHeight = 0;

    /** 状态栏高度 */
    this._statusBarHeight = 0;

    /** 是否有未读消息（返回按钮红点） */
    this._hasUnreadChat = false;

    /** 联系人数据列表 */
    this._contactList = [];

    /** ScrollView */
    this._scrollView = null;

    /** 联系人卡片组件列表 */
    this._cards = [];

    /** 空状态标签 */
    this._emptyLabel = null;
    this._emptyHintLabel = null;

    /** 流光线动画计时器 */
    this._flowTimer = 0;

    /** 闪烁动画计时器 */
    this._flickerTimer = 0;
  }

  // ==================== 生命周期 ====================

  onEnter() {
    const engine = this.engine;
    this._screenWidth = engine.getWidth();
    this._screenHeight = engine.getHeight();

    // 获取状态栏高度（微信小游戏环境）
    try {
      const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this._statusBarHeight = sysInfo.statusBarHeight || 22;
    } catch (e) {
      this._statusBarHeight = 22;
    }

    this.width = this._screenWidth;
    this.height = this._screenHeight;

    // 标记页面访问
    gameState.markPageVisited('records');

    // 检查未读消息
    this._hasUnreadChat = gameState.hasUnreadChat();

    // 加载联系人数据
    this._loadContacts();

    // 构建 UI
    this._buildUI();
  }

  onResume() {
    // 从会话页返回时刷新
    this._hasUnreadChat = gameState.hasUnreadChat();
    this._loadContacts();
    this._rebuildList();
  }

  onExit() {
    Tween.stopAll(this);
  }

  // ==================== 数据加载 ====================

  /**
   * 根据当前章节加载联系人列表
   * @private
   */
  _loadContacts() {
    const state = gameState.get();
    const currentChapter = typeof state.chapter === 'number' ? state.chapter : 0;

    this._contactList = Object.keys(conversations)
      .map(key => conversations[key])
      .filter(conv => {
        if (conv.chapter <= 0) return currentChapter >= 0;
        if (conv.chapter === 1) return state.ch1ContentUnlocked;
        return conv.chapter <= currentChapter;
      })
      .map(conv => ({
        id: conv.id,
        name: conv.name,
        avatar: conv.avatar,
        preview: this._getPreview(conv),
        isEncrypted: !!conv.isEncrypted,
        isPrivate: !!conv.isPrivate,
        isClue: !!conv.isClue,
        isViewed: gameState.isViewed('Conversations', conv.id),
      }));
  }

  /**
   * 从消息列表中提取最后一条有效消息作为预览
   * @private
   */
  _getPreview(conv) {
    if (!conv.messages || conv.messages.length === 0) return '';
    for (let i = conv.messages.length - 1; i >= 0; i--) {
      const msg = conv.messages[i];
      if (msg.sender === 'divider' || msg.sender === 'system') continue;
      if (msg.sender === 'encrypted') return '[ 部分内容已加密 ]';
      const firstLine = (msg.text || '').split('\n')[0];
      return firstLine.length > 20 ? firstLine.slice(0, 20) + '...' : firstLine;
    }
    return '';
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
    const headerTotal = headerTop + HEADER_HEIGHT;
    const listTop = headerTotal + 12; // 流光线 + 间距缓冲
    const cardWidth = sw - LIST_PADDING * 2;

    // ====== ScrollView ======
    this._scrollView = new ScrollView({
      width: sw,
      height: sh - listTop,
      contentHeight: 0,
      showScrollbar: true,
      bounceEnabled: true,
    });
    this._scrollView.x = 0;
    this._scrollView.y = listTop;
    this.addChild(this._scrollView);

    // 构建联系人列表
    this._buildContactList(cardWidth);

    // 空状态（如果列表为空）
    if (this._contactList.length === 0) {
      this._buildEmptyState();
    }
  }

  /**
   * 构建联系人卡片列表
   * @private
   */
  _buildContactList(cardWidth) {
    this._cards = [];
    let curY = SPACING_LG;

    for (const contact of this._contactList) {
      const card = new ContactCard({
        id: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        preview: contact.preview,
        isEncrypted: contact.isEncrypted,
        isPrivate: contact.isPrivate,
        isClue: contact.isClue,
        isViewed: contact.isViewed,
        cardWidth: cardWidth,
      });
      card.x = LIST_PADDING;
      card.y = curY;
      card.interactive = true;

      this._scrollView.addChild(card);
      this._cards.push(card);

      curY += card.height + CARD_GAP;
    }

    // 更新 scrollView 内容高度
    this._scrollView.contentHeight = curY + SPACING_XL;
  }

  /**
   * 构建空状态 UI
   * @private
   */
  _buildEmptyState() {
    const sw = this._screenWidth;

    this._emptyLabel = new Label({
      text: '暂无可查看的通讯记录',
      fontSize: FONT_SIZE_MD,
      color: TEXT_SECONDARY,
      textAlign: 'center',
    });
    this._emptyLabel.width = sw;
    this._emptyLabel.x = 0;
    this._emptyLabel.y = 120;
    this._scrollView.addChild(this._emptyLabel);

    this._emptyHintLabel = new Label({
      text: '等待渡鸦解密更多数据...',
      fontSize: FONT_SIZE_SM,
      color: TEXT_DIM,
      textAlign: 'center',
      fontFamily: 'Courier New, Menlo, monospace',
    });
    this._emptyHintLabel.width = sw;
    this._emptyHintLabel.x = 0;
    this._emptyHintLabel.y = 145;
    this._scrollView.addChild(this._emptyHintLabel);
  }

  /**
   * 刷新列表（onResume 时使用）
   * @private
   */
  _rebuildList() {
    if (!this._scrollView) return;
    this._scrollView.removeAllChildren();
    this._cards = [];
    const cardWidth = this._screenWidth - LIST_PADDING * 2;
    this._buildContactList(cardWidth);
    if (this._contactList.length === 0) {
      this._buildEmptyState();
    }
  }

  // ==================== 渲染 ====================

  /**
   * 绘制导航栏和背景（在子节点之前绘制）
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

    // 环境光（底部琥珀 + 顶部青色）
    const ambientGrad1 = ctx.createRadialGradient(
      sw * 0.5, sh, 0,
      sw * 0.5, sh, sw * 0.8
    );
    ambientGrad1.addColorStop(0, 'rgba(245, 166, 35, 0.04)');
    ambientGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad1;
    ctx.fillRect(0, 0, sw, sh);

    const ambientGrad2 = ctx.createRadialGradient(
      sw * 0.7, 0, 0,
      sw * 0.7, 0, sw * 0.6
    );
    ambientGrad2.addColorStop(0, 'rgba(0, 245, 212, 0.03)');
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

    // 返回箭头
    ctx.font = `${15}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uFF1C', btnCX, btnCY);

    // 未读消息红点
    if (this._hasUnreadChat) {
      ctx.beginPath();
      ctx.arc(btnCX + btnR * 0.7, btnCY - btnR * 0.7, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4757';
      ctx.fill();
    }

    // ====== 标题 ======
    const titleCX = sw * 0.5;
    const titleY = (headerTop + HEADER_HEIGHT / 2 - 8);

    // 装饰符
    ctx.font = `${11}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.globalAlpha = 0.6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const decoWidth = ctx.measureText('\u27E1').width;

    // 标题文字
    ctx.globalAlpha = 1;
    ctx.font = `bold ${17}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.6)';
    ctx.shadowBlur = 8;
    const titleText = '\u27E1 通讯记录';
    ctx.fillText(titleText, titleCX, titleY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 副标题
    ctx.font = `${9}px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('COMM RECORDS \u00B7 ALIAS', titleCX, titleY + 14);

    // 占位（右侧平衡）
    // 无需绘制

    // ====== 流光线 ======
    const flowLineY = headerH;
    const flowGrad = ctx.createLinearGradient(0, 0, sw, 0);
    flowGrad.addColorStop(0, 'transparent');
    flowGrad.addColorStop(0.3, 'rgba(245, 166, 35, 0.08)');
    flowGrad.addColorStop(0.5, 'rgba(0, 245, 212, 0.12)');
    flowGrad.addColorStop(0.7, 'rgba(245, 166, 35, 0.08)');
    flowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flowGrad;
    ctx.fillRect(0, flowLineY, sw, 1);

    // 流光扫描动画
    const scanWidth = 60;
    const scanCycle = 4000; // 4秒周期
    const scanPos = ((this._flowTimer % scanCycle) / scanCycle) * (sw + scanWidth) - scanWidth;
    const scanGrad = ctx.createLinearGradient(scanPos, 0, scanPos + scanWidth, 0);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.3, RUNE_CYAN);
    scanGrad.addColorStop(0.7, RUNE_AMBER);
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(scanPos, flowLineY, scanWidth, 1);
    ctx.globalAlpha = 1;
  }

  /**
   * 每帧更新
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    this._flowTimer += dt;
    this._flickerTimer += dt;

    // 更新 ScrollView
    if (this._scrollView) {
      this._scrollView.update(dt);
    }

    // 更新卡片动画
    for (const card of this._cards) {
      card.update(dt);
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

    // ScrollView 处理
    if (this._scrollView && this._scrollView.containsPoint(x, y)) {
      this._scrollView.onTouchStart(y);

      // 检查是否按下了卡片
      const scrollLocalY = y - this._scrollView.y + this._scrollView.scrollY;
      for (const card of this._cards) {
        if (scrollLocalY >= card.y && scrollLocalY <= card.y + card.height &&
            x >= card.x && x <= card.x + card.width) {
          card.onPressDown();
          this._pressedCard = card;
          break;
        }
      }
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

    if (this._scrollView) {
      this._scrollView.onTouchMove(y);

      // 如果发生滚动，取消卡片按下状态
      if (this._pressedCard && this._scrollView.didScroll()) {
        this._pressedCard.onPressUp();
        this._pressedCard = null;
      }
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

    // ScrollView 处理
    if (this._scrollView) {
      const didScroll = this._scrollView.didScroll();
      this._scrollView.onTouchEnd();

      // 如果没有滚动，检查卡片点击
      if (!didScroll && this._pressedCard) {
        this._pressedCard.onPressUp();
        this._tapContact(this._pressedCard.contactId);
        this._pressedCard = null;
        return;
      }

      if (this._pressedCard) {
        this._pressedCard.onPressUp();
        this._pressedCard = null;
      }
    }
  }

  // ==================== 交互逻辑 ====================

  /**
   * 点击联系人 → 进入对话页
   * @private
   */
  _tapContact(contactId) {
    if (!contactId || !conversations[contactId]) return;

    const page = new ConversationPage(contactId);
    this.engine.pushScene(page);
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
