/**
 * EvidencePage.js - 证据板页面（搜索 + 推理系统）
 * 继承 Scene，完整还原 evidence 页面
 *
 * 页面结构：
 * - 自定义导航栏：返回按钮 + 标题「证据板」
 * - Tab 栏：「线索」|「推理」（ch3 解锁推理 Tab）
 * - 线索 Tab：搜索引擎浮窗 + 证据卡片列表
 * - 推理 Tab：3D 球面投影 + 推理匹配 + 逻辑链路
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { EditBox } from '../engine/EditBox.js';
import { Button } from '../engine/Button.js';
import { Tween } from '../engine/Tween.js';
import { Modal } from '../components/Modal.js';
import { Toast } from '../components/Toast.js';
import CustomHeader from '../components/CustomHeader.js';
import EvidenceCard from '../components/EvidenceCard.js';
import gameState from '../core/GameState.js';
import { evidenceList, searchDB, reasoningCombos } from '../data/story.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_PURPLE, RUNE_RED, RUNE_AMBER,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG, FONT_SIZE_XL,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL, SPACING_XXL,
  ANIM_FAST, ANIM_NORMAL, ANIM_SLOW,
  GLOW_CYAN_40, GLOW_CYAN_80,
} from '../style/StyleConfig.js';
import { drawGlowText, drawGlowLine, drawGlowRect, drawGlowCircle } from '../effects/GlowEffect.js';

// ====== 3D 球体参数 ======
const SPHERE_RADIUS = 110;        // 逻辑像素半径
const SPHERE_CENTER_X = 150;      // 球心 X（容器内）
const SPHERE_CENTER_Y = 150;      // 球心 Y（容器内）
const PROJECTION_DEPTH = 200;     // 投影深度
const ROTATION_SPEED = 0.006;     // 旋转速度系数
const INERTIA_DECAY = 0.88;       // 惯性衰减
const SPHERE_AREA_SIZE = 300;     // 球体容器尺寸（逻辑像素）

// ====== 导航栏 ======
const HEADER_HEIGHT = 44;
const TAB_HEIGHT = 32;

// ====== 搜索引擎 ======
const SEARCH_PANEL_PADDING = 14;
/** 搜索面板基础高度（无搜索结果时） */
const SEARCH_PANEL_BASE_H = 82;
/** 搜索结果展开后的额外高度 */
const SEARCH_RESULT_EXTRA_H = 88;

/** 搜索结果附加图片映射（evidenceId → 图片路径） */
const RESULT_IMAGE_MAP = {
  x_structure: 'res/images/x.png',
};

export class EvidencePage extends Scene {
  constructor({ initialTab } = {}) {
    super();

    // 屏幕尺寸
    this._screenWidth = 0;
    this._screenHeight = 0;
    this._statusBarHeight = 0;

    // ===== Tab 切换 =====
    this._currentTab = initialTab || 'clues';   // 'clues' | 'reasoning'
    this._showReasoningTab = false;
    this._tabUnderlineX = 0;      // Tab 下划线 X 位置（动画用）

    // ===== 线索 Tab =====
    this._collectedEvidence = [];
    this._evidenceCards = [];
    this._clueScrollView = null;

    // 搜索引擎状态
    this._searchQuery = '';
    this._lastSearchQuery = '';
    this._searchResult = '';
    this._searchResultType = '';   // 'normal' | 'none' | 'restricted' | 'death_gravity'
    this._hasSearched = false;
    this._searchEditBox = null;
    this._searchBtn = null;
    this._resultImage = null;      // wx.createImage 实例，搜索结果附图
    this._resultImageLoaded = false;

    // 搜索结果滚动状态
    this._resultScrollY = 0;
    this._resultMaxScrollY = 0;
    this._resultDragging = false;
    this._resultLastTouchY = 0;
    this._resultVelocity = 0;

    // 触摸路由目标：记录 touchStart 时命中的区域，move/end 始终路由到同一目标
    this._cluesTouchTarget = null; // 'list' | 'result' | 'search' | null
    this._cluesTouchStartX = 0;
    this._cluesTouchStartY = 0;

    // 死亡引力特效
    this._showRedFlash = false;
    this._redFlashAlpha = 0;
    this._redFlashTimer = 0;
    this._searchBoxRed = false;
    this._searchBoxRedTimer = 0;

    // ===== 推理 Tab =====
    this._reasoningMode = 'relate';  // 'relate' | 'contradict'
    this._sphereItems = [];          // 3D 球面上的气泡数据
    this._selectedBubbles = [];      // 已选气泡 [{id, name}] 最多 2 个
    this._canReason = false;

    // 提示卡片系统
    this._hintCardVisible = false;    // 持续显示的提示卡片
    this._hintCardText = '';          // 卡片文字
    this._hintTargetComboIdx = -1;    // 正在被提示的推理组合索引
    this._hintStage = 0;              // 0=无提示, 1=卡片, 2=卡片+词条0发光, 3=卡片+双词条发光
    this._hintFailsSinceCard = 0;     // 卡片出现后的失败次数
    this._hintFailsSinceBubble0 = 0;  // 词条0发光后的失败次数
    this._hintBubble0Id = '';         // 第一个引导词条 ID
    this._hintBubble1Id = '';         // 第二个引导词条 ID

    // 缺少词条提示（中央浮现）
    this._missingMsgVisible = false;
    this._missingMsgAlpha = 0;
    this._missingMsgTimer = 0;
    this._missingMsgText = '';
    this._missingDeathGravityCount = 0;

    // 球体旋转状态
    this._lastTouch = null;
    this._velocityX = 0;
    this._velocityY = 0;
    this._isInertiaActive = false;

    // 自动旋转
    this._hasAutoRotated = false;
    this._autoRotateTimer = 0;
    this._autoRotateDuration = 1500;
    this._showOrbitHint = false;
    this._orbitHintAlpha = 1;

    // 推理结果弹窗
    this._showResultOverlay = false;
    this._resultTitle = '';
    this._resultFullText = '';
    this._resultDisplayText = '';
    this._resultTypingIndex = 0;
    this._resultTypingTimer = 0;
    this._resultCloseBtnRect = null; // { x, y, w, h }

    // 气泡预览弹窗
    this._showBubblePreview = false;
    this._previewBubble = null;
    this._previewAlpha = 0;
    this._previewCardRect = null;     // { x, y, w, h } 底部卡片区域
    this._previewSelectBtnRect = null; // { x, y, w, h } 选择按钮区域

    // 逻辑链路
    this._logicChain = [];
    this._completedCount = 0;

    // 逻辑链路 ScrollView
    this._chainScrollView = null;

    // Toast
    this._toast = null;

    // 证据卡片浮层详情
    this._cardDetailVisible = false;
    this._cardDetailName = '';
    this._cardDetailText = '';
    this._cardDetailOverlayY = 0;
    // 右滑拖拽状态
    this._swipeStartX = 0;
    this._swipeStartY = 0;
    this._swipeActive = false;

    // 未读消息
    this._hasUnreadChat = false;

    // 搜索结果 ScrollView
    this._searchResultScrollView = null;

    // 卡片实际高度就绪后重新排列的标记
    this._needsRelayout = false;
    this._lastRelayoutReadyCount = 0;

    // 脏标记：false 时引擎跳过本帧 clearRect+render
    this._isDirty = true;

    // ===== 法司大人封锁序列 =====
    this._lockdownActive = false;
    this._lockdownTimer = 0;
    this._pendingLockdown = false;
    this._lockdownPhaseDone = false;
    this._lockdownBanner1Y = -70;
    this._lockdownBanner1Alpha = 0;
    this._lockdownBanner2Y = -70;
    this._lockdownBanner2Alpha = 0;
    this._lockdownOverlayAlpha = 0;
    this._lockdownWarningAlpha = 0;
    this._lockdownTypingText = '';
    this._lockdownTypingIdx = 0;
    this._lockdownTypingTimer = 0;
    this._lockdownScrollX = 0;
    this._lockdownTriPhase = 0;
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

    // 标记页面访问
    gameState.markPageVisited('evidence');
    this._hasUnreadChat = gameState.hasUnreadChat();

    // 加载数据
    this._loadEvidence();
    this._checkReasoningTab();

    // 构建 UI
    this._buildUI();
  }

  onResume() {
    this._hasUnreadChat = gameState.hasUnreadChat();
    this._loadEvidence();
    this._checkReasoningTab();
    this._rebuildClueList();
    this._isDirty = true;
  }

  onExit() {
    Tween.stopAll(this);
  }

  // ==================== 数据加载 ====================

  /** 加载已收集的证据列表 */
  _loadEvidence() {
    const state = gameState.get();
    const collectedIds = state.collectedEvidence || [];
    const viewedCards = state.viewedEvidenceCards || [];

    this._collectedEvidence = collectedIds
      .filter(id => evidenceList[id])
      .map(id => ({
        id,
        name: evidenceList[id].name,
        chapter: evidenceList[id].chapter,
        desc: evidenceList[id].desc,
        isNew: !viewedCards.includes(id),
      }));
  }

  /** 检查推理 Tab 是否解锁 */
  _checkReasoningTab() {
    const state = gameState.get();
    this._showReasoningTab = state.chapter >= 3;
  }

  // ==================== UI 构建 ====================

  _buildUI() {
    const sw = this._screenWidth;
    const sh = this._screenHeight;

    // ====== 自定义导航栏 ======
    this._header = new CustomHeader({
      width: sw,
      statusBarHeight: this._statusBarHeight,
      title: '\u8BC1\u636E\u677F', // 证据板
      titleIcon: '\u229E',          // ⊞
      subtitle: 'EVIDENCE DATABASE',
      showBack: true,
      onBack: () => this._goBack(),
    });
    this._header.zIndex = 100;
    this.addChild(this._header);

    // ====== Toast ======
    this._toast = new Toast({
      parentWidth: sw,
      parentHeight: sh,
    });
    this._toast.zIndex = 800;
    this.addChild(this._toast);

    // 构建线索 Tab 内容
    this._buildCluesTab();

    // 如果推理已解锁，初始化推理
    if (this._showReasoningTab && this._currentTab === 'reasoning') {
      this._initReasoning();
    }
  }

  /** 获取 Tab 下方内容区域的起始 Y 坐标 */
  _getContentTop() {
    let top = this._statusBarHeight + HEADER_HEIGHT;
    if (this._showReasoningTab) {
      top += TAB_HEIGHT;
    }
    return top;
  }

  /** 获取搜索面板的当前实际高度 */
  _getSearchPanelHeight() {
    if (!this._hasSearched) {
      // 无搜索结果：只显示搜索栏（标题行 + 输入行）
      return SEARCH_PANEL_BASE_H;
    }
    // 有搜索结果：展开为结果卡片，至少占屏幕 1/3
    const minH = Math.floor(this._screenHeight / 3);
    return Math.max(SEARCH_PANEL_BASE_H + SEARCH_RESULT_EXTRA_H, minH);
  }

  /** 根据搜索面板高度动态更新 ScrollView 位置 */
  _updateClueScrollLayout() {
    if (!this._clueScrollView) return;
    const contentTop = this._getContentTop();
    const searchPanelH = this._getSearchPanelHeight();
    const listTop = contentTop + searchPanelH + 8;
    const oldY = this._clueScrollView.y;
    this._clueScrollView.y = listTop;
    this._clueScrollView.height = this._screenHeight - listTop;
    // 布局发生位移时重置滚动位置，防止旧 scrollY 立即触发弹性阻尼
    if (oldY !== listTop && this._clueScrollView.scrollY !== 0) {
      this._clueScrollView.scrollY = 0;
      this._clueScrollView._velocity = 0;
    }
  }

  // ==================== 线索 Tab 构建 ====================

