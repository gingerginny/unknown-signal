/**
 * GhostChatPage.js - 幽灵通讯页面（Matrix 风格终端）
 * 继承 Scene，完整还原 ghost-chat 页面
 * ch4 阶段：幽灵通过终端与玩家交互式对话，玩家从证据池中选择证据回答问题
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { Tween } from '../engine/Tween.js';
import MatrixRain from '../effects/MatrixRain.js';
import CRTEffect from '../effects/CRTEffect.js';
import ScanlineEffect from '../effects/ScanlineEffect.js';
import gameState from '../core/GameState.js';
import {
  RUNE_CYAN, BG_DARK,
  TEXT_PRIMARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL,
} from '../style/StyleConfig.js';

import { evidenceList, reasoningCombos } from '../data/story.js';

// 每个幽灵问题的专属证据池（正确选项 + 3个干扰项）
// 顺序：正确答案 ID 排第一，其余为干扰项
const GHOST_QUESTION_POOLS = [
  // Q1 你认为我是谁？(凶手)
  ['ghost', 'xinghe', 'weizi_cluster', 'fasi'],
  // Q2 我用什么杀死了她？(凶器)
  ['weapon', 'spacetime_disturbance', 'weizi_conversion', 'consciousness_archive'],
  // Q3 密室是如何形成的？(locked_room_cause)
  ['locked_room_cause', 'surveillance', 'spirit_elevator', 'x_structure'],
  // Q4 我是什么？(weizi_cluster)
  ['weizi_cluster', 'ghost', 'fasi', 'collective_wisdom'],
  // Q5 如何杀死一个万界以外的人？(weizi_conversion)
  ['weizi_conversion', 'weizi', 'spacetime_disturbance', 'consciousness_archive'],
  // Q6 是因是果？(cause_and_effect)
  ['cause_and_effect', 'impossible_leap', 'leap_framework', 'x_structure'],
];

// ====== 终端色彩常量 ======
const TERM_GREEN = 'rgba(0, 255, 65, 0.9)';
const TERM_GREEN_DIM = 'rgba(0, 255, 65, 0.45)';
const TERM_GREEN_FAINT = 'rgba(0, 255, 65, 0.15)';
const TERM_CYAN = 'rgba(0, 200, 255, 0.9)';
const TERM_CYAN_DIM = 'rgba(0, 200, 255, 0.45)';
const TERM_BG = '#050808';

// ====== 布局常量 ======
const HEADER_HEIGHT = 56;
const MSG_PADDING = 10;
const MSG_GAP = 12;
const PANEL_HEIGHT_RATIO = 0.33;

// ====== 消息延迟 ======
const MSG_DELAY = 1200;
const CHAR_SPEED = 30;

// ── 幽灵开场白 ──
const GHOST_INTRO = [
  { type: 'system', text: '检测到新的通讯信号' },
  { type: 'system', text: '信号来源：本地维度' },
  { type: 'ghost', text: '你好，我就是幽灵，很荣幸与你正式见面。' },
  { type: 'ghost', text: '不用急着去联系星河，在我跟你对话的时刻，她打扰不了我们。' },
  { type: 'ghost', text: '到现在，你已经明白了多少呢？' },
  { type: 'ghost', text: '阿里亚斯的通讯仪，还剩最后的加密笔记没有解开。' },
  { type: 'ghost', text: '想要解开最后的真相，那你需要先回答我几个问题。只有确认你真的理解事情是如何发展后，我才能告诉你一切。' },
];

// ── 幽灵提问序列（6 道） ──
const GHOST_QUESTIONS = [
  {
    id: 'q1',
    question: '首先，杀死阿里亚斯的凶手是谁？',
    correctId: 'ghost',
    wrongHint: '回答错误，再试一次。',
    correctResponse: [
      '我的确是杀死阿里亚斯的凶手，你的回答没有问题。',
      '那杀人手法，想必也显而易见吧。',
    ],
  },
  {
    id: 'q2',
    question: null,
    correctId: 'weapon',
    wrongHint: '其实很简单，再试一次。',
    correctResponse: [
      '凶手也找到了，凶器也找到了。',
      '那么密室的谜题你破解了吗？',
      '一个可以确定的事实，灵梯除阿里亚斯之外无人进出，那阿里亚斯是怎么被我杀死的呢？',
    ],
  },
  {
    id: 'q3',
    question: null,
    correctId: 'locked_room_cause',
    wrongHint: '不是这个，再试一次。',
    correctResponse: [
      '接下来的答案也显而易见了，我是什么？',
    ],
  },
  {
    id: 'q4',
    question: null,
    correctId: 'weizi_cluster',
    wrongHint: '再试试，除了幽灵这个名字之外，我是什么？',
    correctResponse: [
      '是的，我并非人，而是从法司大人那里意外逃逸事件中残存下来，拥有自我意识的微子团。',
      '那么，没有躯体的我，到底是如何杀死阿里亚斯的呢？',
    ],
  },
  {
    id: 'q5',
    question: null,
    correctId: 'weizi_conversion',
    wrongHint: '哼哼，不对，再试一次。',
    correctResponse: [
      '你说得没错，作为法司大人逃逸的一部分，我也具有自体微子转化能量的本领。',
      '就是我附着在那把匕首上，然后把它送进了阿里亚斯的胸膛。',
      '……',
      '抱歉，本来以为我不会有太多波动，结果亲口说出来，又是另一种感觉了。',
      '对星河来说，阿里亚斯已经死了三天，对我来说，我是刚刚才杀死她的。',
      '你应该明白我为什么这么说吧。',
    ],
  },
  {
    id: 'q6',
    question: null,
    correctId: 'cause_and_effect',
    wrongHint: '其实你刚刚已经推理出来了，再试试。',
    correctResponse: [
      '是个聪明的计谋没错吧。',
      '当然，也没有那么聪明。毕竟想出这个计谋的人，是以自己的死亡为代价的。',
    ],
  },
];

// ── 幽灵终章对话 ──
const GHOST_FINAL = [
  { type: 'ghost', text: '我想我已经没有别的问题要问你了。' },
  { type: 'ghost', text: '如果你还有想要知道的，就去看看阿里亚斯的记事本吧。' },
  { type: 'ghost', text: '图形密码应该不需要我再提示了吧，之前你应该看到它很多次了。' },
  { type: 'ghost', text: '至于后面的数字密码，可能需要你用上你们世界的科技。' },
  { type: 'ghost', text: '...-- ----- ..--- .---- .---- .---- ----- -....' },
  { type: 'ghost', text: '接下来，就不用我多说了吧。' },
];

export class GhostChatPage extends Scene {
  constructor() {
    super();

    // 屏幕尺寸
    this._screenWidth = 375;
    this._screenHeight = 667;

    // 效果系统
    this._matrixRain = null;
    this._crtEffect = null;
    this._scanlineEffect = null;

    // UI 节点
    this._scrollView = null;
    this._msgContainer = null;
    this._evidencePanelNode = null;
    this._bottomStatusNode = null;

    // 消息数据
    this._messages = [];      // [{type, text, id}]
    this._msgId = 0;
    this._contentHeight = MSG_PADDING;

    // 阶段控制
    this._phase = 'intro';    // 'intro' | 'questioning' | 'final' | 'done'
    this._currentQuestion = 0;

    // 证据面板
    this._showEvidencePanel = false;
    this._evidencePool = [];   // [{id, name, type}]
    this._evidenceItems = [];  // 证据项的 Node 数组

    // 打字效果
    this._isTyping = false;
    this._typeTimer = null;
    this._queueTimer = null;

    // 信号灯脉冲
    this._signalPulseTimer = 0;
    this._signalDotNode = null;

    // 打字指示器
    this._typingDotsTimer = 0;
    this._typingDotsAlpha = [0.3, 0.3, 0.3];
    this._typingNode = null;
  }

  // ==================== 生命周期 ====================

  onEnter() {
    const engine = this.engine;
    this._screenWidth = engine.getWidth();
    this._screenHeight = engine.getHeight();

    this.width = this._screenWidth;
    this.height = this._screenHeight;

    // 初始化效果系统
    this._initEffects();

    // 构建 UI
    this._buildBackground();
    this._buildHeader();
    this._buildMessageArea();
    this._buildTypingIndicator();
    this._buildBottomStatus();

    // 构建证据池
    this._buildEvidencePool(this._currentQuestion);

    // 检查是否已完成
    const state = gameState.get();
    if (state.choices && state.choices.ghostChatDone) {
      this._showCompletedState();
      return;
    }

    // 开始幽灵开场白
    this._playMessageQueue(GHOST_INTRO, () => {
      this._phase = 'questioning';
      this._askQuestion(0);
    });
  }

  onExit() {
    if (this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    if (this._queueTimer) {
      clearTimeout(this._queueTimer);
      this._queueTimer = null;
    }
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
  }

  // ==================== 效果初始化 ====================

  _initEffects() {
    // 矩阵代码雨（在物理像素下工作）
    this._matrixRain = new MatrixRain({
      width: this._screenWidth,
      height: this._screenHeight,
      fontSize: 14,
      trailLength: 15,
      density: 0.5,
    });

    // CRT 暗角
    this._crtEffect = new CRTEffect({
      width: this._screenWidth,
      height: this._screenHeight,
      vignetteAlpha: 0.5,
      flicker: false,
    });

    // 扫描线
    this._scanlineEffect = new ScanlineEffect({
      width: this._screenWidth,
      height: this._screenHeight,
      lineAlpha: 0.012,
      spacing: 4,
      scrollSpeed: 0.2,
    });
  }

  // ==================== UI 构建 ====================

  /**
   * 构建终端暗色背景
   */
  _buildBackground() {
    const bgNode = new Graphics();
    bgNode.clear()
      .beginPath()
      .rect(0, 0, this._screenWidth, this._screenHeight)
      .fill(TERM_BG);
    bgNode.width = this._screenWidth;
    bgNode.height = this._screenHeight;
    bgNode.zIndex = -10;
    this.addChild(bgNode);
  }

  /**
   * 构建自定义导航栏
   */
  _buildHeader() {
    const headerNode = new Node();
    headerNode.width = this._screenWidth;
    headerNode.height = HEADER_HEIGHT;
    headerNode.zIndex = 100;
    this.addChild(headerNode);

    const self = this;

    // 导航栏背景
    const headerBgNode = new Node();
    headerBgNode.width = this._screenWidth;
    headerBgNode.height = HEADER_HEIGHT;
    headerBgNode._draw = function(ctx) {
      const w = self._screenWidth;
      const h = HEADER_HEIGHT;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(5, 8, 8, 0.98)');
      grad.addColorStop(1, 'rgba(5, 8, 8, 0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };
    headerNode.addChild(headerBgNode);

    // 返回按钮
    const backBtn = new Node();
    backBtn.x = 16;
    backBtn.y = 16;
    backBtn.width = 28;
    backBtn.height = 28;
    backBtn.interactive = true;
    backBtn.on('tap', () => this._onBack());
    headerNode.addChild(backBtn);

    // 返回按钮背景圆
    const backBg = new Graphics();
    backBg.clear()
      .beginPath()
      .arc(14, 14, 14, 0, Math.PI * 2)
      .fill('rgba(0, 255, 65, 0.03)')
      .beginPath()
      .arc(14, 14, 14, 0, Math.PI * 2)
      .stroke(TERM_GREEN_FAINT, 0.5);
    backBtn.addChild(backBg);

    // 返回箭头
    const backArrow = new Label({
      text: '＜',
      fontSize: 15,
      color: TERM_GREEN_DIM,
      textAlign: 'center',
    });
    backArrow.width = 28;
    backArrow.y = 5;
    backBtn.addChild(backArrow);

    // 中部标题区域
    // 信号点（心跳脉冲）
    this._signalDotNode = new Graphics();
    this._signalDotNode.x = this._screenWidth / 2;
    this._signalDotNode.y = 12;
    this._updateSignalDot(1.0);
    headerNode.addChild(this._signalDotNode);

    // 标题
    const titleLabel = new Label({
      text: '未知信号',
      fontSize: 15,
      color: TERM_GREEN,
      textAlign: 'center',
      shadowLayers: [
        { color: 'rgba(0, 255, 65, 0.4)', blur: 4 },
      ],
    });
    titleLabel.width = this._screenWidth;
    titleLabel.y = 24;
    headerNode.addChild(titleLabel);

    // 副标题
    const subtitleLabel = new Label({
      text: 'UNKNOWN SIGNAL',
      fontSize: 9,
      color: TERM_GREEN_DIM,
      textAlign: 'center',
      fontFamily: FONT_MONO,
    });
    subtitleLabel.width = this._screenWidth;
    subtitleLabel.y = 44;
    headerNode.addChild(subtitleLabel);

    // 底部分隔线
    const lineNode = new Node();
    lineNode.x = 0;
    lineNode.y = HEADER_HEIGHT - 1;
    lineNode.width = this._screenWidth;
    lineNode.height = 1;
    lineNode._draw = function(ctx) {
      const w = self._screenWidth;

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, TERM_GREEN_FAINT);
      grad.addColorStop(0.5, 'rgba(0, 255, 65, 0.08)');
      grad.addColorStop(0.7, TERM_GREEN_FAINT);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 1);
    };
    headerNode.addChild(lineNode);
  }

  /**
   * 更新信号灯
   */
  _updateSignalDot(alpha) {
    this._signalDotNode.clear()
      .beginPath()
      .arc(0, 0, 3, 0, Math.PI * 2)
      .shadow('rgba(0, 255, 65, 0.6)', 4)
      .fill(TERM_GREEN)
      .noShadow();
    this._signalDotNode.alpha = alpha;
  }

  /**
   * 构建消息滚动区域
   */
  _buildMessageArea() {
    const topOffset = HEADER_HEIGHT + 6; // 导航栏底部缓冲
    const bottomOffset = 40; // 底部状态栏高度
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
    this._scrollView.zIndex = 10;
    this._scrollView.interactive = true;

    // 注册触摸事件
    this._scrollView.on('touchstart', (e) => {
      this._scrollView.onTouchStart(e.y - this._scrollView.y);
      e.stopPropagation();
    });
    this._scrollView.on('touchmove', (e) => {
      this._scrollView.onTouchMove(e.y - this._scrollView.y);
      e.stopPropagation();
    });
    this._scrollView.on('touchend', () => {
      this._scrollView.onTouchEnd();
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
   * 构建打字指示器
   */
  _buildTypingIndicator() {
    const self = this;
    this._typingNode = new Node();
    this._typingNode.visible = false;
    this._typingNode.width = 60;
    this._typingNode.height = 20;

    this._typingNode._draw = function(ctx) {
      const dotR = 3;
      const dotGap = 10;
      const startX = 14;
      const dotY = 10;

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotGap, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = TERM_GREEN_DIM;
        ctx.globalAlpha = self._typingDotsAlpha[i];
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    this._scrollView.addChild(this._typingNode);
  }

  /**
   * 构建底部状态栏
   */
  _buildBottomStatus() {
    const self = this;
    this._bottomStatusNode = new Node();
    this._bottomStatusNode.x = 0;
    this._bottomStatusNode.y = this._screenHeight - 40;
    this._bottomStatusNode.width = this._screenWidth;
    this._bottomStatusNode.height = 40;
    this._bottomStatusNode.zIndex = 50;

    // 渐变背景
    const statusBg = new Node();
    statusBg.width = this._screenWidth;
    statusBg.height = 40;
    statusBg._draw = function(ctx) {
      const w = self._screenWidth;
      const h = 40;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, 'rgba(5, 8, 8, 0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };
    this._bottomStatusNode.addChild(statusBg);

    // 状态文字
    this._statusLabel = new Label({
      text: '等待输入',
      fontSize: 11,
      color: TERM_GREEN_DIM,
      textAlign: 'center',
      fontFamily: FONT_MONO,
    });
    this._statusLabel.width = this._screenWidth;
    this._statusLabel.y = 12;
    this._bottomStatusNode.addChild(this._statusLabel);

    this.addChild(this._bottomStatusNode);
  }

  // ==================== 证据池 ====================

  _buildEvidencePool(questionIdx) {
    const state = gameState.get();
    const collectedIds = state.collectedEvidence || [];
    const reasoningResults = state.reasoningResults || [];
    const allIds = new Set([...collectedIds, ...reasoningResults]);

    // 使用问题专属池（已收集的才显示）
    const questionPool = (questionIdx !== undefined && GHOST_QUESTION_POOLS[questionIdx])
      ? GHOST_QUESTION_POOLS[questionIdx]
      : null;

    const pool = [];
    const idsToShow = questionPool || [...allIds];

    idsToShow.forEach(id => {
      if (!allIds.has(id)) return; // 未收集则跳过
      const comboResult = reasoningCombos.find(c => c.resultId === id);
      if (comboResult) {
        pool.push({ id, name: comboResult.resultName, type: 'result' });
      } else if (evidenceList[id]) {
        pool.push({ id, name: evidenceList[id].name, type: 'evidence' });
      }
    });

    this._evidencePool = pool;
  }

  // ==================== 证据面板显示/隐藏 ====================

  _setEvidencePanel(show) {
    this._showEvidencePanel = show;

    if (show) {
      this._buildEvidencePanelUI();
      // 调整消息区域高度
      const panelH = Math.round(this._screenHeight * PANEL_HEIGHT_RATIO);
      this._scrollView.height = this._screenHeight - HEADER_HEIGHT - panelH;
      this._bottomStatusNode.visible = false;
    } else {
      if (this._evidencePanelNode) {
        this._evidencePanelNode.removeFromParent();
        this._evidencePanelNode = null;
      }
      this._evidenceItems = [];
      // 恢复消息区域高度
      this._scrollView.height = this._screenHeight - HEADER_HEIGHT - 40;
      this._bottomStatusNode.visible = true;
    }
  }

  /**
   * 构建证据选择面板 UI
   */
  _buildEvidencePanelUI() {
    // 移除旧面板
    if (this._evidencePanelNode) {
      this._evidencePanelNode.removeFromParent();
    }

    const panelH = Math.round(this._screenHeight * PANEL_HEIGHT_RATIO);
    const panelY = this._screenHeight - panelH;
    const self = this;

    this._evidencePanelNode = new Node();
    this._evidencePanelNode.x = 0;
    this._evidencePanelNode.y = panelY;
    this._evidencePanelNode.width = this._screenWidth;
    this._evidencePanelNode.height = panelH;
    this._evidencePanelNode.zIndex = 200;

    // 面板背景
    const panelBg = new Node();
    panelBg.width = this._screenWidth;
    panelBg.height = panelH;
    panelBg._draw = function(ctx) {
      const w = self._screenWidth;
      const h = panelH;
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(8, 12, 10, 0.97)');
      grad.addColorStop(1, 'rgba(5, 8, 6, 0.99)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 顶部边框线
      ctx.fillStyle = TERM_GREEN_FAINT;
      ctx.fillRect(0, 0, w, 1);
    };
    this._evidencePanelNode.addChild(panelBg);

    // 面板标题
    const tagLabel = new Label({
      text: 'EVIDENCE SELECT',
      fontSize: 9,
      color: TERM_GREEN_DIM,
      fontFamily: FONT_MONO,
    });
    tagLabel.x = 12;
    tagLabel.y = 8;
    this._evidencePanelNode.addChild(tagLabel);

    const hintLabel = new Label({
      text: '选择你要出示的证据',
      fontSize: 11,
      color: 'rgba(0, 255, 65, 0.65)',
    });
    hintLabel.x = 110;
    hintLabel.y = 8;
    this._evidencePanelNode.addChild(hintLabel);

    // 证据列表（ScrollView）
    const listY = 28;
    const listH = panelH - listY - 8;

    const evidenceScrollView = new ScrollView({
      width: this._screenWidth - 24,
      height: listH,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });
    evidenceScrollView.x = 12;
    evidenceScrollView.y = listY;
    evidenceScrollView.interactive = true;

    evidenceScrollView.on('touchstart', (e) => {
      evidenceScrollView.onTouchStart(e.y - evidenceScrollView.y - this._evidencePanelNode.y);
      e.stopPropagation();
    });
    evidenceScrollView.on('touchmove', (e) => {
      evidenceScrollView.onTouchMove(e.y - evidenceScrollView.y - this._evidencePanelNode.y);
      e.stopPropagation();
    });
    evidenceScrollView.on('touchend', (e) => {
      evidenceScrollView.onTouchEnd();
      if (!evidenceScrollView.didScroll()) {
        this._handleEvidenceTap(e.x - evidenceScrollView.x, e.y - evidenceScrollView.y - this._evidencePanelNode.y + evidenceScrollView.scrollY);
      }
    });

    this._evidencePanelNode.addChild(evidenceScrollView);
    this._evidenceScrollView = evidenceScrollView;

    // 渲染证据项（两列网格）
    const colWidth = (this._screenWidth - 24 - 5) / 2;
    const itemHeight = 30;
    const gap = 5;
    let row = 0;
    let col = 0;

    this._evidenceItems = [];

    this._evidencePool.forEach((item, idx) => {
      const itemNode = new Node();
      itemNode.x = col * (colWidth + gap);
      itemNode.y = row * (itemHeight + gap);
      itemNode.width = colWidth;
      itemNode.height = itemHeight;
      itemNode.interactive = true;

      const isResult = item.type === 'result';

      // 绘制证据项
      itemNode._draw = function(ctx) {
        const w = colWidth;
        const h = itemHeight;

        // 边框
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 类型标记
        ctx.font = `${11}px ${FONT_PRIMARY}`;
        ctx.fillStyle = 'rgba(0, 255, 65, 0.6)';
        ctx.textBaseline = 'middle';
        ctx.fillText(isResult ? '\u25C8' : '\u25C7', 7, h / 2);

        // 名称
        ctx.font = `${11}px ${FONT_PRIMARY}`;
        ctx.fillStyle = 'rgba(0, 255, 65, 0.85)';
        ctx.fillText(item.name, 22, h / 2);
        ctx.textBaseline = 'top';
      };

      itemNode._evidenceId = item.id;
      itemNode._evidenceName = item.name;

      this._evidenceItems.push(itemNode);
      evidenceScrollView.addChild(itemNode);

      col++;
      if (col >= 2) {
        col = 0;
        row++;
      }
    });

    // 更新内容高度
    const totalRows = Math.ceil(this._evidencePool.length / 2);
    evidenceScrollView.contentHeight = totalRows * (itemHeight + gap);

    this.addChild(this._evidencePanelNode);

    // 入场动画
    this._evidencePanelNode.alpha = 0;
    this._evidencePanelNode.y = this._screenHeight;
    Tween.create(this._evidencePanelNode)
      .to({ alpha: 1, y: panelY }, 300, 'easeOut')
      .start();
  }

  /**
   * 处理证据项点击
   */
  _handleEvidenceTap(tapX, tapContentY) {
    if (this._isTyping) return;

    for (const item of this._evidenceItems) {
      if (tapX >= item.x && tapX <= item.x + item.width &&
          tapContentY >= item.y && tapContentY <= item.y + item.height) {
        this._tapEvidence(item._evidenceId, item._evidenceName);
        break;
      }
    }
  }

  // ==================== 消息队列播放 ====================

  _playMessageQueue(queue, onComplete) {
    let index = 0;
    this._isTyping = true;
    this._updateTypingState();

    const next = () => {
      if (index >= queue.length) {
        this._isTyping = false;
        this._updateTypingState();
        if (onComplete) onComplete();
        return;
      }

      const msg = queue[index];
      index++;

      this._addMessage(msg.type, msg.text, () => {
        this._queueTimer = setTimeout(next, MSG_DELAY);
      });
    };

    next();
  }

  /**
   * 添加一条消息（带打字效果）
   */
  _addMessage(type, fullText, onDone) {
    const msgId = 'msg_' + (++this._msgId);
    const self = this;

    // 创建消息节点
    const msgNode = new Node();
    msgNode.x = 0;
    msgNode.y = this._contentHeight;
    msgNode.width = this._screenWidth;

    if (type === 'system') {
      // 系统消息 — 居中显示，方括号包裹
      const sysLabel = new Label({
        text: `[ ${fullText} ]`,
        fontSize: 12,
        color: 'rgba(0, 255, 65, 0.6)',
        textAlign: 'center',
        fontFamily: FONT_PRIMARY,
      });
      sysLabel.width = this._screenWidth - 20;
      sysLabel.x = 10;
      sysLabel.y = 8;
      msgNode.addChild(sysLabel);
      msgNode.height = 32;

      this._msgContainer.addChild(msgNode);
      this._messages.push({ type, text: fullText, id: msgId, node: msgNode });
      this._contentHeight += msgNode.height + MSG_GAP;
      this._updateScrollContent();
      this._scrollToBottom();

      // 淡入动画
      msgNode.alpha = 0;
      Tween.create(msgNode).to({ alpha: 1 }, 300, 'easeOut').start();

      if (onDone) onDone();
      return;
    }

    if (type === 'player') {
      // 玩家消息 — 右侧气泡，文字居中
      const boxW = Math.min(fullText.length * 14 + 28, this._screenWidth * 0.7);
      const boxX = this._screenWidth - boxW - 10;

      const playerLabel = new Label({
        text: fullText,
        fontSize: 14,
        color: TERM_CYAN,
        textAlign: 'center',
        maxWidth: boxW - 16,
      });
      playerLabel.width = boxW;
      playerLabel.x = boxX;
      playerLabel.y = 13;
      msgNode.addChild(playerLabel);

      // 边框背景
      const playerBg = new Node();
      playerBg.width = this._screenWidth;
      playerBg.height = 40;
      playerBg._draw = function(ctx) {
        const boxH = 36;
        const boxY = 2;
        ctx.beginPath();
        ctx.rect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 200, 255, 0.04)';
        ctx.fill();
      };
      playerBg.zIndex = -1;
      msgNode.addChild(playerBg);

      msgNode.height = 44;

      this._msgContainer.addChild(msgNode);
      this._messages.push({ type, text: fullText, id: msgId, node: msgNode });
      this._contentHeight += msgNode.height + MSG_GAP;
      this._updateScrollContent();
      this._scrollToBottom();

      // 淡入
      msgNode.alpha = 0;
      Tween.create(msgNode).to({ alpha: 1 }, 300, 'easeOut').start();

      if (onDone) onDone();
      return;
    }

    // ghost 消息 — 左对齐，> 前缀，逐字打印
    const prefixLabel = new Label({
      text: '>',
      fontSize: 14,
      color: TERM_GREEN_DIM,
    });
    prefixLabel.x = 0;
    prefixLabel.y = 0;
    msgNode.addChild(prefixLabel);

    const ghostLabel = new Label({
      text: '',
      fontSize: 14,
      color: TERM_GREEN,
      maxWidth: this._screenWidth - 30,
      shadowLayers: [
        { color: 'rgba(0, 255, 65, 0.25)', blur: 3 },
      ],
    });
    ghostLabel.x = 16;
    ghostLabel.y = 0;
    msgNode.addChild(ghostLabel);

    // 估算行高
    const estLines = Math.ceil(fullText.length / Math.floor((this._screenWidth - 30) / 14));
    msgNode.height = Math.max(20, estLines * 20);

    this._msgContainer.addChild(msgNode);
    this._messages.push({ type, text: '', id: msgId, node: msgNode, label: ghostLabel });
    this._contentHeight += msgNode.height + MSG_GAP;
    this._updateScrollContent();
    this._scrollToBottom();

    // 淡入
    msgNode.alpha = 0;
    Tween.create(msgNode).to({ alpha: 1 }, 200, 'easeOut').start();

    // 逐字打印
    let charIdx = 0;
    if (this._typeTimer) clearInterval(this._typeTimer);
    this._typeTimer = setInterval(() => {
      charIdx++;
      if (charIdx > fullText.length) {
        clearInterval(this._typeTimer);
        this._typeTimer = null;

        // 更新最终高度
        const finalLines = Math.ceil(fullText.length / Math.floor((this._screenWidth - 30) / 14));
        const newH = Math.max(20, finalLines * 20);
        if (newH !== msgNode.height) {
          const diff = newH - msgNode.height;
          msgNode.height = newH;
          this._contentHeight += diff;
          this._updateScrollContent();
        }

        if (onDone) onDone();
        return;
      }
      ghostLabel.text = fullText.slice(0, charIdx);
      this._scrollToBottom();
    }, CHAR_SPEED);
  }

  // ==================== 提问流程 ====================

  _askQuestion(index) {
    if (index >= GHOST_QUESTIONS.length) {
      this._startFinal();
      return;
    }

    const q = GHOST_QUESTIONS[index];
    this._currentQuestion = index;

    if (q.question) {
      // 有显式提问文本
      this._addMessage('ghost', q.question, () => {
        this._isTyping = false;
        this._updateTypingState();
        this._setEvidencePanel(true);
        this._scrollToBottom();
      });
    } else {
      // 无显式提问
      this._isTyping = false;
      this._updateTypingState();
      this._setEvidencePanel(true);
      this._scrollToBottom();
    }
  }

  /**
   * 玩家选择证据
   */
  _tapEvidence(id, name) {
    if (this._isTyping) return;

    // 关闭面板
    this._setEvidencePanel(false);

    // 显示玩家出示的证据
    this._addMessage('player', '\u51FA\u793A\uFF1A' + name, () => {
      const q = GHOST_QUESTIONS[this._currentQuestion];

      if (id === q.correctId) {
        this._onCorrectAnswer(q);
      } else {
        this._onWrongAnswer(q);
      }
    });
  }

  _onCorrectAnswer(q) {
    const queue = q.correctResponse.map(text => ({ type: 'ghost', text }));

    this._playMessageQueue(queue, () => {
      const next = this._currentQuestion + 1;
      this._currentQuestion = next;

      this._queueTimer = setTimeout(() => {
        this._askQuestion(next);
      }, 800);
    });
  }

  _onWrongAnswer(q) {
    this._addMessage('ghost', q.wrongHint, () => {
      this._isTyping = false;
      this._updateTypingState();
      this._setEvidencePanel(true);
      this._scrollToBottom();
    });
  }

  // ==================== 终章 ====================

  _startFinal() {
    this._phase = 'final';

    this._playMessageQueue(GHOST_FINAL, () => {
      gameState.setChoice('ghostChatDone', true);
      this._phase = 'done';
      this._updateStatusText();
    });
  }

  /**
   * 重进页面时显示已完成状态
   */
  _showCompletedState() {
    this._phase = 'done';
    this._updateStatusText();
    // 用 _playMessageQueue 顺序播放，避免多个 _typeTimer 互相覆盖
    this._playMessageQueue([
      { type: 'system', text: '通讯已结束' },
      { type: 'ghost', text: '...-- ----- ..--- .---- .---- .---- ----- -....' },
      { type: 'ghost', text: '我们已经没什么好说的了。去看看阿里亚斯的笔记吧。' },
    ], () => {});
  }

  // ==================== 工具方法 ====================

  _updateScrollContent() {
    const h = this._contentHeight + MSG_PADDING + 20;
    this._scrollView.contentHeight = h;
    if (this._msgContainer) this._msgContainer.height = h;
  }

  _scrollToBottom() {
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null;
      this._scrollView.scrollToBottom(true);
    }, 50);
  }

  _updateTypingState() {
    this._typingNode.visible = this._isTyping;
    if (this._isTyping) {
      this._typingNode.y = this._contentHeight;
    }
    this._updateStatusText();
  }

  _updateStatusText() {
    if (!this._statusLabel) return;
    if (this._phase === 'done') {
      this._statusLabel.text = '通讯已断开';
    } else if (this._isTyping) {
      this._statusLabel.text = '信号传输中...';
    } else {
      this._statusLabel.text = '等待输入';
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
    super.onTouchMove(event);
    if (!event.changedTouches || event.changedTouches.length === 0) return;
    const t = event.changedTouches[0];
    const dx = t.x - this._swipeStartX;
    const dy = t.y - this._swipeStartY;
    if (!this._swipeActive && this._swipeStartX < 60 && dx > 10 && Math.abs(dx) > Math.abs(dy)) {
      this._swipeActive = true;
    }
    if (this._swipeActive) {
      this.x = Math.max(0, dx);
      if (this._isDirty !== undefined) this._isDirty = true;
    }
  }

  onTouchEnd(event) {
    super.onTouchEnd(event);
    if (this._swipeActive) {
      this._swipeActive = false;
      const sw = this._screenWidth;
      if (this.x > sw * 0.35) {
        Tween.create(this).to({ x: sw }, 200, 'easeOut').call(() => {
          this.x = 0;
          this._onBack();
        }).start();
      } else {
        Tween.create(this).to({ x: 0 }, 180, 'easeOut').start();
      }
    }
  }

  _onBack() {
    if (this.engine) {
      this.engine.popScene();
    }
  }

  // ==================== 每帧更新 ====================

  update(dt) {
    super.update(dt);

    // 更新效果
    if (this._matrixRain) this._matrixRain.update(dt);
    if (this._crtEffect) this._crtEffect.update(dt);
    if (this._scanlineEffect) this._scanlineEffect.update(dt);

    // 信号灯脉冲动画
    this._signalPulseTimer += dt;
    const pulseCycle = 1500;
    const t = (this._signalPulseTimer % pulseCycle) / pulseCycle;
    // 0 ~ 0.5: 正弦淡出, 0.5 ~ 1: 正弦淡入
    const pulseAlpha = t < 0.5
      ? 1.0 - 0.6 * Math.sin(t / 0.5 * Math.PI)
      : 0.4 + 0.6 * Math.sin((t - 0.5) / 0.5 * Math.PI);
    if (this._signalDotNode) {
      this._signalDotNode.alpha = pulseAlpha;
    }

    // 打字指示器圆点脉冲
    if (this._isTyping) {
      this._typingDotsTimer += dt;
      for (let i = 0; i < 3; i++) {
        const phase = ((this._typingDotsTimer - i * 200) / 1200 % 1 + 1) % 1;
        this._typingDotsAlpha[i] = phase < 0.5
          ? 0.3 + 0.7 * Math.sin(phase / 0.5 * Math.PI)
          : 0.3;
      }
    }

    // 更新 ScrollView
    if (this._scrollView) {
      this._scrollView.update(dt);
    }

    // 更新证据面板 ScrollView
    if (this._evidenceScrollView) {
      this._evidenceScrollView.update(dt);
    }
  }

  // ==================== 渲染 ====================

  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;

    ctx.save();

    // 右滑时：先在原始坐标系填充左侧背景，再平移全部内容
    if (this.x > 0) {
      ctx.fillStyle = TERM_BG;
      ctx.fillRect(0, 0, this.x + 1, this._screenHeight);
      const shadowGrad = ctx.createLinearGradient(0, 0, this.x, 0);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.25)');
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(0, 0, this.x + 1, this._screenHeight);
      ctx.translate(this.x, 0);
    }

    // 1. 背景色
    ctx.fillStyle = TERM_BG;
    ctx.fillRect(0, 0, this._screenWidth, this._screenHeight);

    // 2. 矩阵代码雨（逻辑像素空间，与 Engine 一致）
    if (this._matrixRain) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      this._matrixRain.render(ctx);
      ctx.restore();
    }

    // 3. 渲染子节点（消息区域、导航栏等）
    for (const child of this.children) {
      child.render(ctx);
    }

    // 4. 扫描线（覆盖层）
    if (this._scanlineEffect) {
      this._scanlineEffect.render(ctx);
    }

    // 5. CRT 暗角（最顶层）
    if (this._crtEffect) {
      this._crtEffect.render(ctx);
    }

    ctx.restore();
  }
}