  _buildCluesTab() {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const contentTop = this._getContentTop();

    // 搜索引擎面板高度（动态计算，至少屏幕 1/3）
    const searchPanelH = this._getSearchPanelHeight();
    const listTop = contentTop + searchPanelH + 8;

    // ====== 证据列表 ScrollView ======
    this._clueScrollView = new ScrollView({
      width: sw,
      height: sh - listTop,
      contentHeight: 0,
      showScrollbar: true,
      bounceEnabled: true,
    });
    this._clueScrollView.x = 0;
    this._clueScrollView.y = listTop;
    // 如果当前不是线索 Tab，隐藏 ScrollView 避免透出
    this._clueScrollView.visible = (this._currentTab === 'clues');
    this.addChild(this._clueScrollView);

    // ====== 搜索输入框 ======
    this._searchEditBox = new EditBox({
      width: sw - SEARCH_PANEL_PADDING * 2 - 80,
      height: 32,
      placeholder: '\u8F93\u5165\u5173\u952E\u8BCD\u68C0\u7D22...', // 输入关键词检索...
      placeholderColor: 'rgba(0, 180, 155, 0.4)',
      fontSize: FONT_SIZE_SM,
      color: TEXT_PRIMARY,
      bgColor: 'rgba(4, 14, 13, 0.5)',
      borderColor: 'rgba(0, 245, 212, 0.15)',
      focusBorderColor: RUNE_CYAN,
      cornerRadius: 4,
      paddingX: 8,
      fontFamily: FONT_MONO,
    });
    this._searchEditBox.on('confirm', () => this._onSearch());
    // 键盘每次输入实时同步到 _searchQuery，让手绘输入框能看到正在打的内容
    this._searchEditBox.on('input', ({ value }) => { this._searchQuery = value; this._isDirty = true; });

    // ====== 检索按钮 ======
    this._searchBtn = new Button({
      text: '\u68C0\u7D22', // 检索
      width: 56,
      height: 32,
      fontSize: FONT_SIZE_SM,
      fontColor: RUNE_CYAN,
      bgColor: 'rgba(0, 245, 212, 0.06)',
      borderColor: 'rgba(0, 245, 212, 0.25)',
      cornerRadius: 4,
    });
    this._searchBtn.on('tap', () => this._onSearch());

    // 构建证据卡片列表
    this._buildEvidenceCards();
  }

  /** 构建证据卡片列表 */
  _buildEvidenceCards() {
    if (!this._clueScrollView) return;
    this._clueScrollView.removeAllChildren();
    this._evidenceCards = [];

    const sw = this._screenWidth;
    const cardPadding = 14;
    const cardWidth = sw - cardPadding * 2;
    let curY = SPACING_LG;

    if (this._collectedEvidence.length === 0) {
      // 空状态
      const emptyLabel = new Label({
        text: '\u6682\u65E0\u53EF\u67E5\u770B\u7684\u7EBF\u7D22', // 暂无可查看的线索
        fontSize: FONT_SIZE_MD,
        color: TEXT_DIM,
        textAlign: 'center',
      });
      emptyLabel.width = sw;
      emptyLabel.x = 0;
      emptyLabel.y = 100;
      this._clueScrollView.addChild(emptyLabel);

      const emptyHint = new Label({
        text: '\u7EE7\u7EED\u63A2\u7D22\u901A\u8BAF\u4EEA\u4E2D\u7684\u5185\u5BB9...', // 继续探索通讯仪中的内容...
        fontSize: FONT_SIZE_SM,
        color: TEXT_DIM,
        fontFamily: FONT_MONO,
        textAlign: 'center',
      });
      emptyHint.width = sw;
      emptyHint.x = 0;
      emptyHint.y = 125;
      this._clueScrollView.addChild(emptyHint);

      this._clueScrollView.contentHeight = 200;
      return;
    }

    for (const evidence of this._collectedEvidence) {
      const card = new EvidenceCard({
        id: evidence.id,
        name: evidence.name,
        desc: evidence.desc,
        isNew: evidence.isNew,
        width: cardWidth,
        onTap: (e) => this._quickSearch(e.name, e.id),
      });
      card.x = cardPadding;
      card.y = curY;
      this._clueScrollView.addChild(card);
      this._evidenceCards.push(card);

      // 粗估占位高度，首帧渲染后由 _relayoutCards 用实际高度修正
      curY += 80 + SPACING_MD;
    }

    // 底部留白
    curY += 60;
    this._clueScrollView.contentHeight = curY;

    // 标记需要在首帧后用实际高度重新排列
    this._needsRelayout = true;
    this._lastRelayoutReadyCount = 0;
  }

  /** 增量重排卡片：已渲染的用实际高度，未渲染的用估算占位，确保可正常滚动 */
  _relayoutCards() {
    if (!this._evidenceCards.length) return;
    const GAP = SPACING_LG;   // 卡片间统一间距 16px
    const FALLBACK_H = 82;    // 未渲染卡片的估算高度
    let curY = SPACING_LG;
    for (const card of this._evidenceCards) {
      card.y = curY;
      curY += (card.height > 0 ? card.height : FALLBACK_H) + GAP;
    }
    curY += 60;
    this._clueScrollView.contentHeight = curY;
  }

  /** 刷新线索列表 */
  _rebuildClueList() {
    this._loadEvidence();
    this._buildEvidenceCards();
    // 重建后重置滚动位置，避免旧 scrollY 超出新 contentHeight 触发弹性阻尼
    if (this._clueScrollView) {
      this._clueScrollView.scrollY = 0;
      this._clueScrollView._velocity = 0;
    }
    this._isDirty = true;
  }

  // ==================== 搜索引擎 ====================

  _onSearch() {
    const query = (this._searchEditBox ? this._searchEditBox.text : this._searchQuery).trim().replace(/\u3000/g, '');
    if (!query) return;

    this._searchQuery = query;
    const entry = searchDB[query];
    let resultText = '';
    let resultType = '';

    if (entry) {
      if (entry.type === 'special_death_gravity') {
        // 死亡引力特殊搜索
        const mainEntry = entry.aliasOf ? searchDB[entry.aliasOf] : entry;
        const count = gameState.incrementDeathGravitySearch();
        const idx = Math.min(count - 1, (mainEntry.results || []).length - 1);
        resultText = (mainEntry.results || [])[idx] || '\u6570\u636E\u5DF2\u635F\u574F\u3002';
        resultType = 'death_gravity';
        const eid = entry.evidenceId || (mainEntry && mainEntry.evidenceId);
        if (eid) gameState.markEvidenceSearched(eid);
        if (count >= 3 && eid) {
          gameState.collectEvidence(eid);
          this._rebuildClueList();
        }
        this._triggerDeathGravityEffect();
      } else if (entry.type === 'multi_result') {
        const mainEntry = entry.aliasOf ? searchDB[entry.aliasOf] : entry;
        resultText = mainEntry.result;
        resultType = 'normal';
        let anyNew = false;
        (mainEntry.entries || []).forEach(e => {
          gameState.markEvidenceSearched(e.evidenceId);
          if (gameState.collectEvidence(e.evidenceId)) anyNew = true;
        });
        if (anyNew) this._rebuildClueList();
      } else {
        resultText = entry.result;
        resultType = entry.type || 'normal';
        if (entry.evidenceId) {
          gameState.markEvidenceSearched(entry.evidenceId);
          if (gameState.collectEvidence(entry.evidenceId)) {
            this._rebuildClueList();
          }
        }
      }
    } else {
      resultText = '\u672A\u68C0\u7D22\u5230\u5BF9\u5E94\u8BCD\u6761\u3002'; // 未检索到对应词条。
      resultType = 'none';
    }

    this._lastSearchQuery = query;
    this._searchResult = resultText;
    this._searchResultType = resultType;
    this._hasSearched = true;
    this._isDirty = true;

    // 加载附图（若该词条有对应图片）
    this._resultImage = null;
    this._resultImageLoaded = false;
    const imgEvidenceId = entry ? entry.evidenceId : null;
    const imgSrc = imgEvidenceId ? RESULT_IMAGE_MAP[imgEvidenceId] : null;
    if (imgSrc) {
      const img = wx.createImage();
      img.onload = () => {
        this._resultImage = img;
        this._resultImageLoaded = true;
        this._isDirty = true;
      };
      img.src = imgSrc;
    }

    // 重置结果滚动位置 + 重新计算 ScrollView 位置
    this._resultScrollY = 0;
    this._updateClueScrollLayout();
  }

  /** 点击已收集词条 → 快速搜索 */
  _quickSearch(name, id) {
    if (!name) return;
    if (id) {
      gameState.markEvidenceCardViewed(id);
      const card = this._evidenceCards.find(c => c._id === id);
      if (card) card.setNew(false);
    }
    // 查找搜索结果文本（不展开搜索面板）
    const entry = searchDB[name];
    let detailText = '';
    if (entry && entry.result) {
      detailText = entry.result;
      if (entry.evidenceId) gameState.markEvidenceSearched(entry.evidenceId);
    } else if (id && evidenceList[id]) {
      detailText = evidenceList[id].desc || '';
    }

    // 显示浮层详情卡片
    this._cardDetailName = name;
    this._cardDetailText = detailText;
    this._cardDetailVisible = true;

    // 浮层固定在内容区顶部，不改变 scrollY（被点击词条保留原位）
    this._cardDetailOverlayY = this._getContentTop();
    this._isDirty = true;
  }

  /** 计算浮层详情卡片高度（预估，与搜索面板一致） */
  _getCardDetailHeight(text) {
    const sw = this._screenWidth;
    const px = 14;
    const maxW = sw - px * 2 - 28;
    const lineH = 12 * 1.8;
    // 估算文字行数
    const approxCharsPerLine = Math.floor(maxW / 8);
    const estLines = Math.ceil((text || '').length / Math.max(1, approxCharsPerLine));
    return 12 + 28 + 8 + 16 + 8 + Math.min(estLines, 6) * lineH + 12; // header+input+div+text+padding
  }

  /** 绘制浮层详情卡片（与搜索面板风格一致，浮于被点击卡片正上方）*/
  _drawCardDetailOverlay(ctx) {
    if (!this._cardDetailVisible) return;
    const sw = this._screenWidth;
    const text = this._cardDetailText || '';
    const overlayH = this._getCardDetailHeight(text);
    const px = 14; // 与搜索面板 SEARCH_PANEL_PADDING 相同

    // Y 坐标：_cardDetailOverlayY 由 _quickSearch 计算并存储
    const panelY = this._cardDetailOverlayY || this._getContentTop();
    const panelX = px;
    const panelW = sw - px * 2;

    ctx.save();

    // ── 面板背景（与搜索面板完全一致）──
    ctx.fillStyle = 'rgba(8, 22, 20, 0.97)';
    ctx.fillRect(panelX, panelY, panelW, overlayH);

    // ── 边框 ──
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, overlayH);

    // ── HUD 角线 - 左上 ──
    const cornerL = 18;
    const co = 2;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + co, panelY + co + cornerL);
    ctx.lineTo(panelX + co, panelY + co);
    ctx.lineTo(panelX + co + cornerL, panelY + co);
    ctx.stroke();

    // ── HUD 角线 - 右下 ──
    ctx.strokeStyle = 'rgba(0, 220, 190, 0.3)';
    ctx.beginPath();
    ctx.moveTo(panelX + panelW - co - cornerL, panelY + overlayH - co);
    ctx.lineTo(panelX + panelW - co, panelY + overlayH - co);
    ctx.lineTo(panelX + panelW - co, panelY + overlayH - co - cornerL);
    ctx.stroke();

    // ── 标题行（证据名称 + 关闭提示）──
    const headerY = panelY + 12;
    ctx.font = `${12}px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';

    // 状态点
    ctx.fillStyle = 'rgba(0, 245, 212, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('\u2299', panelX + 14, headerY); // ⊙

    // 词条名称
    ctx.fillStyle = 'rgba(0, 245, 212, 0.85)';
    ctx.fillText(this._cardDetailName, panelX + 28, headerY);

    // 关闭提示（右侧）
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${11}px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText('\u70b9\u51fb\u5173\u95ed \u00d7', panelX + panelW - 8, headerY); // 点击关闭 ×
    ctx.textAlign = 'left';

    // ── 分隔线（与搜索面板结果区 divider 一致）──
    const divY = panelY + 26;
    const resultX = panelX + 14;
    const resultMaxW = panelW - 28;
    const divGrad = ctx.createLinearGradient(resultX, 0, resultX + resultMaxW, 0);
    divGrad.addColorStop(0, 'rgba(0, 245, 212, 0.2)');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(resultX, divY);
    ctx.lineTo(resultX + resultMaxW, divY);
    ctx.stroke();

    // ── 结果文本（与搜索结果完全相同的渲染方式）──
    const textAreaTop = divY + 6;
    const textAreaBottom = panelY + overlayH - 8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(resultX - 2, textAreaTop, resultMaxW + 4, textAreaBottom - textAreaTop);
    ctx.clip();

    ctx.font = `${13}px ${FONT_MONO}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(224, 230, 237, 0.85)';

    const lines = this._wrapText(ctx, text, resultMaxW);
    const lineH = 12 * 1.8;
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      ctx.fillText(lines[i], resultX, textAreaTop + i * lineH);
    }

    ctx.restore();
    ctx.restore();
  }

  /** 清除搜索结果 */
  _clearSearch() {
    this._searchQuery = '';
    this._lastSearchQuery = '';
    this._searchResult = '';
    this._searchResultType = '';
    this._hasSearched = false;
    this._resultScrollY = 0;
    this._resultImage = null;
    this._resultImageLoaded = false;
    if (this._searchEditBox) {
      this._searchEditBox.clear();
    }

    // 搜索结果收起后重新计算 ScrollView 位置
    this._updateClueScrollLayout();
    this._isDirty = true;
  }

  // ==================== 死亡引力特效 ====================

  _triggerDeathGravityEffect() {
    this._showRedFlash = true;
    this._redFlashAlpha = 0.8;
    this._redFlashTimer = 600;

    this._searchBoxRed = true;
    this._searchBoxRedTimer = 300;
    this._isDirty = true;
  }

  // ==================== Tab 切换 ====================

  _switchTab(tab) {
    if (tab === this._currentTab) return;
    this._currentTab = tab;
    this._isDirty = true;

    // 切换时控制线索 ScrollView 可见性，避免推理页面下方透出词条
    if (this._clueScrollView) {
      this._clueScrollView.visible = (tab === 'clues');
    }

    if (tab === 'reasoning') {
      this._initReasoning();
    }
  }

  // ==================== 推理系统 — 初始化 ====================

  _initReasoning() {
    this._buildBubbles();
    this._buildLogicChain();

    // 首次进入推理 Tab 自动旋转提示
    if (!this._hasAutoRotated) {
      this._hasAutoRotated = true;
      this._showOrbitHint = true;
      this._orbitHintAlpha = 1;
      this._autoRotateTimer = 0;
    }
  }

  /** 构建气泡数据（已收集证据 + 已产出推理结论）*/
  _buildBubbles() {
    const state = gameState.get();
    const collectedIds = state.collectedEvidence || [];
    const reasoningResults = state.reasoningResults || [];

    // 排除人名/机构名/世界观背景词条（保留有推理价值的干扰项）
    const SPHERE_EXCLUDE = new Set([
      'xinghe', 'alias_profile',           // 人名
      'order_bureau', 'fasi_archive_dept', 'tree_monitor_bureau', // 机构（不参与推理）
      'universe_1124',                                             // 背景坐标
      'wu_xiaowu', 'shen_chi', 'yu_zhi', 'chen_an', 'qiqi',      // 人名
      'dual_moon', 'lingbo',               // 背景平台/节日
      'old_world', 'new_world_era',        // 历史背景
      // 'communicator', 'parallel_universe', 'universe_coordinate' 保留为干扰项
    ]);

    const items = [];

    // 已收集的证据词条（过滤纯背景词条）
    collectedIds.forEach(id => {
      if (evidenceList[id] && !SPHERE_EXCLUDE.has(id)) {
        items.push({
          id,
          name: evidenceList[id].name,
          desc: evidenceList[id].desc || '\u6682\u65E0\u8BE6\u7EC6\u4FE1\u606F',
          type: 'evidence',
        });
      }
    });

    // 已产出的推理结论
    reasoningResults.forEach(resultId => {
      const combo = reasoningCombos.find(c => c.resultId === resultId);
      if (combo) {
        items.push({
          id: combo.resultId,
          name: combo.resultName,
          desc: combo.resultText,
          type: 'result',
        });
      }
    });

    // Fibonacci 球面均匀分布
    const total = items.length;
    if (total > 0) {
      for (let i = 0; i < total; i++) {
        const phi = Math.acos(-1 + (2 * i + 1) / total);
        const theta = Math.sqrt((total + 1) * Math.PI) * phi;
        items[i].x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
        items[i].y = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);
        items[i].z = SPHERE_RADIUS * Math.cos(phi);
      }
    }

    this._sphereItems = items;
  }

  /** 投影 3D -> 2D 并返回气泡渲染数据 */
  _projectBubbles() {
    const selectedIds = this._selectedBubbles.map(b => b.id);
    // 根据提示阶段决定哪些气泡持续发光
    const glowIds = [];
    if (this._hintStage >= 2) glowIds.push(this._hintBubble0Id);
    if (this._hintStage >= 3) glowIds.push(this._hintBubble1Id);

    return this._sphereItems.map(item => {
      const per = (2 * PROJECTION_DEPTH) / (2 * PROJECTION_DEPTH + item.z);
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        screenX: SPHERE_CENTER_X + item.x * per,
        screenY: SPHERE_CENTER_Y + item.y * per,
        scale: per * 0.6 + 0.3,
        opacity: Math.max(0.25, Math.min(1.0, per * 0.7 + 0.2)),
        zIndex: Math.round(per * 100),
        selected: selectedIds.includes(item.id),
        hinting: glowIds.includes(item.id),
      };
    }).sort((a, b) => a.zIndex - b.zIndex);
  }

  // ==================== 推理系统 — 球体旋转 ====================

  /** 绕 Y 轴和 X 轴旋转所有气泡 */
  _rotateSphere(angleY, angleX) {
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);

    this._sphereItems.forEach(item => {
      const x1 = item.x * cosY + item.z * sinY;
      const z1 = -item.x * sinY + item.z * cosY;
      const y2 = item.y * cosX - z1 * sinX;
      const z2 = item.y * sinX + z1 * cosX;
      item.x = x1;
      item.y = y2;
      item.z = z2;
    });
  }

  // ==================== 推理系统 — 气泡交互 ====================

  /** 点击气泡 */
  _tapBubble(id) {
    const item = this._sphereItems.find(i => i.id === id);
    if (!item) return;

    // 已选中 → 取消选择
    const selectedIdx = this._selectedBubbles.findIndex(b => b.id === id);
    if (selectedIdx !== -1) {
      this._selectedBubbles.splice(selectedIdx, 1);
      this._canReason = false;
      return;
    }

    // 打开预览弹窗（内容优先用 searchDB 结果，与线索 Tab 点击词条保持一致）
    const searchEntry = searchDB[item.name];
    const previewDesc = (searchEntry && searchEntry.result) ? searchEntry.result : (item.desc || '');
    this._showBubblePreview = true;
    this._previewBubble = {
      id: item.id,
      name: item.name,
      desc: previewDesc,
      type: item.type,
    };
    this._previewAlpha = 0;
    Tween.create(this).to({ _previewAlpha: 1 }, 200, 'easeOut').start();
  }

  /** 预览弹窗 — 选择 */
  _selectBubble() {
    const bubble = this._previewBubble;
    if (!bubble) return;

    if (this._selectedBubbles.length >= 2) {
      this._toast.show('\u6700\u591A\u9009\u62E9\u4E24\u4E2A\u7EBF\u7D22'); // 最多选择两个线索
      this._cancelPreview();
      return;
    }
    if (this._selectedBubbles.find(b => b.id === bubble.id)) {
      this._cancelPreview();
      return;
    }

    this._selectedBubbles.push({ id: bubble.id, name: bubble.name });
    this._canReason = this._selectedBubbles.length === 2;
    this._cancelPreview();
  }

  /** 预览弹窗 — 取消 */
  _cancelPreview() {
    this._showBubblePreview = false;
    this._previewBubble = null;
    this._previewAlpha = 0;
  }

  /** 取消已选气泡 */
  _deselectBubble(id) {
    this._selectedBubbles = this._selectedBubbles.filter(b => b.id !== id);
    this._canReason = this._selectedBubbles.length === 2;
  }

  // ==================== 推理系统 — 模式切换 ====================

  _switchMode(mode) {
    if (mode === this._reasoningMode) return;
    this._reasoningMode = mode;
  }

  // ==================== 推理系统 — 推理判定 ====================

  _doReasoning() {
    if (!this._canReason) return;

    const [a, b] = this._selectedBubbles;
    const mode = this._reasoningMode;

    const combo = reasoningCombos.find(c => {
      if (c.mode !== mode) return false;
      return (c.ids[0] === a.id && c.ids[1] === b.id) ||
             (c.ids[0] === b.id && c.ids[1] === a.id);
    });

    if (combo) {
      const results = gameState.getReasoningResults();
      if (results.includes(combo.resultId)) {
        this._toast.show('\u8BE5\u63A8\u7406\u5DF2\u5B8C\u6210'); // 该推理已完成
        return;
      }
      this._onReasoningSuccess(combo);
    } else {
      this._onReasoningFail();
    }
  }

  _onReasoningSuccess(combo) {
    gameState.addReasoningResult(combo.resultId);
    this._selectedBubbles = [];
    this._canReason = false;

    // 清理该组合对应的提示卡片
    const comboIdx = reasoningCombos.indexOf(combo);
    this._clearHintIfMatched(comboIdx);

    // 检查是否全部完成 → 推进到 ch4
    const results = gameState.getReasoningResults();
    if (results.length >= reasoningCombos.length) {
      gameState.advanceChapter(4);
    }

    // 是因是果：点击关闭后触发封锁序列
    if (combo.resultId === 'cause_and_effect') {
      this._pendingLockdown = true;
    }

    // 播放逐字打印动画
    this._showResultOverlay = true;
    this._resultTitle = combo.resultName;
    this._resultFullText = combo.resultText;
    this._resultDisplayText = '';
    this._resultTypingIndex = 0;
    this._resultTypingTimer = 0;

    // 刷新气泡和逻辑链路
    this._buildBubbles();
    this._buildLogicChain();
  }

  _onReasoningFail() {
    this._toast.show('逻辑链路建立失败'); // 逻辑链路建立失败
    const failCount = gameState.incrementReasoningFail();

    if (this._hintCardVisible) {
      // 提示卡片已显示：累积失败次数，逐步点亮词条
      this._hintFailsSinceCard++;
      if (this._hintStage === 2) this._hintFailsSinceBubble0++;

      if (this._hintStage === 1 && this._hintFailsSinceCard >= 3) {
        this._hintStage = 2;
        this._hintFailsSinceBubble0 = 0;
      } else if (this._hintStage === 2 && this._hintFailsSinceBubble0 >= 3) {
        this._hintStage = 3;
      }
    } else if (failCount >= 4) {
      this._triggerHint();
    }

    this._selectedBubbles = [];
    this._canReason = false;
    this._isDirty = true;
  }

  /** 失败 4 次后触发提示系统 */
  _triggerHint() {
    const results = gameState.getReasoningResults();
    const pool = [...(gameState.get().collectedEvidence || []), ...results];

    // 提示顺序：②③⑤⑥⑦优先（有证据的），④最后（依赖③结论）
    const HINT_ORDER = [
      'impossible_leap',
      'leap_framework',
      'system_imbalance',
      'identity_paradox',
      'unreasonable_calm',
      'cause_and_effect',
    ];

    // 第一轮：找一个「证据已齐全、有 hintText、尚未完成」的组合提示
    for (const resultId of HINT_ORDER) {
      if (results.includes(resultId)) continue;
      const idx = reasoningCombos.findIndex(c => c.resultId === resultId);
      if (idx === -1) continue;
      const combo = reasoningCombos[idx];
      if (!combo.hintText) continue;
      const missing = combo.ids.filter(id => !pool.includes(id));
      if (missing.length === 0) {
        this._hintCardVisible = true;
        this._hintCardText = combo.hintText;
        this._hintTargetComboIdx = idx;
        this._hintStage = 1;
        this._hintFailsSinceCard = 0;
        this._hintFailsSinceBubble0 = 0;
        this._hintBubble0Id = combo.ids[0];
        this._hintBubble1Id = combo.ids[1];
        this._isDirty = true;
        return;
      }
    }

    // 第二轮：找第一个「证据不齐」的组合，提示缺少关键线索
    for (const resultId of HINT_ORDER) {
      if (results.includes(resultId)) continue;
      const idx = reasoningCombos.findIndex(c => c.resultId === resultId);
      if (idx === -1) continue;
      const combo = reasoningCombos[idx];
      const missing = combo.ids.filter(id => !pool.includes(id));
      if (missing.length > 0) {
        // 消亡倾向缺失的特殊提示
        if (missing.includes('death_gravity')) {
          this._missingDeathGravityCount++;
          if (this._missingDeathGravityCount >= 3) {
            this._missingDeathGravityCount = 0;
            this._missingMsgText = '某个异常线索搜索多次，可能会有不一样的结果';
            this._missingMsgVisible = true;
            this._missingMsgAlpha = 1;
            this._missingMsgTimer = 3500;
            this._isDirty = true;
            return;
          }
        }
        this._missingMsgText = '';
        this._missingMsgVisible = true;
        this._missingMsgAlpha = 1;
        this._missingMsgTimer = 2800;
        this._isDirty = true;
        return;
      }
    }
  }

  /** 推理成功后清理当前提示状态 */
  _clearHintIfMatched(comboIdx) {
    if (comboIdx === this._hintTargetComboIdx) {
      this._hintCardVisible = false;
      this._hintCardText = '';
      this._hintTargetComboIdx = -1;
      this._hintStage = 0;
      this._hintBubble0Id = '';
      this._hintBubble1Id = '';
    }
  }

  /** 关闭推理结果覆层 */
  _closeResultOverlay() {
    this._showResultOverlay = false;
    this._resultDisplayText = '';
    this._resultFullText = '';
    this._resultTypingIndex = 0;
    if (this._pendingLockdown) {
      this._pendingLockdown = false;
      this._startLockdown();
      return;
    }
    this._isDirty = true;
  }

  /** 启动法司大人封锁序列 */
  _startLockdown() {
    this._lockdownActive = true;
    this._lockdownTimer = 0;
    this._lockdownPhaseDone = false;
    this._lockdownBanner1Y = -70;
    this._lockdownBanner1Alpha = 0;
    this._lockdownBanner2Y = -70;
    this._lockdownBanner2Alpha = 0;
    this._lockdownOverlayAlpha = 0;
    this._lockdownWarningAlpha = 0;
    this._lockdownTypingText = '';
    this._lockdownTypingIdx = 0;
    this._lockdownTypingTimer = 0;
    this._lockdownScrollX = this._screenWidth;
    this._lockdownTriPhase = 0;
    try { wx.vibrateLong(); } catch (e) {}
    this._isDirty = true;
  }

  /** 封锁序列结束 — 推进 ch4，返回主页 */
  _endLockdown() {
    this._lockdownActive = false;
    gameState.advanceChapter(4);
    this.engine.popScene();
  }

  // ==================== 推理系统 — 逻辑链路 ====================

  _buildLogicChain() {
    const results = gameState.getReasoningResults();
    this._logicChain = reasoningCombos.map(combo => ({
      resultId: combo.resultId,
      resultName: combo.resultName,
      mode: combo.mode,
      completed: results.includes(combo.resultId),
      sourceIds: combo.ids,
    }));
    this._completedCount = results.length;
  }

  /** 点击逻辑链路已完成的项 → 展示推理结果 */
  _tapChainItem(resultId) {
    const combo = reasoningCombos.find(c => c.resultId === resultId);
    if (!combo) return;
    const results = gameState.getReasoningResults();
    if (!results.includes(resultId)) return;
    this._showResultOverlay = true;
    this._resultTitle = combo.resultName;
    this._resultFullText = combo.resultText;
    this._resultDisplayText = combo.resultText; // 直接全文显示
    this._resultTypingIndex = combo.resultText.length;
  }

  // ==================== 导航 ====================

  _goBack() {
    if (this.engine) {
      this.engine.popScene();
    }
  }

  // ==================== 每帧更新 ====================

  /** 引擎每帧检查：返回 false 时跳过 clearRect+render，零 Canvas 开销 */
  needsRedraw() {
    return this._isDirty;
  }

  update(dt) {
    super.update(dt);

    // ── 脏标记：检测需要持续重绘的动画状态 ──────────────────────────────
    const sv = this._clueScrollView;
    if (sv && (sv._isDragging || sv._isAnimating || Math.abs(sv._velocity) > 0.5)) {
      this._isDirty = true;
    }
    if (this._resultDragging || Math.abs(this._resultVelocity) > 0.5) {
      this._isDirty = true;
    }
    if (this._showRedFlash || this._searchBoxRed) {
      this._isDirty = true;
    }
    if (this._currentTab === 'reasoning' &&
        (this._isInertiaActive ||
         this._autoRotateTimer < this._autoRotateDuration ||
         this._showResultOverlay ||
         this._showBubblePreview ||
         this._showOrbitHint)) {
      this._isDirty = true;
    }
    // 有新词条发光动画时持续重绘
    if (this._evidenceCards.some(c => c._isNew)) {
      this._isDirty = true;
    }

    // 增量式重排：每当有新卡片完成首次绘制（height > 0），就立即重排一次
    if (this._needsRelayout && this._evidenceCards.length > 0) {
      const readyCount = this._evidenceCards.filter(c => c.height > 0).length;
      if (readyCount > this._lastRelayoutReadyCount) {
        this._lastRelayoutReadyCount = readyCount;
        this._relayoutCards();
        this._isDirty = true;
        if (readyCount === this._evidenceCards.length) {
          this._needsRelayout = false;
        }
      }
    }

    // 缺少词条提示淡出
    if (this._missingMsgVisible) {
      this._missingMsgTimer -= dt;
      if (this._missingMsgTimer <= 500) {
        this._missingMsgAlpha = Math.max(0, this._missingMsgTimer / 500);
      }
      if (this._missingMsgTimer <= 0) {
        this._missingMsgVisible = false;
        this._missingMsgAlpha = 0;
      }
      this._isDirty = true;
    }

    // 死亡引力红色闪光衰减
    if (this._showRedFlash) {
      this._redFlashTimer -= dt;
      this._redFlashAlpha = Math.max(0, this._redFlashTimer / 600 * 0.8);
      if (this._redFlashTimer <= 0) {
        this._showRedFlash = false;
        this._redFlashAlpha = 0;
      }
    }
    if (this._searchBoxRed) {
      this._searchBoxRedTimer -= dt;
      if (this._searchBoxRedTimer <= 0) {
        this._searchBoxRed = false;
      }
    }

    // 搜索结果区域惯性滚动
    if (!this._resultDragging && Math.abs(this._resultVelocity) > 0.5) {
      this._resultScrollY = Math.max(0, Math.min(this._resultMaxScrollY, this._resultScrollY + this._resultVelocity));
      this._resultVelocity *= 0.88;
      if (Math.abs(this._resultVelocity) < 0.5) this._resultVelocity = 0;
    }

    // 推理 Tab 更新
    if (this._currentTab === 'reasoning') {
      // 自动旋转
      if (this._showOrbitHint && !this._hasAutoRotated) {
        // 已在 _initReasoning 设置
      }
      if (this._hasAutoRotated && this._autoRotateTimer < this._autoRotateDuration) {
        this._autoRotateTimer += dt;
        const progress = this._autoRotateTimer / this._autoRotateDuration;
        const speed = 0.02 * Math.sin(progress * Math.PI);
        this._rotateSphere(speed, speed * 0.3);

        if (this._autoRotateTimer >= this._autoRotateDuration) {
          // 淡出提示
          Tween.create(this).delay(1000).to({ _orbitHintAlpha: 0 }, 500, 'easeOut')
            .call(() => { this._showOrbitHint = false; }).start();
        }
      }

      // 惯性旋转
      if (this._isInertiaActive) {
        this._velocityX *= INERTIA_DECAY;
        this._velocityY *= INERTIA_DECAY;
        if (Math.abs(this._velocityX) < 0.0005 && Math.abs(this._velocityY) < 0.0005) {
          this._isInertiaActive = false;
        } else {
          this._rotateSphere(this._velocityX, this._velocityY);
        }
      }

      // 推理结果逐字打印
      if (this._showResultOverlay && this._resultTypingIndex < this._resultFullText.length) {
        this._resultTypingTimer += dt;
        if (this._resultTypingTimer >= 40) {
          this._resultTypingTimer -= 40;
          this._resultTypingIndex++;
          this._resultDisplayText = this._resultFullText.slice(0, this._resultTypingIndex);
        }
      }
    }

    // 法司大人封锁序列逐帧驱动
    if (this._lockdownActive) {
      this._lockdownTimer += dt;
      const t = this._lockdownTimer;
      const BANNER_H = 64;
      const BANNER_TARGET_Y = (this._statusBarHeight || 44) + HEADER_HEIGHT + 8;
      const TYPING_FULL = '法司大人紧急封锁权限';

      // Banner1 动画 (0-350 滑入 / 350-2200 停留 / 2200-2550 滑出)
      if (t < 350) {
        const p = t / 350;
        const e = 1 - Math.pow(1 - p, 3);
        this._lockdownBanner1Y = -BANNER_H + (BANNER_TARGET_Y + BANNER_H) * e;
        this._lockdownBanner1Alpha = e;
      } else if (t < 2200) {
        this._lockdownBanner1Y = BANNER_TARGET_Y;
        this._lockdownBanner1Alpha = 1;
      } else if (t < 2550) {
        const p = (t - 2200) / 350;
        const e = p * p;
        this._lockdownBanner1Y = BANNER_TARGET_Y - (BANNER_TARGET_Y + BANNER_H) * e;
        this._lockdownBanner1Alpha = 1 - e;
      } else {
        this._lockdownBanner1Alpha = 0;
      }

      // 暗红遮罩 (2550-2950 淡入 / 2950-7950 保持 / 7950-8350 淡出)
      if (t >= 2550 && t < 2950) {
        this._lockdownOverlayAlpha = ((t - 2550) / 400) * 0.8;
      } else if (t >= 2950 && t < 7950) {
        this._lockdownOverlayAlpha = 0.8;
      } else if (t >= 7950 && t < 8350) {
        this._lockdownOverlayAlpha = (1 - (t - 7950) / 400) * 0.8;
      } else if (t >= 8350) {
        this._lockdownOverlayAlpha = 0;
      }

      // 警告面板 (2950-3200 淡入 / 3200-7700 保持 / 7700-8350 淡出)
      if (t >= 2950 && t < 3200) {
        this._lockdownWarningAlpha = (t - 2950) / 250;
      } else if (t >= 3200 && t < 7700) {
        this._lockdownWarningAlpha = 1;
      } else if (t >= 7700 && t < 8350) {
        this._lockdownWarningAlpha = 1 - (t - 7700) / 650;
      } else {
        this._lockdownWarningAlpha = 0;
      }

      // 三角脉冲相位
      this._lockdownTriPhase += dt * 0.004;

      // 逐字打印 "法司大人紧急封锁权限" (3200-4700)
      if (t >= 3200 && t < 4700 && this._lockdownTypingIdx < TYPING_FULL.length) {
        this._lockdownTypingTimer += dt;
        if (this._lockdownTypingTimer >= 80) {
          this._lockdownTypingTimer = 0;
          this._lockdownTypingIdx++;
          this._lockdownTypingText = TYPING_FULL.slice(0, this._lockdownTypingIdx);
        }
      }

      // WARNING 滚动 (4700-7950)
      if (t >= 4700 && t < 7950) {
        this._lockdownScrollX -= dt * 0.13;
        const warningW = 500;
        if (this._lockdownScrollX < -warningW) {
          this._lockdownScrollX = this._screenWidth;
        }
      }

      // Banner2 动画 (8350-8700 滑入 / 8700-10200 停留 / 10200-10550 滑出)
      if (t >= 8350 && t < 8700) {
        const p = (t - 8350) / 350;
        const e = 1 - Math.pow(1 - p, 3);
        this._lockdownBanner2Y = -BANNER_H + (BANNER_TARGET_Y + BANNER_H) * e;
        this._lockdownBanner2Alpha = e;
      } else if (t >= 8700 && t < 10200) {
        this._lockdownBanner2Y = BANNER_TARGET_Y;
        this._lockdownBanner2Alpha = 1;
      } else if (t >= 10200 && t < 10550) {
        const p = (t - 10200) / 350;
        const e = p * p;
        this._lockdownBanner2Y = BANNER_TARGET_Y - (BANNER_TARGET_Y + BANNER_H) * e;
        this._lockdownBanner2Alpha = 1 - e;
      } else if (t >= 10550 && !this._lockdownPhaseDone) {
        this._lockdownPhaseDone = true;
        this._endLockdown();
        return;
      }

      this._isDirty = true;
    }
  }

  // ==================== 触摸事件处理 ====================

  onTouchStart(event) {
    if (this._lockdownActive) return;
    if (event.changedTouches.length === 0) return;
    this._isDirty = true;
    const touch = event.changedTouches[0];
    const x = touch.x;
    const y = touch.y;
    // 记录滑动起始点（用于右滑退出检测），重置拖拽状态
    this._swipeStartX = x;
    this._swipeStartY = y;
    this._swipeActive = false;

    // 推理结果覆层 → 仅点击关闭按钮时关闭
    if (this._showResultOverlay) {
      const btn = this._resultCloseBtnRect;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this._closeResultOverlay();
      }
      return;
    }

    // 气泡预览弹窗：touchStart 阶段只拦截，不执行动作
    // 动作在 touchEnd 执行，避免 touchEnd 坐标穿透到推理 Tab 触发误操作
    if (this._showBubblePreview) {
      return;
    }

    // Tab 切换区域
    if (this._showReasoningTab) {
      const tabY = this._statusBarHeight + HEADER_HEIGHT;
      if (y >= tabY && y <= tabY + TAB_HEIGHT) {
        const mid = this._screenWidth / 2;
        if (x < mid) {
          this._switchTab('clues');
        } else {
          this._switchTab('reasoning');
        }
        return;
      }
    }

    // 返回按钮
    if (x <= 50 && y >= this._statusBarHeight && y <= this._statusBarHeight + HEADER_HEIGHT) {
      this._goBack();
      return;
    }

    if (this._currentTab === 'clues') {
      this._handleCluesTabTouch(x, y, 'start');
    } else if (this._currentTab === 'reasoning') {
      this._handleReasoningTabTouch(x, y, 'start');
    }
  }

  onTouchMove(event) {
    if (this._lockdownActive) return;
    if (event.changedTouches.length === 0) return;
    this._isDirty = true;
    const touch = event.changedTouches[0];
    const dx = touch.x - this._swipeStartX;
    const dy = touch.y - this._swipeStartY;

    // 右滑手势：从左侧 60px 内起始，水平位移超过 10px 且大于纵向位移
    if (!this._swipeActive && this._swipeStartX < 60 && dx > 10 && Math.abs(dx) > Math.abs(dy)) {
      this._swipeActive = true;
    }
    if (this._swipeActive) {
      this.x = Math.max(0, dx);
      this._isDirty = true;
      return; // 拦截，不传递给子节点
    }

    if (this._currentTab === 'clues') {
      this._handleCluesTabTouch(touch.x, touch.y, 'move');
    } else if (this._currentTab === 'reasoning') {
      this._handleReasoningTabTouch(touch.x, touch.y, 'move');
    }
  }

  onTouchEnd(event) {
    if (this._lockdownActive) return;
    if (event.changedTouches.length === 0) return;
    this._isDirty = true;
    const touch = event.changedTouches[0];
    const x = touch.x;
    const y = touch.y;
    // 右滑退出（带页面平移动画）
    if (this._swipeActive) {
      this._swipeActive = false;
      const sw = this._screenWidth;
      if (this.x > sw * 0.35) {
        // 超过阈值 → 滑出并退出
        Tween.create(this).to({ x: sw }, 200, 'easeOut').call(() => {
          this.x = 0;
          this._goBack();
        }).start();
      } else {
        // 未达阈值 → 弹回原位
        Tween.create(this).to({ x: 0 }, 180, 'easeOut').start();
      }
      return;
    }

    // 气泡预览弹窗 → 在 touchEnd 统一处理，防止坐标穿透到推理 Tab
    if (this._showBubblePreview) {
      const cardW = 280;
      const cardH = 220;
      const cx = (this._screenWidth - cardW) / 2;
      const cy = (this._screenHeight - cardH) / 2;
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
        const btnGap = 12;
        const btnW = (cardW - 36 - btnGap) / 2;
        const btnY = cy + cardH - 50;
        const btn1X = cx + 12;
        const btn2X = btn1X + btnW + btnGap;
        if (y >= btnY && y <= btnY + 36) {
          if (x >= btn1X && x <= btn1X + btnW) {
            this._cancelPreview();
            return;
          }
          if (x >= btn2X && x <= btn2X + btnW) {
            this._selectBubble();
            return;
          }
        }
        return;
      }
      this._cancelPreview();
      return;
    }

    if (this._currentTab === 'clues') {
      this._handleCluesTabTouch(x, y, 'end');
    } else if (this._currentTab === 'reasoning') {
      this._handleReasoningTabTouch(x, y, 'end');
    }
  }

  // ---- 线索 Tab 触摸处理 ----

  _handleCluesTabTouch(x, y, phase) {
    // 浮层详情已显示时：任意点击关闭浮层
    if (this._cardDetailVisible) {
      if (phase === 'end') {
        this._cardDetailVisible = false;
        this._isDirty = true;
      }
      return;
    }

    const contentTop = this._getContentTop();
    const searchPanelH = this._getSearchPanelHeight();
    const px = SEARCH_PANEL_PADDING;
    const inputY = contentTop + 32;
    const inputH = 28;

    // ── touchStart：锁定目标区域 ──────────────────────────────────────
    if (phase === 'start') {
      this._cluesTouchTarget = null;
      this._cluesTouchStartX = x;
      this._cluesTouchStartY = y;

      if (y >= contentTop && y <= contentTop + searchPanelH) {
        // 搜索结果文本区域（输入框下方）可滚动
        if (this._hasSearched && y > inputY + inputH + 26) {
          this._cluesTouchTarget = 'result';
          this._resultDragging = true;
          this._resultLastTouchY = y;
          this._resultVelocity = 0;
        } else {
          this._cluesTouchTarget = 'search';
        }
      } else if (this._clueScrollView && y >= this._clueScrollView.y) {
        this._cluesTouchTarget = 'list';
        this._clueScrollView.onTouchStart(y);
      }
      return;
    }

    // ── touchMove/touchEnd：路由到 touchStart 时锁定的目标 ───────────
    if (phase === 'move') {
      if (this._cluesTouchTarget === 'result' && this._resultDragging) {
        const delta = this._resultLastTouchY - y;
        this._resultScrollY = Math.max(0, Math.min(this._resultMaxScrollY, this._resultScrollY + delta));
        this._resultVelocity = delta * 0.6;
        this._resultLastTouchY = y;
      } else if (this._cluesTouchTarget === 'list' && this._clueScrollView) {
        this._clueScrollView.onTouchMove(y);
      }
      return;
    }

    if (phase === 'end') {
      if (this._cluesTouchTarget === 'result') {
        this._resultDragging = false;
        this._cluesTouchTarget = null;
        return;
      }

      if (this._cluesTouchTarget === 'list') {
        if (this._clueScrollView) {
          this._clueScrollView.onTouchEnd();
          if (!this._clueScrollView.didScroll()) {
            const svY = this._clueScrollView.y;
            const localY = y - svY + this._clueScrollView.scrollY;
            for (const card of this._evidenceCards) {
              if (x >= card.x && x <= card.x + card.width &&
                  localY >= card.y && localY <= card.y + card.height) {
                card.emit('tap', { id: card._id, name: card._name });
                break;
              }
            }
          }
        }
        this._cluesTouchTarget = null;
        return;
      }

      // 搜索面板内的点击（非拖拽）
      // 用 touchStart 坐标做命中判断，避免手指抬起时轻微漂移导致漏判
      const sx = this._cluesTouchStartX;
      const sy = this._cluesTouchStartY;
      this._cluesTouchTarget = null;
      if (sy >= contentTop && sy <= contentTop + searchPanelH) {
        if (sy >= inputY && sy <= inputY + inputH + 8) {
          const searchBtnX = this._screenWidth - px - 56;
          if (sx >= searchBtnX) {
            this._onSearch();
          } else if (this._searchEditBox) {
            this._searchEditBox.onTap();
          }
          return;
        }
        if (this._hasSearched) {
          const resultY = inputY + inputH + 10;
          const clearX = this._screenWidth - px * 2 - 10;
          if (sx >= clearX && sy >= resultY - 4 && sy <= resultY + 18) {
            this._clearSearch();
          }
        }
      }
    }
  }

  // ---- 推理 Tab 触摸处理 ----

  _handleReasoningTabTouch(x, y, phase) {
    const contentTop = this._getContentTop();
    const modeToggleY = contentTop + 8;
    const sphereY = modeToggleY + 40;
    const sphereBottom = sphereY + SPHERE_AREA_SIZE;
    const selectedAreaY = sphereBottom + 4;
    const reasonBtnY = selectedAreaY + 40;
    const chainY = reasonBtnY + 50;

    // 模式切换
    if (phase === 'end' && y >= modeToggleY && y <= modeToggleY + 36) {
      const mid = this._screenWidth / 2;
      if (x < mid) {
        this._switchMode('relate');
      } else {
        this._switchMode('contradict');
      }
      return;
    }

    // 3D 球面区域
    const sphereLeft = (this._screenWidth - SPHERE_AREA_SIZE) / 2;
    if (x >= sphereLeft && x <= sphereLeft + SPHERE_AREA_SIZE &&
        y >= sphereY && y <= sphereBottom) {
      if (phase === 'start') {
        this._isInertiaActive = false;
        this._lastTouch = { x, y };
        this._velocityX = 0;
        this._velocityY = 0;
      } else if (phase === 'move' && this._lastTouch) {
        const dx = x - this._lastTouch.x;
        const dy = y - this._lastTouch.y;
        this._lastTouch = { x, y };
        this._velocityX = -dx * ROTATION_SPEED;
        this._velocityY = dy * ROTATION_SPEED;
        this._rotateSphere(this._velocityX, this._velocityY);
      } else if (phase === 'end') {
        if (this._lastTouch) {
          const moved = this._lastTouch && (
            Math.abs(this._velocityX) > 0.001 ||
            Math.abs(this._velocityY) > 0.001
          );
          if (moved) {
            this._isInertiaActive = true;
          } else {
            // 未拖拽 → 检测气泡点击
            const bubbles = this._projectBubbles();
            const localX = x - sphereLeft;
            const localY = y - sphereY;
            // 从前到后（zIndex 大的在上面）反向遍历
            for (let i = bubbles.length - 1; i >= 0; i--) {
              const b = bubbles[i];
              const bx = b.screenX;
              const by = b.screenY;
              const hitR = 30 * b.scale;
              if (Math.abs(localX - bx) < hitR && Math.abs(localY - by) < hitR) {
                this._tapBubble(b.id);
                break;
              }
            }
          }
          this._lastTouch = null;
        }
      }
      return;
    }

    // 已选区域 → 取消选择
    if (phase === 'end' && y >= selectedAreaY && y <= selectedAreaY + 36) {
      const slotW = 100;
      const gap = 16;
      const totalW = slotW * 2 + gap;
      const startX = (this._screenWidth - totalW) / 2;
      if (this._selectedBubbles[0] && x >= startX && x <= startX + slotW) {
        this._deselectBubble(this._selectedBubbles[0].id);
      } else if (this._selectedBubbles[1] && x >= startX + slotW + gap && x <= startX + totalW) {
        this._deselectBubble(this._selectedBubbles[1].id);
      }
      return;
    }

    // 推理按钮
    if (phase === 'end' && y >= reasonBtnY && y <= reasonBtnY + 40) {
      const btnLeft = 40;
      const btnRight = this._screenWidth - 40;
      if (x >= btnLeft && x <= btnRight) {
        this._doReasoning();
      }
      return;
    }

    // 逻辑链路列表点击
    if (phase === 'end' && y >= chainY) {
      const itemH = 28;
      const chainHeaderH = 24;
      const localY = y - chainY - chainHeaderH;
      if (localY >= 0) {
        const idx = Math.floor(localY / itemH);
        if (idx >= 0 && idx < this._logicChain.length && this._logicChain[idx].completed) {
          this._tapChainItem(this._logicChain[idx].resultId);
        }
      }
      return;
    }
  }

  // ==================== 绘制 ====================

  _draw(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;

    // 右滑时：在平移坐标系内向左退回，绘制左侧背景遮罩防止黑边
    if (this.x > 0) {
      ctx.save();
      ctx.translate(-this.x, 0); // 还原到屏幕原始坐标
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, this.x + 1, sh);
      // 右侧渐变阴影（模拟原生退出的深度感）
      const shadowGrad = ctx.createLinearGradient(0, 0, this.x, 0);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(0, 0, this.x + 1, sh);
      ctx.restore();
    }

    // 背景
    ctx.fillStyle = BG_DARK;
    ctx.fillRect(0, 0, sw, sh);

    // 环境光
    ctx.save();
    const ambGrad = ctx.createRadialGradient(
      sw * 0.5, sh, 0,
      sw * 0.5, sh, sw * 0.8
    );
    ambGrad.addColorStop(0, 'rgba(0, 245, 212, 0.03)');
    ambGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = ambGrad;
    ctx.fillRect(0, 0, sw, sh);
    ctx.restore();

    // Tab 栏
    if (this._showReasoningTab) {
      this._drawTabBar(ctx);
    }

    // 当前 Tab 内容
    if (this._currentTab === 'clues') {
      this._drawSearchEngine(ctx);
      // ScrollView 和卡片通过子节点树自动渲染
    } else if (this._currentTab === 'reasoning') {
      this._drawReasoningTab(ctx);
    }

    // 死亡引力全屏红色闪光
    if (this._showRedFlash && this._redFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this._redFlashAlpha;
      const redGrad = ctx.createRadialGradient(
        sw * 0.5, sh * 0.5, 0,
        sw * 0.5, sh * 0.5, sw * 0.7
      );
      redGrad.addColorStop(0, 'rgba(255, 0, 0, 0.3)');
      redGrad.addColorStop(1, 'rgba(120, 0, 0, 0.5)');
      ctx.fillStyle = redGrad;
      ctx.fillRect(0, 0, sw, sh);
      ctx.restore();
    }

    // 气泡预览弹窗
    if (this._showBubblePreview && this._previewBubble) {
      this._drawBubblePreview(ctx);
    }

    // 推理结果覆层
    if (this._showResultOverlay) {
      this._drawResultOverlay(ctx);
    }

    // 法司大人封锁序列（最顶层绘制）
    if (this._lockdownActive) {
      this._drawLockdownSequence(ctx);
    }
  }

  /** 重写 render：弹窗覆盖层必须在子节点（ScrollView）渲染完毕后绘制，否则会被遮挡 */
  render(ctx) {
    super.render(ctx);
    if (this._currentTab === 'clues' && this._cardDetailVisible) {
      ctx.save();
      ctx.translate(this.x || 0, this.y || 0);
      this._drawCardDetailOverlay(ctx);
      ctx.restore();
    }
  }

  // ---- Tab 栏绘制 ----

  _drawTabBar(ctx) {
    const sw = this._screenWidth;
    const tabY = (this._statusBarHeight + HEADER_HEIGHT);
    const tabH = TAB_HEIGHT;
    const halfW = sw / 2;

    // Tab 背景
    ctx.save();
    ctx.fillStyle = 'rgba(6, 16, 18, 0.85)';
    ctx.fillRect(0, tabY, sw, tabH);

    const tabs = [
      { text: '\u7EBF\u7D22', key: 'clues' },   // 线索
      { text: '\u63A8\u7406', key: 'reasoning' }, // 推理
    ];

    for (let i = 0; i < tabs.length; i++) {
      const isActive = this._currentTab === tabs[i].key;
      const tx = (i * halfW) + halfW / 2;
      const ty = tabY + tabH / 2;

      ctx.font = `${13}px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive ? RUNE_CYAN : TEXT_DIM;

      if (isActive) {
        ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
        ctx.shadowBlur = 4;
      }
      ctx.fillText(tabs[i].text, tx, ty);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 活动下划线
      if (isActive) {
        const lineW = 40;
        const lineY = tabY + tabH - 2;
        const lineGrad = ctx.createLinearGradient(tx - lineW / 2, 0, tx + lineW / 2, 0);
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.5, RUNE_CYAN);
        lineGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx - lineW / 2, lineY);
        ctx.lineTo(tx + lineW / 2, lineY);
        ctx.stroke();
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  // ---- 搜索引擎绘制 ----

  _drawSearchEngine(ctx) {
    const sw = this._screenWidth;
    const contentTop = this._getContentTop();
    const px = SEARCH_PANEL_PADDING;
    const panelX = px;
    const panelY = contentTop;
    const panelW = (sw - px * 2);

    // 搜索面板背景（高度与 _getSearchPanelHeight 保持一致）
    ctx.save();
    const panelH = this._getSearchPanelHeight();

    ctx.fillStyle = 'rgba(8, 22, 20, 0.92)';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    // 边框
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // HUD 角线 - 左上
    const cornerL = 18;
    const co = 2;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + co, panelY + co + cornerL);
    ctx.lineTo(panelX + co, panelY + co);
    ctx.lineTo(panelX + co + cornerL, panelY + co);
    ctx.stroke();

    // HUD 角线 - 右下
    ctx.strokeStyle = 'rgba(0, 220, 190, 0.3)';
    ctx.beginPath();
    ctx.moveTo(panelX + panelW - co - cornerL, panelY + panelH - co);
    ctx.lineTo(panelX + panelW - co, panelY + panelH - co);
    ctx.lineTo(panelX + panelW - co, panelY + panelH - co - cornerL);
    ctx.stroke();

    // 标题行
    const headerY = panelY + 12;
    ctx.font = `${12}px ${FONT_MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 状态点
    ctx.fillStyle = 'rgba(0, 245, 212, 0.9)';
    ctx.fillText('\u2299', panelX + 14, headerY); // ⊙

    // 标题
    ctx.fillStyle = 'rgba(0, 245, 212, 0.85)';
    ctx.fillText('\u6CD5\u53F8\u5927\u4EBA\u00B7\u667A\u6167\u77E9\u9635', panelX + 28, headerY); // 法司大人·智慧矩阵

    // 在线状态
    const statusX = panelX + panelW - 50;
    ctx.beginPath();
    ctx.arc(statusX, headerY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.8)';
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.font = `${10}px ${FONT_MONO}`;
    ctx.fillText('\u5728\u7EBF', statusX + 6, headerY); // 在线

    // 输入行
    const inputY = panelY + 32;
    const inputH = 28;
    const inputX = panelX + 8;
    const inputW = panelW - 16;

    // 输入行背景
    const borderColor = this._searchBoxRed ? 'rgba(255, 68, 68, 0.6)' : 'rgba(0, 245, 212, 0.15)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(4, 14, 13, 0.5)';
    const inputR = 4;
    this._roundRect(ctx, inputX, inputY, inputW, inputH, inputR);
    ctx.fill();
    ctx.stroke();

    // 搜索框红色发光
    if (this._searchBoxRed) {
      ctx.shadowColor = 'rgba(255, 68, 68, 0.3)';
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // 提示符 ›
    ctx.fillStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.font = `${13}px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('\u203A', inputX + 6, inputY + inputH / 2);

    // 输入文字 / 占位符
    const textX = inputX + 18;
    if (this._searchQuery) {
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.font = `${13}px ${FONT_MONO}`;
      ctx.fillText(this._searchQuery, textX, inputY + inputH / 2);
    } else {
      ctx.fillStyle = 'rgba(0, 180, 155, 0.4)';
      ctx.font = `${12}px ${FONT_MONO}`;
      ctx.fillText('\u8F93\u5165\u5173\u952E\u8BCD\u68C0\u7D22...', textX, inputY + inputH / 2);
    }

    // 检索按钮
    const btnW = 44;
    const btnH = inputH - 4;
    const btnX = inputX + inputW - btnW - 4;
    const btnY = inputY + 2;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
    ctx.fillStyle = 'rgba(0, 245, 212, 0.06)';
    this._roundRect(ctx, btnX, btnY, btnW, btnH, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 245, 212, 0.85)';
    ctx.font = `${12}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('\u68C0\u7D22', btnX + btnW / 2, btnY + btnH / 2); // 检索
    ctx.textAlign = 'left';

    // 搜索结果（展开式卡片，可滚动）
    if (this._hasSearched) {
      const resultY = inputY + inputH + 10;
      const resultX = panelX + 14;
      const resultMaxW = panelW - 28;

      // QUERY: 行
      ctx.font = `${10}px ${FONT_MONO}`;
      ctx.fillStyle = 'rgba(0, 245, 212, 0.45)';
      ctx.textBaseline = 'top';
      ctx.fillText('QUERY: ', resultX, resultY);

      const qPrefixW = ctx.measureText('QUERY: ').width;
      ctx.fillStyle = 'rgba(0, 245, 212, 0.7)';
      ctx.fillText(this._lastSearchQuery, resultX + qPrefixW, resultY);

      // 清除按钮 ×
      const clearX = panelX + panelW - 24;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = `${14}px ${FONT_PRIMARY}`;
      ctx.fillText('\u00D7', clearX, resultY); // ×

      // 分隔线
      const divY = resultY + 16;
      const divColor = this._searchResultType === 'death_gravity'
        ? 'rgba(255, 68, 68, 0.4)' : 'rgba(0, 245, 212, 0.2)';
      const divGrad = ctx.createLinearGradient(resultX, 0, resultX + resultMaxW, 0);
      divGrad.addColorStop(0, divColor);
      divGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = divGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(resultX, divY);
      ctx.lineTo(resultX + resultMaxW, divY);
      ctx.stroke();

      // 结果文本区域（可滚动）
      const textAreaTop = divY + 6;
      const textAreaBottom = panelY + panelH - 8;
      const textAreaH = textAreaBottom - textAreaTop;

      // 裁剪到结果区域
      ctx.save();
      ctx.beginPath();
      ctx.rect(resultX - 2, textAreaTop, resultMaxW + 4, textAreaH);
      ctx.clip();

      ctx.font = `${13}px ${FONT_MONO}`;
      ctx.textBaseline = 'top';

      // 根据类型设置颜色
      switch (this._searchResultType) {
        case 'normal':
          ctx.fillStyle = 'rgba(224, 230, 237, 0.85)';
          break;
        case 'none':
          ctx.fillStyle = 'rgba(127, 140, 155, 0.7)';
          break;
        case 'restricted':
          ctx.fillStyle = 'rgba(255, 100, 100, 0.85)';
          break;
        case 'death_gravity':
          ctx.fillStyle = '#ffaaaa';
          break;
        default:
          ctx.fillStyle = 'rgba(224, 230, 237, 0.85)';
      }

      // 死亡引力背景
      if (this._searchResultType === 'death_gravity') {
        ctx.fillStyle = 'rgba(80, 0, 0, 0.5)';
        ctx.fillRect(resultX - 4, textAreaTop, resultMaxW + 8, textAreaH);
        ctx.strokeStyle = 'rgba(255, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(resultX - 4, textAreaTop, resultMaxW + 8, textAreaH);
        ctx.fillStyle = '#ffaaaa';
      }

      // 换行绘制全部结果（带滚动偏移）
      const lines = this._wrapText(ctx, this._searchResult, resultMaxW);
      const lineH = 12 * 1.8;
      const textBlockH = lines.length * lineH;

      // 附图尺寸（逻辑像素）
      let imgDisplayW = 0;
      let imgDisplayH = 0;
      if (this._resultImageLoaded && this._resultImage) {
        const dpr = this.engine ? this.engine.getDPR() : 2;
        const naturalW = this._resultImage.width / dpr;
        const naturalH = this._resultImage.height / dpr;
        imgDisplayW = Math.min(resultMaxW, naturalW);
        imgDisplayH = naturalH * (imgDisplayW / naturalW);
      }
      const imgBlockH = imgDisplayH > 0 ? imgDisplayH + 12 : 0;

      const totalContentH = textBlockH + imgBlockH;
      this._resultMaxScrollY = Math.max(0, totalContentH - textAreaH);

      for (let i = 0; i < lines.length; i++) {
        const ly = textAreaTop + i * lineH - this._resultScrollY;
        if (ly + lineH >= textAreaTop && ly <= textAreaBottom) {
          ctx.fillText(lines[i], resultX, ly);
        }
      }

      // 附图（文字之后，8px 间距）
      if (this._resultImageLoaded && this._resultImage && imgDisplayH > 0) {
        const imgY = textAreaTop + textBlockH + 8 - this._resultScrollY;
        if (imgY + imgDisplayH >= textAreaTop && imgY <= textAreaBottom) {
          ctx.drawImage(this._resultImage, resultX, imgY, imgDisplayW, imgDisplayH);
        }
      }

      ctx.restore();

      // 滚动条（结果内容超出可视区时显示）
      if (this._resultMaxScrollY > 0) {
        const barH = Math.max(20, (textAreaH / totalContentH) * textAreaH);
        const barY = textAreaTop + (this._resultScrollY / this._resultMaxScrollY) * (textAreaH - barH);
        ctx.fillStyle = 'rgba(0, 245, 212, 0.2)';
        ctx.fillRect(panelX + panelW - 6, barY, 3, barH);
      }
    }

    ctx.textBaseline = 'top';
    ctx.restore();
  }

  // ---- 推理 Tab 绘制 ----

  _drawReasoningTab(ctx) {
    const sw = this._screenWidth;
    const contentTop = this._getContentTop();

    // 模式切换
    this._drawModeToggle(ctx, contentTop);

    // 3D 球面
    this._drawSphere(ctx, contentTop + 40);

    // 已选展示区
    this._drawSelectedArea(ctx, contentTop + 40 + SPHERE_AREA_SIZE + 4);

    // 推理按钮
    this._drawReasonButton(ctx, contentTop + 40 + SPHERE_AREA_SIZE + 44);

    // 逻辑链路
    const chainY = contentTop + 40 + SPHERE_AREA_SIZE + 90;
    this._drawLogicChain(ctx, chainY);

    // 提示卡片：固定锚在屏幕底部
    if (this._hintCardVisible) {
      this._drawHintCard(ctx);
    }

    // 缺少词条中央提示
    if (this._missingMsgVisible) {
      this._drawMissingEvidenceMsg(ctx);
    }
  }

  /** 提示卡片 — 固定锚在屏幕底部 */
  _drawHintCard(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const margin = 16;
    const cardW = sw - margin * 2;
    const fontSize = 13;
    const lineH = fontSize + 6;
    const paddingH = 12;
    const paddingV = 10;

    ctx.save();
    ctx.font = `${fontSize}px ${FONT_PRIMARY}`;
    ctx.textBaseline = 'top';

    // 文字折行
    const maxTextW = cardW - paddingH * 2;
    const text = this._hintCardText;
    const wrappedLines = [];
    let cur = '';
    for (const ch of text) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxTextW) {
        if (cur) wrappedLines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) wrappedLines.push(cur);

    const cardH = paddingV * 2 + wrappedLines.length * lineH;
    const cardX = margin;
    // 底部锚定：距屏幕底部 16px
    const cardY = sh - cardH - 16;
    const r = 6;

    // 半透明深色背景（低透明度，避免遮挡）
    ctx.globalAlpha = 0.75;
    this._roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.fillStyle = 'rgba(8, 12, 35, 0.5)';
    ctx.fill();

    // 青色发光边框
    ctx.globalAlpha = 1;
    this._roundRect(ctx, cardX, cardY, cardW, cardH, r);
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 荧光文字
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'left';
    for (let i = 0; i < wrappedLines.length; i++) {
      ctx.fillText(wrappedLines[i], cardX + paddingH, cardY + paddingV + i * lineH);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /** 缺少词条提示 — 屏幕中央浮现后淡出 */
  _drawMissingEvidenceMsg(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const msg = this._missingMsgText || '似乎还有没有加入证据板的关键线索……';
    const fontSize = 14;

    ctx.save();
    ctx.globalAlpha = this._missingMsgAlpha;
    ctx.font = `${fontSize}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textW = ctx.measureText(msg).width;
    const padH = 18;
    const padV = 12;
    const boxW = textW + padH * 2;
    const boxH = fontSize + padV * 2;
    const boxX = (sw - boxW) / 2;
    const boxY = sh / 2 - boxH / 2;

    this._roundRect(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.fillStyle = 'rgba(8, 12, 35, 0.9)';
    ctx.fill();

    this._roundRect(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.strokeStyle = 'rgba(155, 93, 229, 0.7)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(155, 93, 229, 0.4)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#c8a8f0';
    ctx.fillText(msg, sw / 2, boxY + boxH / 2);

    ctx.restore();
  }

  /** 模式切换绘制 */
  _drawModeToggle(ctx, y) {
    const sw = this._screenWidth;
    const modes = [
      { key: 'relate', text: '\u5173\u8054' },     // 关联
      { key: 'contradict', text: '\u77DB\u76FE' },  // 矛盾
    ];

    const centerX = sw / 2;
    const gap = 80;
    const toggleY = (y + 16);

    ctx.save();
    for (let i = 0; i < modes.length; i++) {
      const mx = centerX + (i - 0.5) * gap;
      const isActive = this._reasoningMode === modes[i].key;

      // 单选圆
      const radioR = 6;
      const radioX = mx - 20;
      ctx.beginPath();
      ctx.arc(radioX, toggleY, radioR, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? RUNE_CYAN : 'rgba(0, 245, 212, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isActive) {
        ctx.beginPath();
        ctx.arc(radioX, toggleY, radioR - 3, 0, Math.PI * 2);
        ctx.fillStyle = RUNE_CYAN;
        ctx.fill();

        ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // 文字
      ctx.font = `${15}px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive ? RUNE_CYAN : TEXT_SECONDARY;
      if (isActive) {
        ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
        ctx.shadowBlur = 3;
      }
      ctx.fillText(modes[i].text, radioX + radioR + 6, toggleY);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /** 3D 球面绘制 */
  _drawSphere(ctx, y) {
    const sw = this._screenWidth;
    const sphereLeft = (sw - SPHERE_AREA_SIZE) / 2;
    const sx = sphereLeft;
    const sy = y;
    const sSize = SPHERE_AREA_SIZE;

    ctx.save();

    // 球体环境光晕
    const glowR = SPHERE_AREA_SIZE * 0.4;
    const gx = sx + sSize / 2;
    const gy = sy + sSize / 2;
    const ambGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, glowR);
    ambGrad.addColorStop(0, 'rgba(0, 245, 212, 0.04)');
    ambGrad.addColorStop(0.4, 'rgba(0, 245, 212, 0.02)');
    ambGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = ambGrad;
    ctx.beginPath();
    ctx.arc(gx, gy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 环绕轨道线（简化的椭圆）
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(gx, gy, SPHERE_AREA_SIZE * 0.4, SPHERE_AREA_SIZE * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(155, 93, 229, 0.08)';
    ctx.beginPath();
    ctx.ellipse(gx, gy, SPHERE_AREA_SIZE * 0.35, SPHERE_AREA_SIZE * 0.12, Math.PI / 6, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制气泡
    const bubbles = this._projectBubbles();
    for (const b of bubbles) {
      const bx = (sphereLeft + b.screenX);
      const by = (y + b.screenY);
      const scale = b.scale;

      ctx.save();
      ctx.globalAlpha = b.opacity;

      // 气泡胶囊形状
      ctx.font = `${13 * scale}px ${FONT_PRIMARY}`;
      const textW = ctx.measureText(b.name).width;
      const pillW = textW + 24 * scale;
      const pillH = 24 * scale;
      const pillR = pillH / 2;
      const px = bx - pillW / 2;
      const py = by - pillH / 2;

      // 气泡背景
      this._roundRect(ctx, px, py, pillW, pillH, pillR);
      if (b.type === 'result') {
        ctx.fillStyle = 'rgba(180, 255, 245, 0.08)';
      } else {
        ctx.fillStyle = 'rgba(0, 245, 212, 0.06)';
      }
      ctx.fill();

      // 气泡边框
      if (b.selected) {
        ctx.strokeStyle = RUNE_CYAN;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else if (b.hinting) {
        // 引导脉冲
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else {
        const borderColor = b.type === 'result'
          ? 'rgba(180, 255, 245, 0.4)' : 'rgba(0, 245, 212, 0.22)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 气泡文字
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (b.selected) {
        ctx.fillStyle = RUNE_CYAN;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
        ctx.shadowBlur = 3;
      } else if (b.type === 'result') {
        ctx.fillStyle = 'rgba(180, 255, 245, 0.95)';
      } else {
        ctx.fillStyle = TEXT_PRIMARY;
      }
      ctx.fillText(b.name, bx, by);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // 旋转提示
    if (this._showOrbitHint && this._orbitHintAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this._orbitHintAlpha;
      ctx.font = `${13}px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0, 245, 212, 0.7)';
      ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
      ctx.shadowBlur = 4;
      ctx.fillText('\u27F2 \u62D6\u52A8\u65CB\u8F6C', gx, sy + sSize - 10); // ⟲ 拖动旋转
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /** 已选展示区绘制 */
  _drawSelectedArea(ctx, y) {
    const sw = this._screenWidth;
    const areaY = y;
    const areaH = 32;

    ctx.save();
    // 「已选：」标签
    ctx.font = `${13}px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('\u5DF2\u9009\uFF1A', 12, areaY + areaH / 2); // 已选：

    const slotW = 88;
    const gap = 16;
    const totalW = slotW * 2 + gap;
    const startX = (sw - totalW) / 2;
    const slotH = 24;
    const slotY = areaY + (areaH - slotH) / 2;

    for (let i = 0; i < 2; i++) {
      const sx = startX + i * (slotW + gap);
      const bubble = this._selectedBubbles[i];

      if (bubble) {
        // 选中标签
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.3)';
        ctx.fillStyle = 'rgba(0, 245, 212, 0.05)';
        this._roundRect(ctx, sx, slotY, slotW, slotH, 3);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = RUNE_CYAN;
        ctx.font = `${13}px ${FONT_PRIMARY}`;
        ctx.fillText(bubble.name, sx + slotW / 2, slotY + slotH / 2);

        // 关闭按钮 ✕
        ctx.fillStyle = 'rgba(0, 245, 212, 0.5)';
        ctx.font = `${12}px ${FONT_PRIMARY}`;
        ctx.fillText('\u2715', sx + slotW - 10, slotY + slotH / 2);
      } else {
        // 空槽位
        ctx.textAlign = 'center';
        ctx.fillStyle = TEXT_DIM;
        ctx.font = `${13}px ${FONT_PRIMARY}`;
        ctx.globalAlpha = 0.4;
        ctx.fillText('\u2014', sx + slotW / 2, slotY + slotH / 2); // —
        ctx.globalAlpha = 1;
      }

      // 分隔符 |
      if (i === 0) {
        ctx.fillStyle = TEXT_DIM;
        ctx.globalAlpha = 0.3;
        ctx.font = `${13}px ${FONT_PRIMARY}`;
        ctx.fillText('|', startX + slotW + gap / 2, slotY + slotH / 2);
        ctx.globalAlpha = 1;
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /** 推理按钮绘制 */
  _drawReasonButton(ctx, y) {
    const sw = this._screenWidth;
    const btnW = (sw - 80);
    const btnH = 36;
    const btnX = 40;
    const btnY = y;
    const active = this._canReason;

    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.4;

    // 背景
    this._roundRect(ctx, btnX, btnY, btnW, btnH, 4);
    if (active) {
      const grad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
      grad.addColorStop(0, 'rgba(0, 245, 212, 0.08)');
      grad.addColorStop(1, 'rgba(0, 200, 170, 0.06)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = RUNE_CYAN;
      ctx.shadowColor = 'rgba(0, 245, 212, 0.15)';
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = 'rgba(0, 245, 212, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
    }
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 图标 + 文字
    const icon = this._reasoningMode === 'relate' ? '\uD83D\uDD17' : '\u26A1'; // 🔗 or ⚡
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${15}px ${FONT_PRIMARY}`;
    ctx.fillStyle = active ? RUNE_CYAN : TEXT_SECONDARY;
    if (active) {
      ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
      ctx.shadowBlur = 4;
    }
    ctx.fillText(`${icon}  \u63A8 \u7406`, btnX + btnW / 2, btnY + btnH / 2); // 推 理
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /** 逻辑链路绘制 */
  _drawLogicChain(ctx, y) {
    const sw = this._screenWidth;
    const px = 12;
    const chainY = y;

    ctx.save();

    // 链路标题栏
    const titleY = chainY;
    const lineW = 60;

    // 左线
    const lineGrad1 = ctx.createLinearGradient(px, 0, px + lineW, 0);
    lineGrad1.addColorStop(0, 'transparent');
    lineGrad1.addColorStop(1, 'rgba(0, 245, 212, 0.12)');
    ctx.strokeStyle = lineGrad1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, titleY + 8);
    ctx.lineTo(px + lineW, titleY + 8);
    ctx.stroke();

    // 标题
    ctx.font = `${12}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('\u903B\u8F91\u94FE\u8DEF', sw / 2 - 24, titleY + 8); // 逻辑链路

    // 计数
    ctx.fillStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.fillText(
      `${this._completedCount}/${reasoningCombos.length}`,
      sw / 2 + 34,
      titleY + 8
    );

    // 右线
    const lineGrad2 = ctx.createLinearGradient(sw - px - lineW, 0, sw - px, 0);
    lineGrad2.addColorStop(0, 'rgba(0, 245, 212, 0.12)');
    lineGrad2.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad2;
    ctx.beginPath();
    ctx.moveTo(sw - px - lineW, titleY + 8);
    ctx.lineTo(sw - px, titleY + 8);
    ctx.stroke();

    // 链路列表项
    const itemStartY = titleY + 24;
    const itemH = 36; // 已完成项多一行来源标注

    for (let i = 0; i < this._logicChain.length; i++) {
      const item = this._logicChain[i];
      const iy = itemStartY + i * itemH;

      // 已完成的高亮背景
      if (item.completed) {
        ctx.fillStyle = 'rgba(0, 245, 212, 0.04)';
        this._roundRect(ctx, px, iy, (sw - px * 2), itemH - 4, 3);
        ctx.fill();
      }

      // 图标
      ctx.font = `${13}px ${FONT_PRIMARY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (item.completed) {
        ctx.fillStyle = RUNE_CYAN;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('\u25C8', (px + 8), iy + (itemH - 4) / 2); // ◈
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = TEXT_DIM;
        ctx.fillText('\u25C7', (px + 8), iy + (itemH - 4) / 2); // ◇
      }

      // 名称
      ctx.font = `${14}px ${FONT_PRIMARY}`;
      ctx.fillStyle = item.completed ? TEXT_PRIMARY : TEXT_DIM;
      ctx.fillText(
        item.completed ? item.resultName : '???',
        (px + 24),
        iy + (itemH - 4) / 2
      );

      // 模式标签
      if (item.completed) {
        const modeText = item.mode === 'relate' ? '\u5173\u8054' : '\u77DB\u76FE'; // 关联 / 矛盾
        ctx.font = `${11}px ${FONT_MONO}`;
        const modeW = ctx.measureText(modeText).width + 12;
        const modeX = (sw - px - 8) - modeW;
        const modeY = iy + (itemH - 4) / 2 - 8;

        ctx.strokeStyle = 'rgba(0, 245, 212, 0.15)';
        ctx.lineWidth = 1;
        this._roundRect(ctx, modeX, modeY, modeW, 16, 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 245, 212, 0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(modeText, modeX + modeW / 2, iy + (itemH - 4) / 2);
      }

      // 来源词条小字（已完成项）
      if (item.completed && item.sourceIds) {
        const resolveSrcName = (sid) => {
          if (evidenceList[sid]) return evidenceList[sid].name;
          const rc = reasoningCombos.find(c => c.resultId === sid);
          return rc ? rc.resultName : sid;
        };
        const srcText = item.sourceIds.map(resolveSrcName).join(' × ');
        ctx.font = `10px ${FONT_MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,245,212,0.38)';
        ctx.fillText(srcText, px + 24, iy + itemH - 10);
      }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  // ---- 气泡预览弹窗绘制 ----

  _drawBubblePreview(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const bubble = this._previewBubble;
    if (!bubble) return;

    ctx.save();
    ctx.globalAlpha = this._previewAlpha;

    // 遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, sw, sh);

    // 卡片
    const cardW = 280;
    const cardH = 220;
    const cx = (sw - cardW) / 2;
    const cy = (sh - cardH) / 2;
    const cut = 8;

    // 背景
    ctx.beginPath();
    ctx.moveTo(cx + cut, cy);
    ctx.lineTo(cx + cardW - cut, cy);
    ctx.lineTo(cx + cardW, cy + cut);
    ctx.lineTo(cx + cardW, cy + cardH - cut);
    ctx.lineTo(cx + cardW - cut, cy + cardH);
    ctx.lineTo(cx + cut, cy + cardH);
    ctx.lineTo(cx, cy + cardH - cut);
    ctx.lineTo(cx, cy + cut);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 20, 22, 0.97)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 扫描线
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.008)';
    for (let sy = 0; sy < cardH; sy += 4) {
      ctx.fillRect(cx, cy + sy, cardW, 1);
    }
    ctx.restore();

    let curY = cy + 20;

    // 类型标签
    const tagText = bubble.type === 'result' ? '推理线索' : '证据'; // 推理线索 / 证据
    const tagColor = bubble.type === 'result' ? 'rgba(180, 255, 245, 0.9)' : RUNE_CYAN;
    const tagBorder = bubble.type === 'result' ? 'rgba(180, 255, 245, 0.3)' : 'rgba(0, 245, 212, 0.3)';
    ctx.font = `${9}px ${FONT_MONO}`;
    const tagW = ctx.measureText(tagText).width + 14;
    ctx.strokeStyle = tagBorder;
    ctx.fillStyle = bubble.type === 'result' ? 'rgba(180, 255, 245, 0.06)' : 'rgba(0, 245, 212, 0.06)';
    this._roundRect(ctx, cx + 18, curY, tagW, 16, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tagColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, cx + 25, curY + 8);
    curY += 26;

    // 名称
    ctx.font = `bold ${16}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textBaseline = 'top';
    ctx.fillText(bubble.name, cx + 18, curY);
    curY += 24;

    // 分隔线
    const sepGrad = ctx.createLinearGradient(cx + 18, 0, cx + cardW - 18, 0);
    sepGrad.addColorStop(0, 'rgba(0, 245, 212, 0.15)');
    sepGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 18, curY);
    ctx.lineTo(cx + cardW - 18, curY);
    ctx.stroke();
    curY += 10;

    // 描述（优先用 searchDB 结果，与线索 Tab 点击词条一致）
    ctx.font = `${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.textBaseline = 'top';
    const descMaxW = cardW - 36;
    const descLines = this._wrapText(ctx, bubble.desc, descMaxW);
    const descLineH = 12 * 1.8;
    for (let i = 0; i < Math.min(descLines.length, 4); i++) {
      ctx.fillText(descLines[i], cx + 18, curY + i * descLineH);
    }

    // 按钮
    const btnGap = 12;
    const btnW = (cardW - 36 - btnGap) / 2;
    const btnH = 36;
    const btnY = cy + cardH - 50;
    const btn1X = cx + 12;
    const btn2X = btn1X + btnW + btnGap;

    // 取消按钮
    this._roundRect(ctx, btn1X, btnY, btnW, btnH, 3);
    ctx.fillStyle = 'rgba(127, 140, 155, 0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(127, 140, 155, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `${13}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.fillText('取消', btn1X + btnW / 2, btnY + btnH / 2); // 取消

    // 选择按钮
    this._roundRect(ctx, btn2X, btnY, btnW, btnH, 3);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.3)';
    ctx.stroke();
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
    ctx.shadowBlur = 3;
    ctx.fillText('选择', btn2X + btnW / 2, btnY + btnH / 2); // 选择
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  // ---- 推理结果覆层绘制 ----

  _drawResultOverlay(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;

    ctx.save();

    // 遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, sw, sh);

    // 结果框（高度根据文字内容动态计算，避免溢出）
    const boxW = 310;
    const pad = 18;
    const contentW = boxW - pad * 2;
    const titleLineH = 14 * 1.5;
    const resultLineH = 12 * 1.9;

    ctx.font = `${14}px ${FONT_PRIMARY}`;
    const titleText = `推理线索「${this._resultTitle}」加入逻辑链路`;
    const titleLines = this._wrapText(ctx, titleText, contentW);

    ctx.font = `${12}px ${FONT_MONO}`;
    const fullLines = this._wrapText(ctx, this._resultFullText || this._resultDisplayText, contentW);

    const neededH = 20 + 20 + titleLines.length * titleLineH + 10 + 12 + fullLines.length * resultLineH + 36;
    const boxH = Math.min(neededH, Math.floor(sh * 0.85));
    const bx = (sw - boxW) / 2;
    const by = (sh - boxH) / 2;

    // 背景
    const bgGrad = ctx.createLinearGradient(bx, by, bx + boxW, by + boxH);
    bgGrad.addColorStop(0, 'rgba(8, 12, 32, 0.97)');
    bgGrad.addColorStop(1, 'rgba(5, 8, 25, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(bx, by, boxW, boxH);

    // 边框
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, boxW, boxH);

    // 顶部青色光线
    const lineGrad = ctx.createLinearGradient(bx + boxW * 0.15, 0, bx + boxW * 0.85, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, RUNE_CYAN);
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(bx + boxW * 0.15, by);
    ctx.lineTo(bx + boxW * 0.85, by);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    let curY = by + 20;

    // SYSTEM 标签
    ctx.font = `${9}px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SYSTEM', bx + pad, curY);
    curY += 20;

    // 标题（发光）
    ctx.font = `${14}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
    ctx.shadowBlur = 4;
    for (let i = 0; i < titleLines.length; i++) {
      ctx.fillText(titleLines[i], bx + pad, curY + i * titleLineH);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    curY += titleLines.length * titleLineH + 10;

    // 分隔线
    const sepGrad = ctx.createLinearGradient(bx + pad, 0, bx + boxW, 0);
    sepGrad.addColorStop(0, 'rgba(0, 245, 212, 0.15)');
    sepGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + pad, curY);
    ctx.lineTo(bx + boxW - pad, curY);
    ctx.stroke();
    curY += 12;

    // 逐字打印文字（当前已打印部分）
    ctx.font = `${12}px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(0, 245, 212, 0.85)';
    const resultLines = this._wrapText(ctx, this._resultDisplayText, contentW);
    for (let i = 0; i < resultLines.length; i++) {
      ctx.fillText(resultLines[i], bx + pad, curY + i * resultLineH);
    }

    // close button
    const closeBtnW = 80;
    const closeBtnH = 28;
    const closeBtnX = bx + (boxW - closeBtnW) / 2;
    const closeBtnY = by + boxH - closeBtnH - 12;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0, 245, 212, 0.1)';
    this._roundRect(ctx, closeBtnX, closeBtnY, closeBtnW, closeBtnH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, closeBtnX, closeBtnY, closeBtnW, closeBtnH, 4);
    ctx.stroke();
    ctx.font = `${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('确认', closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2);
    this._resultCloseBtnRect = { x: closeBtnX, y: closeBtnY, w: closeBtnW, h: closeBtnH };

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  // ==================== 法司大人封锁序列绘制 ====================

  _drawLockdownSequence(ctx) {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    ctx.save();

    // ── 暗红遮罩 ──
    if (this._lockdownOverlayAlpha > 0) {
      ctx.globalAlpha = this._lockdownOverlayAlpha;
      ctx.fillStyle = 'rgba(80, 0, 0, 1)';
      ctx.fillRect(0, 0, sw, sh);
      ctx.globalAlpha = 1;
    }

    // ── 警告面板 ──
    if (this._lockdownWarningAlpha > 0) {
      ctx.globalAlpha = this._lockdownWarningAlpha;
      const cx = sw / 2;
      const cy = sh * 0.42;

      // 红色等边三角形（脉冲）
      const pulse = 0.88 + 0.12 * Math.sin(this._lockdownTriPhase);
      const triSize = 52 * pulse;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 40, 40, 0.9)';
      ctx.shadowBlur = 18 * pulse;
      ctx.strokeStyle = '#ff2828';
      ctx.fillStyle = 'rgba(180, 0, 0, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - triSize);
      ctx.lineTo(cx + triSize * 0.866, cy + triSize * 0.5);
      ctx.lineTo(cx - triSize * 0.866, cy + triSize * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 三角内的 ! 符号
      ctx.font = `bold ${28}px ${FONT_MONO}`;
      ctx.fillStyle = '#ff4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 60, 60, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText('!', cx, cy + triSize * 0.08);
      ctx.shadowBlur = 0;

      // 警告！标签
      ctx.font = `bold ${22}px ${FONT_PRIMARY}`;
      ctx.fillStyle = '#ff3333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(255, 40, 40, 0.7)';
      ctx.shadowBlur = 10;
      ctx.fillText('警告！', cx, cy + triSize * 0.5 + 18);
      ctx.shadowBlur = 0;

      // 逐字打印文字
      if (this._lockdownTypingText) {
        ctx.font = `bold ${14}px ${FONT_MONO}`;
        ctx.fillStyle = '#ff3333';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 40, 40, 0.7)';
        ctx.shadowBlur = 8;
        ctx.fillText(this._lockdownTypingText, cx, cy + triSize * 0.5 + 52);
        ctx.shadowBlur = 0;
      }

      // WARNING 滚动横幅（底部区域）
      if (this._lockdownTimer > 4700) {
        const scrollY = sh * 0.75;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, scrollY - 14, sw, 28);
        ctx.clip();
        ctx.font = `bold ${14}px ${FONT_MONO}`;
        ctx.fillStyle = '#ff2020';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(255, 30, 30, 0.7)';
        ctx.shadowBlur = 5;
        // 绘制两段以实现无缝循环
        const warningStr = '⚠ WARNING  ⚠ WARNING  ⚠ WARNING  ⚠ WARNING  ';
        ctx.fillText(warningStr, this._lockdownScrollX, scrollY);
        ctx.fillText(warningStr, this._lockdownScrollX + 500, scrollY);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
    }

    // ── Banner1：识别到重要嫌疑人 ──
    if (this._lockdownBanner1Alpha > 0) {
      this._drawNotifBanner(ctx, sw, this._lockdownBanner1Y, this._lockdownBanner1Alpha,
        '[法司大人·档录系统]',
        '识别到连接对象为重要嫌疑人，开启自动封锁功能',
        '#ff4444'
      );
    }

    // ── Banner2：调查官授权恢复（用青色区别于封锁的红色） ──
    if (this._lockdownBanner2Alpha > 0) {
      this._drawNotifBanner(ctx, sw, this._lockdownBanner2Y, this._lockdownBanner2Alpha,
        '[法司大人·档录系统]',
        '调查官授权通过，恢复链接对象权限',
        '#00f5d4'
      );
    }

    ctx.restore();
  }

  /** 绘制手机通知横幅 */
  _drawNotifBanner(ctx, sw, bannerY, alpha, title, body, accentColor) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = sw - 24;
    const bh = 56;
    const bx = 12;
    const br = 12;

    // 背景
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(12, 16, 38, 0.95)';
    this._roundRect(ctx, bx, bannerY, bw, bh, br);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 左侧强调色竖线
    ctx.fillStyle = accentColor;
    ctx.fillRect(bx + 4, bannerY + 10, 3, bh - 20);

    // 边框
    ctx.strokeStyle = 'rgba(60, 60, 90, 0.6)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, bx, bannerY, bw, bh, br);
    ctx.stroke();

    // 标题
    ctx.font = `${9}px ${FONT_MONO}`;
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, bx + 14, bannerY + 10);

    // 正文（颜色跟随 accentColor，封锁用红，恢复用青）
    ctx.font = `bold ${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = accentColor;
    ctx.fillText(body, bx + 14, bannerY + 26);

    ctx.restore();
  }

  // ==================== 工具方法 ====================

  /** 绘制圆角矩形路径 */
  _roundRect(ctx, x, y, w, h, r) {
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

  /** 文字换行 */
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
}
