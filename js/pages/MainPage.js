/**
 * MainPage.js - 通讯仪主界面
 * 继承 Scene，还原 main 页面：
 * - 自定义导航栏（CustomHeader）
 * - 双屏触摸拖拽滑动（中屏桌面 / 右屏加密笔记本）
 * - 应用图标网格（AugmentedCard）
 * - 加密笔记本（图案密码 + PIN 码）
 * - 幽灵传送门（ch4/ch5）
 * - 波形动画、信号动画
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { Sprite } from '../engine/Sprite.js';
import { Tween } from '../engine/Tween.js';
import CustomHeader, { HEADER_CONTENT_HEIGHT } from '../components/CustomHeader.js';
import AugmentedCard from '../components/AugmentedCard.js';
import ScanlineEffect from '../effects/ScanlineEffect.js';
import CRTEffect from '../effects/CRTEffect.js';
import GlitchEffect from '../effects/GlitchEffect.js';
import gameState from '../core/GameState.js';
import OpeningPage from './OpeningPage.js';
import { ChatPage } from './ChatPage.js';
import { RecordsPage } from './RecordsPage.js';
import { SocialPage } from './SocialPage.js';
import { EvidencePage } from './EvidencePage.js';
import { NotesPage } from './NotesPage.js';
import { GhostChatPage } from './GhostChatPage.js';
import { EndingPage } from './EndingPage.js';
import { evidenceList, reasoningCombos } from '../data/story.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_PURPLE, RUNE_BLUE, RUNE_AMBER,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
} from '../style/StyleConfig.js';

// 应用列表定义
const HOME_APPS = [
  { id: 'social',   name: '灵波',   icon: '◈', desc: '> LINGBO SOCIAL',  color: 'rgba(68, 136, 255, 0.95)',  bgStart: 'rgba(12, 24, 68, 0.9)' },
  { id: 'records',  name: '聊天',   icon: '⟡', desc: '> COMM RECORDS',   color: 'rgba(245, 166, 35, 0.95)',  bgStart: 'rgba(60, 32, 8, 0.9)' },
  { id: 'chat',     name: '临时通讯', icon: 'ψ', desc: '> LIVE CHANNEL',  color: RUNE_CYAN,                   bgStart: 'rgba(5, 48, 48, 0.9)' },
  { id: 'evidence', name: '证据板',  icon: '⊞', desc: '> EVIDENCE DB',   color: 'rgba(191, 90, 242, 0.95)',  bgStart: 'rgba(45, 10, 62, 0.9)' },
];

// 波形柱数量
const WAVEFORM_COLS = 32;

// 正确密码
const CORRECT_PATTERN = [0, 2, 4, 6, 8]; // X 形
const CORRECT_PIN = '30211106';

export default class MainPage extends Scene {
  constructor() {
    super();

    // 屏幕尺寸
    this._screenW = 375;
    this._screenH = 667;
    this._statusBarHeight = 20;

    // 导航栏
    this._header = null;
    this._navHeight = 0;

    // 双屏滑动
    this._currentScreen = 0; // 0=桌面, 1=笔记本
    this._screenOffsetX = 0; // 当前水平偏移（像素）
    this._targetOffsetX = 0;
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartOffsetX = 0;

    // 应用卡片
    this._appCards = [];

    // 时间显示
    this._gameTime = '12:00';

    // 信号指示器（5个点，布尔值）
    this._signalDots = [true, true, true, false, false];
    this._signalTimer = 0;

    // 波形数据（32列）
    this._waveformData = new Array(WAVEFORM_COLS).fill(4);
    this._waveTimer = 0;
    this._signalFreq = '47.3';

    // 加密笔记本状态
    this._notesUnlocked = false;
    this._patternDots = new Array(9).fill(false);
    this._patternSolved = false;
    this._pinInput = '';
    this._pinError = false;
    this._pinErrorTimer = 0;

    // 幽灵传送门
    this._showGhostPortal = false;
    this._portalMode = '';   // 'ghost' | 'ending'
    this._ghostEntering = false;
    this._showGlitch = false;
    this._portalRotation = 0;
    this._portalPulse = 0;
    this._ghostExpandProgress = 0; // 0→1 挤开动画进度

    // 证据数
    this._evidenceCount = 0;

    // 底部屏幕指示点
    this._dotIndicatorAlpha = 1;

    // 星空背景图
    this._bgSprite = null;

    // 效果
    this._scanlineEffect = null;
    this._crtEffect = null;
    this._glitchEffect = null;

    // 解锁模块列表
    this._unlockedModules = ['chat'];

  }

  /**
   * 场景进入
   */
  onEnter() {
    const engine = this.engine;
    this._screenW = engine.getWidth();
    this._screenH = engine.getHeight();

    // 获取状态栏高度和底部安全区（微信小游戏环境）
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this._statusBarHeight = info.statusBarHeight || 20;
      const safeArea = info.safeArea;
      this._safeAreaBottom = safeArea ? (info.screenHeight - safeArea.bottom) : 0;
    } catch (e) {
      this._statusBarHeight = 20;
      this._safeAreaBottom = 0;
    }

    this._navHeight = this._statusBarHeight + HEADER_CONTENT_HEIGHT;

    // 加载星空背景图
    this._bgSprite = new Sprite({
      src: 'res/images/starfield.jpg',
      width: this._screenW * 1.3,   // 比屏幕宽以支持视差滑动
      height: this._screenH,
    });

    // 初始化效果
    this._scanlineEffect = new ScanlineEffect({
      width: this._screenW,
      height: this._screenH,
      lineAlpha: 0.03,
      spacing: 4,
    });

    this._crtEffect = new CRTEffect({
      width: this._screenW,
      height: this._screenH,
      vignetteAlpha: 0.3,
    });

    this._glitchEffect = new GlitchEffect({
      width: this._screenW,
      height: this._screenH,
    });

    // 构建 UI
    this._buildHeader();
    this._refreshState();
  }

  /**
   * 场景恢复（从子页面返回时）
   */
  onResume() {
    this._navigating = false;
    this._refreshState();
  }

  /**
   * 场景退出
   */
  onExit() {
    if (this._ghostTimer1) { clearTimeout(this._ghostTimer1); this._ghostTimer1 = null; }
    if (this._ghostTimer2) { clearTimeout(this._ghostTimer2); this._ghostTimer2 = null; }
    Tween.stopAll(this);
  }

  // ==================== UI 构建 ====================

  /**
   * 构建导航栏
   * @private
   */
  _buildHeader() {
    // 右侧内容节点（时间 + 信号指示器在 _draw 中直接绘制）
    this._header = new CustomHeader({
      width: this._screenW,
      statusBarHeight: this._statusBarHeight,
      title: '通讯仪',
      titleIcon: '◈',
      subtitle: 'COMMUNICATOR v2.7',
      showBack: false,
    });
    this._header.zIndex = 100;
    this.addChild(this._header);
  }

  /**
   * 刷新游戏状态
   * @private
   */
  _refreshState() {
    gameState.checkAndAdvanceChapter();
    const state = gameState.get();
    this._unlockedModules = state.unlockedModules || ['chat'];
    this._evidenceCount = gameState.getEvidenceCount();
    this._gameTime = gameState.getGameTime();
    this._notesUnlocked = this._unlockedModules.includes('notes');

    const shouldShowGhost = this._unlockedModules.includes('encrypted_chat');
    const ghostAnimated = !!wx.getStorageSync('ghost_portal_animated');

    // ch4_recover 是否已被玩家看完（所有消息播放完毕后写入）
    let ch4RecoverRead = false;
    try {
      ch4RecoverRead = !!wx.getStorageSync('ch4_recover_complete');
    } catch (e) {}

    this._showGhostPortal = shouldShowGhost && ghostAnimated;
    this._portalMode = this._unlockedModules.includes('encrypted_zone') ? 'ending' : 'ghost';
    // 再次进入时从 0 开始展开动画（快速过渡）
    this._ghostExpandProgress = this._showGhostPortal ? 0 : 0;

    // 重置 PIN 流程
    this._patternSolved = false;
    this._pinInput = '';
    this._pinError = false;

    // ch4 幽灵首次出现动画：需等 ch4_recover 对话被玩家读完后才触发
    if (shouldShowGhost && !ghostAnimated && ch4RecoverRead) {
      this._playGhostEntrance();
    }
  }

  // ==================== 每帧更新 ====================

  update(dt) {
    super.update(dt);

    // 效果更新
    if (this._scanlineEffect) this._scanlineEffect.update(dt);
    if (this._crtEffect) this._crtEffect.update(dt);
    if (this._glitchEffect) this._glitchEffect.update(dt);

    // 信号指示器动画（每 1.5s）
    this._signalTimer += dt;
    if (this._signalTimer >= 1500) {
      this._signalTimer = 0;
      const activeCount = Math.floor(Math.random() * 4) + 2;
      this._signalDots = [false, false, false, false, false].map((_, i) => i < activeCount);
    }

    // 波形动画（每 300ms）
    this._waveTimer += dt;
    if (this._waveTimer >= 300) {
      this._waveTimer = 0;
      for (let i = 0; i < WAVEFORM_COLS; i++) {
        const base = Math.sin(Date.now() / 600 + i * 0.3) * 6 + 8;
        const jitter = (Math.random() - 0.5) * 8;
        this._waveformData[i] = Math.max(1, Math.min(22, Math.round(base + jitter)));
      }
      this._signalFreq = (42 + Math.random() * 12).toFixed(1);
    }

    // 双屏滑动缓动
    if (!this._isDragging) {
      this._screenOffsetX += (this._targetOffsetX - this._screenOffsetX) * 0.15;
      if (Math.abs(this._screenOffsetX - this._targetOffsetX) < 0.5) {
        this._screenOffsetX = this._targetOffsetX;
      }
    }

    // 幽灵传送门旋转 + 挤开动画
    if (this._showGhostPortal) {
      this._portalRotation += dt * 0.001;
      this._portalPulse += dt * 0.003;
      // 挤开动画：0→1 缓动过渡（~600ms 完成）
      if (this._ghostExpandProgress < 1) {
        this._ghostExpandProgress = Math.min(1, this._ghostExpandProgress + dt * 0.0018);
      }
    }

    // PIN 错误动画计时
    if (this._pinError) {
      this._pinErrorTimer += dt;
      if (this._pinErrorTimer >= 600) {
        this._pinError = false;
        this._pinErrorTimer = 0;
        this._pinInput = '';
      }
    }
  }

  // ==================== 绘制 ====================

  _draw(ctx) {
    const W = this._screenW;
    const H = this._screenH;

    // 1. 背景（星空图 + 暗色叠加）
    ctx.fillStyle = BG_DARK;
    ctx.fillRect(0, 0, W, H);

    if (this._bgSprite && this._bgSprite.isLoaded()) {
      ctx.save();
      // 视差效果：背景随屏幕滑动微偏移
      const parallaxX = -this._screenOffsetX * 0.15;
      ctx.translate(parallaxX, 0);
      this._bgSprite.render(ctx);
      ctx.restore();

      // 暗色叠加层（保持 HUD 可读性）
      ctx.fillStyle = 'rgba(10, 14, 39, 0.65)';
      ctx.fillRect(0, 0, W, H);
    }

    // 网格背景
    this._drawGridBg(ctx, W, H);

    // 2. 双屏内容区（裁剪到导航栏下方）
    const contentTop = this._navHeight;
    const safeBottom = this._safeAreaBottom || 0;
    const contentH = H - contentTop - 20 - safeBottom; // 底部留出指示点 + 安全区空间

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop, W, contentH);
    ctx.clip();

    // 中屏（桌面）
    ctx.save();
    ctx.translate(-this._screenOffsetX, 0);
    this._drawHomeScreen(ctx, W, contentTop, contentH);
    ctx.restore();

    // 右屏（笔记本）
    ctx.save();
    ctx.translate(W - this._screenOffsetX, 0);
    this._drawNotebookScreen(ctx, W, contentTop, contentH);
    ctx.restore();

    ctx.restore();

    // 3. 导航栏右侧（时间 + 信号）在导航栏绘制后叠加
    this._drawHeaderRight(ctx);

    // 4. 底部指示点
    this._drawScreenDots(ctx, W, H);

    // 5. 扫描线 + CRT
    if (this._scanlineEffect) this._scanlineEffect.render(ctx);
    if (this._crtEffect) this._crtEffect.render(ctx);

    // 6. 雪花乱码（ch4 幽灵首次出现）
    if (this._showGlitch && this._glitchEffect) {
      this._drawFullScreenGlitch(ctx, W, H);
    }
    if (this._glitchEffect && this._glitchEffect.isActive()) {
      this._glitchEffect.render(ctx);
    }

  }

  /**
   * 绘制 eDEX 风格网格背景
   * @private
   */
  _drawGridBg(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.015)';
    ctx.lineWidth = 0.5;
    const gridSize = 24;
    for (let x = 0; x < W; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 绘制导航栏右侧（时间 + 信号指示器）
   * @private
   */
  _drawHeaderRight(ctx) {
    const rightX = this._screenW - 16;
    const topY = this._statusBarHeight + 8;

    ctx.save();

    // 根据屏幕宽度缩放字号（参考值 375px）
    const hScale = this._screenW / 375;
    const timeFontSize = Math.max(14, Math.round(16 * hScale));
    const sigFontSize = Math.max(9, Math.round(10 * hScale));

    // 游戏时间
    ctx.font = `bold ${timeFontSize}px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
    ctx.shadowBlur = 4;
    ctx.fillText(this._gameTime, rightX - 50, topY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 信号指示器
    const sigLabelX = rightX;
    ctx.font = `${sigFontSize}px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.textAlign = 'right';
    ctx.fillText('SIGNAL', sigLabelX, topY);

    // 5 根信号柱
    const dotBaseX = rightX - 28;
    const dotBaseY = topY + 12;
    const dotGap = 4;
    const dotW = 3;
    const heights = [4, 6, 8, 10, 12];

    for (let i = 0; i < 5; i++) {
      const dh = heights[i];
      const dx = dotBaseX + i * (dotW + dotGap);
      const dy = dotBaseY + (12 - dh);

      ctx.beginPath();
      ctx.rect(dx, dy, dotW, dh);
      if (this._signalDots[i]) {
        ctx.fillStyle = RUNE_CYAN;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.6)';
        ctx.shadowBlur = 3;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.restore();
  }

  // ==================== 中屏：桌面 ====================

  _drawHomeScreen(ctx, W, contentTop, contentH) {
    const padX = Math.round(W * 0.042); // ~16px @ 375，按比例缩放
    const gridW = W - padX * 2;

    // 用【基础高度】（无传送门）居中，然后通过 halfDelta 对称扩展
    const waveformH = 24 + 8;   // barH + margin
    const statusBarH = 24 + 10; // h + margin
    const colGap = 12;
    const baseRowGap = 12;
    const cardW = (gridW - colGap) / 2;
    const cardH = cardW;
    const rows = Math.ceil(HOME_APPS.length / 2);
    const baseGridH = rows * (cardH + baseRowGap) + 8;
    const baseTotalFlowH = waveformH + statusBarH + baseGridH;
    const bottomReserve = 44;
    const availableForFlow = contentH - bottomReserve;

    // 基础居中位置（无传送门时的固定 topOffset）
    const baseTopOffset = Math.max(8, Math.round((availableForFlow - baseTotalFlowH) / 2));

    // 挤开动画：上半部分上移 halfDelta，下半部分通过 rowGap 增大自然下移 halfDelta
    const ep = this._ghostExpandProgress;
    const easedP = this._showGhostPortal ? (1 - Math.pow(1 - ep, 3)) : 0;
    const expandedGap = Math.round(gridW * 0.28);
    const gapDelta = (expandedGap - baseRowGap) * easedP;
    const halfDelta = gapDelta / 2;

    // curY 起点 = 基础居中位置 - halfDelta（波形+状态栏+上排卡片整体上移）
    let curY = contentTop + Math.max(8, Math.round(baseTopOffset - halfDelta));

    // HUD 四角装饰线
    this._drawHudCorners(ctx, padX, contentTop + 8, gridW, contentH - 16);

    // 波形可视化
    curY = this._drawWaveform(ctx, W, curY);

    // 状态行
    curY = this._drawStatusBar(ctx, padX, curY, gridW);

    // 计算应用网格可用的纵向空间（底部留 50px 给装饰）
    const gridAvailableH = (contentTop + contentH - 50) - curY;

    // 应用图标网格（传入可用高度以自适应；传送门出现时扩大行间距）
    curY = this._drawAppGrid(ctx, padX, curY, gridW, gridAvailableH);

    // 底部装饰
    this._drawHomeBottom(ctx, W, contentTop + contentH - 40);
  }

  /**
   * 绘制 HUD 四角装饰线
   * @private
   */
  _drawHudCorners(ctx, x, y, w, h) {
    const cornerLen = 24;
    const alpha = 0.5 + Math.sin(Date.now() * 0.001) * 0.1;

    ctx.save();
    ctx.strokeStyle = `rgba(0, 245, 212, ${0.6 * alpha})`;
    ctx.lineWidth = 1;

    // 左上
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    ctx.stroke();
    // 延伸线
    ctx.beginPath();
    ctx.moveTo(x + cornerLen, y);
    ctx.lineTo(x + cornerLen + 12, y);
    ctx.strokeStyle = `rgba(0, 245, 212, ${0.3 * alpha})`;
    ctx.stroke();

    ctx.strokeStyle = `rgba(0, 245, 212, ${0.6 * alpha})`;

    // 右上
    ctx.beginPath();
    ctx.moveTo(x + w, y + cornerLen);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - cornerLen, y);
    ctx.stroke();

    // 左下
    ctx.beginPath();
    ctx.moveTo(x, y + h - cornerLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerLen, y + h);
    ctx.stroke();

    // 右下
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - cornerLen);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - cornerLen, y + h);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 绘制波形可视化
   * @private
   */
  _drawWaveform(ctx, W, startY) {
    const barH = 24;
    const barGap = 2;
    const barW = (W - 32 - (WAVEFORM_COLS - 1) * barGap) / WAVEFORM_COLS;
    const baseX = 16;
    const baseY = startY + barH;

    ctx.save();
    ctx.globalAlpha = 0.5;

    for (let i = 0; i < WAVEFORM_COLS; i++) {
      const h = this._waveformData[i];
      const x = baseX + i * (barW + barGap);
      const y = baseY - h;

      ctx.fillStyle = RUNE_CYAN;
      ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
      ctx.shadowBlur = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, [1]);
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    return startY + barH + 8;
  }

  /**
   * 绘制状态行
   * @private
   */
  _drawStatusBar(ctx, x, y, w) {
    const h = 24;

    ctx.save();

    // 边框
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // 背景
    ctx.fillStyle = 'rgba(0, 245, 212, 0.02)';
    ctx.fillRect(x, y, w, h);

    // 状态文字（根据屏幕宽度缩放，参考值 375px）
    const statusFontSize = Math.max(9, Math.round(9 * this._screenW / 375));
    ctx.font = `${statusFontSize}px ${FONT_MONO}`;
    ctx.textBaseline = 'middle';
    const midY = y + h / 2;

    // SIG
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('SIG', x + 10, midY);
    ctx.fillStyle = RUNE_CYAN;
    ctx.fillText('不稳定', x + 30, midY);

    // 分隔
    ctx.fillStyle = 'rgba(0, 245, 212, 0.15)';
    ctx.fillText('│', x + w * 0.33, midY);

    // FREQ
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('FREQ', x + w * 0.37, midY);
    ctx.fillStyle = RUNE_CYAN;
    ctx.fillText(`${this._signalFreq}Hz`, x + w * 0.52, midY);

    // 分隔
    ctx.fillStyle = 'rgba(0, 245, 212, 0.15)';
    ctx.fillText('│', x + w * 0.67, midY);

    // DIM
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('DIM', x + w * 0.72, midY);
    ctx.fillStyle = RUNE_CYAN;
    ctx.fillText('0x7F2A', x + w * 0.84, midY);

    ctx.textBaseline = 'top';
    ctx.restore();

    return y + h + 10;
  }

  /**
   * 绘制应用图标网格
   * @private
   */
  _drawAppGrid(ctx, x, y, totalW, availableH) {
    const cols = 2;
    const colGap = 12;
    const cardW = (totalW - colGap) / cols;
    const cardH = cardW; // 保持正方形
    const rows = Math.ceil(HOME_APPS.length / cols);

    // 挤开动画：easeOutCubic 缓动，rowGap 从 12 → expandedGap
    // 整体居中由 _drawHomeScreen 的 topOffset 控制（波形+状态栏+卡片一起上移）
    const ep = this._ghostExpandProgress;
    const easedP = this._showGhostPortal ? (1 - Math.pow(1 - ep, 3)) : 0;
    const expandedGap = Math.round(totalW * 0.28);
    const rowGap = Math.round(12 + (expandedGap - 12) * easedP);

    for (let i = 0; i < HOME_APPS.length; i++) {
      const app = HOME_APPS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x + col * (cardW + colGap);
      const cy = y + row * (cardH + rowGap);
      const unlocked = this._unlockedModules.includes(app.id);

      this._drawAppCard(ctx, cx, cy, cardW, cardH, app, unlocked, i);
    }

    // 幽灵传送门：两行卡片之间的中心
    if (this._showGhostPortal) {
      const gridCenterY = y + cardH + rowGap / 2;
      ctx.save();
      ctx.globalAlpha = easedP;
      this._drawGhostPortal(ctx, this._screenW, gridCenterY);
      ctx.restore();
    }

    return y + rows * (cardH + rowGap) + 8;
  }

  /**
   * 绘制单个应用卡片
   * @private
   */
  _drawAppCard(ctx, x, y, w, h, app, unlocked, index) {
    const cut = 16;
    const sm = 3;
    const notchW = 12;
    const notchH = 3;

    ctx.save();

    if (!unlocked) {
      ctx.globalAlpha = 0.3;
    }

    // 切角路径
    const drawClip = () => {
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
    };

    // 背景
    drawClip();
    const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    bgGrad.addColorStop(0, unlocked ? app.bgStart : 'rgba(8, 12, 32, 0.85)');
    bgGrad.addColorStop(1, 'rgba(8, 12, 32, 0.95)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 扫描线纹理
    ctx.save();
    drawClip();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let sy = 0; sy < h; sy += 5) {
      ctx.fillRect(x, y + sy, w, 1);
    }
    ctx.restore();

    // 边框
    drawClip();
    ctx.strokeStyle = unlocked ? app.color : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.globalAlpha = unlocked ? 0.5 : 0.3;
    ctx.stroke();
    ctx.globalAlpha = unlocked ? 1 : 0.3;

    // 基于卡片宽度缩放字号（参考值 165px）
    const scale = w / 165;
    const iconSize = unlocked ? Math.round(36 * scale) : Math.round(28 * scale);
    const nameSize = Math.max(11, Math.round(13 * scale));
    const descSize = Math.max(7, Math.round(8 * scale));

    // 图标（纵向居中偏上）
    const iconY = y + h * 0.35;
    ctx.font = `${iconSize}px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (unlocked) {
      ctx.fillStyle = app.color;
      ctx.shadowColor = app.color;
      ctx.shadowBlur = 12;
      ctx.fillText(app.icon, x + w / 2, iconY);
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.5;
      ctx.fillText(app.icon, x + w / 2, iconY);
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText('◌', x + w / 2, iconY);
    }

    // 名称
    ctx.font = `bold ${nameSize}px ${FONT_PRIMARY}`;
    ctx.fillStyle = unlocked ? TEXT_PRIMARY : TEXT_DIM;
    ctx.fillText(app.name, x + w / 2, y + h * 0.6);

    // 英文描述
    if (unlocked && app.desc) {
      ctx.font = `${descSize}px ${FONT_MONO}`;
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(app.desc, x + w / 2, y + h * 0.74);
    }

    // 证据板角标
    if (app.id === 'evidence' && unlocked && this._evidenceCount > 0) {
      const badgeX = x + w - 10;
      const badgeY = y + 10;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(155, 93, 229, 0.9)';
      ctx.fill();
      ctx.shadowColor = 'rgba(155, 93, 229, 0.5)';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.font = `bold 9px ${FONT_MONO}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(String(this._evidenceCount), badgeX, badgeY + 1);
    }

    // 聊天角标（红点）
    if (app.id === 'chat' && unlocked && gameState.hasUnreadChat()) {
      const dotX = x + w - 8;
      const dotY = y + 8;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4757';
      ctx.shadowColor = 'rgba(255, 71, 87, 0.8)';
      ctx.shadowBlur = 7;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();

    // 存储卡片区域用于触摸检测
    if (!this._cardRects) this._cardRects = [];
    this._cardRects[index] = { x, y, w, h, id: app.id, unlocked };
  }

  /**
   * 绘制幽灵传送门
   * @private
   */
  _drawGhostPortal(ctx, W, centerY) {
    const cx = W / 2;
    const isEnding = this._portalMode === 'ending';
    const portalColor = isEnding ? RUNE_CYAN : 'rgba(0, 255, 65, 0.85)';
    const secondaryColor = isEnding ? RUNE_PURPLE : 'rgba(0, 255, 65, 0.3)';
    const pulse = 0.9 + Math.sin(this._portalPulse) * 0.15;

    ctx.save();

    // 外层光晕
    const haloR = 90 * pulse;
    const haloGrad = ctx.createRadialGradient(cx, centerY, 0, cx, centerY, haloR);
    if (isEnding) {
      haloGrad.addColorStop(0, 'rgba(0, 245, 212, 0.08)');
      haloGrad.addColorStop(0.3, 'rgba(155, 93, 229, 0.05)');
    } else {
      haloGrad.addColorStop(0, 'rgba(0, 255, 65, 0.08)');
      haloGrad.addColorStop(0.4, 'rgba(0, 255, 65, 0.03)');
    }
    haloGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, centerY, haloR, 0, Math.PI * 2);
    ctx.fill();

    // ch5 终章模式 X 形交叉轨道
    if (isEnding) {
      ctx.save();
      ctx.translate(cx, centerY);
      // 左倾轨道
      ctx.save();
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 75, 30, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // 右倾轨道
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 75, 30, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(155, 93, 229, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    // 外环
    const outerR = 55 * pulse;
    ctx.beginPath();
    ctx.arc(cx, centerY, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = portalColor;
    ctx.lineWidth = isEnding ? 1.5 : 1;
    ctx.globalAlpha = 0.6 + Math.sin(this._portalPulse * 1.2) * 0.2;
    ctx.shadowColor = portalColor;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 内环
    const innerR = 37 / pulse;
    ctx.beginPath();
    ctx.arc(cx, centerY, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = isEnding ? 1.5 : 1;
    ctx.globalAlpha = 0.6 + Math.sin(this._portalPulse * 1.5) * 0.2;
    ctx.stroke();

    // ch5 脉冲环
    if (isEnding) {
      const pulseR = 50 + (Date.now() % 2500) / 2500 * 60;
      const pulseAlpha = 0.7 - (Date.now() % 2500) / 2500 * 0.7;
      ctx.beginPath();
      ctx.arc(cx, centerY, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = RUNE_CYAN;
      ctx.lineWidth = 1;
      ctx.globalAlpha = Math.max(0, pulseAlpha);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    // 核心球
    const coreR = 22;
    const coreGrad = ctx.createRadialGradient(cx, centerY, 0, cx, centerY, coreR);
    if (isEnding) {
      coreGrad.addColorStop(0, 'rgba(0, 245, 212, 0.25)');
      coreGrad.addColorStop(0.6, 'rgba(155, 93, 229, 0.12)');
    } else {
      coreGrad.addColorStop(0, 'rgba(0, 255, 65, 0.15)');
      coreGrad.addColorStop(0.7, 'rgba(0, 255, 65, 0.04)');
    }
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, centerY, coreR, 0, Math.PI * 2);
    ctx.fill();

    // 核心符号
    const symbol = isEnding ? '◈' : '⊘';
    ctx.font = `22px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = portalColor;
    ctx.shadowColor = portalColor;
    ctx.shadowBlur = 8;
    ctx.fillText(symbol, cx, centerY);
    if (isEnding) {
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.5;
      ctx.fillText(symbol, cx, centerY);
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 存储区域用于触摸
    this._portalRect = { x: cx - 60, y: centerY - 60, w: 120, h: 120 };

    ctx.restore();
  }

  /**
   * 绘制桌面底部装饰
   * @private
   */
  _drawHomeBottom(ctx, W, y) {
    ctx.save();

    // 流光线
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(W - 16, y);
    ctx.stroke();

    // 流光扫过
    const flowX = ((Date.now() / 30) % (W + 60)) - 30;
    const flowGrad = ctx.createLinearGradient(flowX - 30, y, flowX + 30, y);
    flowGrad.addColorStop(0, 'transparent');
    flowGrad.addColorStop(0.5, RUNE_CYAN);
    flowGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = flowGrad;
    ctx.beginPath();
    ctx.moveTo(flowX - 30, y);
    ctx.lineTo(flowX + 30, y);
    ctx.stroke();

    // 数据坐标行
    ctx.font = `8px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'center';
    ctx.fillText(`DIM:0x7F2A    FREQ:${this._signalFreq}Hz    LAT:∞`, W / 2, y + 8);

    // 符文行
    const runes = ['᛭', 'ᚢ', 'ᚦ', 'ᚨ', '᛭'];
    const runeStartX = W / 2 - 48;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = RUNE_CYAN;
    ctx.font = `10px ${FONT_PRIMARY}`;
    runes.forEach((r, i) => {
      const ra = i % 2 === 1 ? 0.08 : 0.2;
      ctx.globalAlpha = ra;
      ctx.fillText(r, runeStartX + i * 24, y + 20);
    });

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ==================== 右屏：加密笔记本 ====================

  _drawNotebookScreen(ctx, W, contentTop, contentH) {
    const cx = W / 2;
    const screenCenterY = contentTop + contentH / 2;

    // HUD 四角（紫色 + 青色）
    this._drawNbCorners(ctx, 20, contentTop + 30, W - 40, contentH - 60);

    // 六角框图标
    const hexY = screenCenterY - 160;
    this._drawHexIcon(ctx, cx, hexY);

    // 标题
    ctx.save();
    ctx.font = `bold 20px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.shadowColor = RUNE_CYAN;
    ctx.shadowBlur = 4;
    ctx.fillText('加密笔记', cx, hexY + 55);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.font = `10px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('ENCRYPTED NOTES', cx, hexY + 73);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();

    // 锁定内容
    if (!this._notesUnlocked && !this._patternSolved) {
      // Step 1: 图案密码
      this._drawPatternLock(ctx, cx, hexY + 95, W);
    } else if (this._patternSolved && !this._notesUnlocked) {
      // Step 2: PIN 码
      this._drawPinLock(ctx, cx, hexY + 95, W);
    } else {
      // 已解锁
      this._drawUnlockedStatus(ctx, cx, hexY + 100);
    }

    // 状态指示
    this._drawLockStatus(ctx, cx, contentTop + contentH - 60);
  }

  /**
   * 绘制笔记本四角装饰
   * @private
   */
  _drawNbCorners(ctx, x, y, w, h) {
    const len = 24;
    ctx.save();

    // 左上（紫色）
    ctx.strokeStyle = 'rgba(155, 93, 229, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    // 右上（青色）
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x + w - len, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + len);
    ctx.stroke();

    // 左下（青色）
    ctx.beginPath();
    ctx.moveTo(x, y + h - len);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + len, y + h);
    ctx.stroke();

    // 右下（紫色）
    ctx.strokeStyle = 'rgba(155, 93, 229, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - len);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 绘制六角框图标
   * @private
   */
  _drawHexIcon(ctx, cx, cy) {
    const r = 35;
    ctx.save();

    // 六角背景
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 3 * i - Math.PI / 2;
      const hx = cx + r * Math.cos(angle);
      const hy = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    const hexGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    hexGrad.addColorStop(0, 'rgba(155, 93, 229, 0.15)');
    hexGrad.addColorStop(1, 'rgba(0, 245, 212, 0.08)');
    ctx.fillStyle = hexGrad;
    ctx.fill();

    // 六角边框
    ctx.strokeStyle = 'rgba(155, 93, 229, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 图标
    ctx.font = `32px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._notesUnlocked ? '\uD83D\uDCD3' : '\uD83D\uDCD5', cx, cy);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /**
   * 绘制图案密码（3x3 点阵）
   * @private
   */
  _drawPatternLock(ctx, cx, startY, W) {
    // 面板标题
    ctx.save();
    ctx.font = `12px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(200, 160, 255, 1.0)';
    ctx.shadowColor = 'rgba(155, 93, 229, 0.7)';
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.fillText('STEP 01 · 破解图形锁', cx, startY);
    ctx.shadowBlur = 0;

    // 3x3 点阵
    const dotR = 22;
    const gap = 62;
    const gridW = 2 * gap;
    const gridStartX = cx - gap;
    const gridStartY = startY + 34;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const dx = gridStartX + col * gap;
        const dy = gridStartY + row * gap;
        const active = this._patternDots[idx];

        // 外圆
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
        ctx.strokeStyle = active ? RUNE_PURPLE : 'rgba(155, 93, 229, 0.3)';
        ctx.lineWidth = 1;
        if (active) {
          ctx.fillStyle = 'rgba(155, 93, 229, 0.15)';
          ctx.fill();
          ctx.shadowColor = RUNE_PURPLE;
          ctx.shadowBlur = 6;
        }
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 中心小点
        ctx.beginPath();
        ctx.arc(dx, dy, active ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = active ? RUNE_PURPLE : 'rgba(155, 93, 229, 0.25)';
        ctx.fill();
      }
    }

    // 存储点阵区域
    this._patternGridInfo = { startX: gridStartX, startY: gridStartY, gap, dotR };

    ctx.textAlign = 'left';
    ctx.restore();
  }

  /**
   * 绘制 PIN 码输入
   * @private
   */
  _drawPinLock(ctx, cx, startY, W) {
    ctx.save();

    // 面板标题
    ctx.font = `12px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(200, 160, 255, 1.0)';
    ctx.shadowColor = 'rgba(155, 93, 229, 0.7)';
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.fillText('STEP 02 · 输入访问密码', cx, startY);
    ctx.shadowBlur = 0;

    // PIN 圆点显示（8 位）
    const dotGap = 18;
    const pinY = startY + 30;
    const pinStartX = cx - (7 * dotGap) / 2;

    for (let i = 0; i < 8; i++) {
      const dx = pinStartX + i * dotGap;
      const filled = this._pinInput.length > i;
      const error = this._pinError;

      ctx.beginPath();
      ctx.arc(dx, pinY, 6, 0, Math.PI * 2);

      if (error) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.strokeStyle = '#ef4444';
      } else if (filled) {
        ctx.fillStyle = RUNE_CYAN;
        ctx.strokeStyle = RUNE_CYAN;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.6)';
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = 'transparent';
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.3)';
      }

      if (filled || error) ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // 数字键盘（3x4 网格）
    const keyW = 60;
    const keyH = 42;
    const keyGap = 10;
    const padStartX = cx - (3 * keyW + 2 * keyGap) / 2;
    const padStartY = pinY + 22;

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    this._pinKeyRects = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!key) {
        this._pinKeyRects.push(null);
        continue;
      }

      const col = i % 3;
      const row = Math.floor(i / 3);
      const kx = padStartX + col * (keyW + keyGap);
      const ky = padStartY + row * (keyH + keyGap);

      // 微切角按键
      ctx.beginPath();
      const kCut = 3;
      ctx.moveTo(kx + kCut, ky);
      ctx.lineTo(kx + keyW - kCut, ky);
      ctx.lineTo(kx + keyW, ky + kCut);
      ctx.lineTo(kx + keyW, ky + keyH - kCut);
      ctx.lineTo(kx + keyW - kCut, ky + keyH);
      ctx.lineTo(kx + kCut, ky + keyH);
      ctx.lineTo(kx, ky + keyH - kCut);
      ctx.lineTo(kx, ky + kCut);
      ctx.closePath();

      ctx.fillStyle = 'rgba(155, 93, 229, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(155, 93, 229, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 按键文字
      ctx.font = `20px ${FONT_PRIMARY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(200, 214, 229, 0.9)';
      ctx.fillText(key === 'del' ? '⌫' : key, kx + keyW / 2, ky + keyH / 2);

      this._pinKeyRects.push({ x: kx, y: ky, w: keyW, h: keyH, key });
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.restore();
  }

  /**
   * 绘制已解锁状态
   * @private
   */
  _drawUnlockedStatus(ctx, cx, y) {
    ctx.save();
    ctx.font = `14px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
    ctx.shadowBlur = 4;
    ctx.fillText('笔记已解锁', cx, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.font = `11px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('点击查看笔记内容', cx, y + 24);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  /**
   * 绘制锁定状态指示
   * @private
   */
  _drawLockStatus(ctx, cx, y) {
    ctx.save();
    ctx.textAlign = 'center';

    // 状态点
    const dotR = 3;
    let dotColor, statusText, hintText;

    if (this._notesUnlocked) {
      dotColor = RUNE_CYAN;
      statusText = '笔记已解锁';
      hintText = '点击查看笔记内容';
    } else if (this._patternSolved) {
      dotColor = RUNE_AMBER;
      statusText = '图形验证通过';
      hintText = '请输入八位访问密码';
    } else {
      dotColor = '#ef4444';
      statusText = '双重加密保护';
      hintText = '在调查中寻找破解线索';
    }

    // 状态点
    ctx.beginPath();
    ctx.arc(cx - 60, y + 2, dotR, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 状态文字
    ctx.font = `12px ${FONT_PRIMARY}`;
    ctx.fillStyle = this._notesUnlocked ? RUNE_CYAN : TEXT_SECONDARY;
    ctx.fillText(statusText, cx, y);

    // 提示
    ctx.font = `10px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(hintText, cx, y + 18);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  /**
   * 绘制底部屏幕指示点
   * @private
   */
  _drawScreenDots(ctx, W, H) {
    const safeBottom = this._safeAreaBottom || 0;
    const dotY = H - 12 - safeBottom;
    const dotR = 3.5;
    const gap = 12;
    const cx = W / 2;

    ctx.save();
    for (let i = 0; i < 2; i++) {
      const dx = cx + (i - 0.5) * gap;
      ctx.beginPath();
      ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);

      if (i === this._currentScreen) {
        ctx.fillStyle = RUNE_CYAN;
        ctx.strokeStyle = RUNE_CYAN;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fill();
      } else {
        ctx.fillStyle = 'transparent';
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /**
   * 绘制全屏雪花乱码（ch4 幽灵首次出现）
   * @private
   */
  _drawFullScreenGlitch(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 8, 0, 0.85)';
    ctx.fillRect(0, 0, W, H);

    // 水平扫描线
    ctx.fillStyle = 'rgba(0, 255, 65, 0.04)';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 2);
    }

    // 随机噪声条
    for (let i = 0; i < 3; i++) {
      const ny = Math.random() * H;
      const nh = 10 + Math.random() * 20;
      ctx.fillStyle = `rgba(0, 255, 65, ${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(0, ny, W, nh);
    }

    ctx.restore();
  }

  // ==================== 触摸事件 ====================

  onTouchStart(event) {
    super.onTouchStart(event);
    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const { x, y } = touch;

    // 在内容区域开始拖拽
    if (y > this._navHeight && y < this._screenH - 20) {
      this._isDragging = true;
      this._dragStartX = x;
      this._dragStartOffsetX = this._screenOffsetX;
    }
  }

  onTouchMove(event) {
    super.onTouchMove(event);
    if (!this._isDragging || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = this._dragStartX - touch.x;
    let newOffset = this._dragStartOffsetX + deltaX;

    // 边界约束（弹性）
    if (newOffset < 0) newOffset *= 0.3;
    if (newOffset > this._screenW) newOffset = this._screenW + (newOffset - this._screenW) * 0.3;

    this._screenOffsetX = newOffset;
  }

  onTouchEnd(event) {
    super.onTouchEnd(event);
    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const wasDragging = this._isDragging;
    this._isDragging = false;

    // 判断是滑动还是点击
    const dragDistance = Math.abs(this._screenOffsetX - this._dragStartOffsetX);
    const isSwipe = dragDistance > 30;

    if (isSwipe) {
      // 判断滑动方向切换屏幕
      if (this._screenOffsetX > this._screenW * 0.3) {
        this._currentScreen = 1;
        this._targetOffsetX = this._screenW;
      } else {
        this._currentScreen = 0;
        this._targetOffsetX = 0;
      }
    } else if (wasDragging) {
      // 回弹到当前屏幕
      this._targetOffsetX = this._currentScreen * this._screenW;

      // 处理点击事件
      this._handleTap(touch.x, touch.y);
    }
  }

  /**
   * 处理点击事件
   * @private
   */
  _handleTap(x, y) {
    // 当前是桌面屏
    if (this._currentScreen === 0) {
      // 检测应用卡片点击
      if (this._cardRects) {
        for (const rect of this._cardRects) {
          if (rect && x >= rect.x && x <= rect.x + rect.w &&
              y >= rect.y && y <= rect.y + rect.h) {
            this._tapApp(rect.id, rect.unlocked);
            return;
          }
        }
      }

      // 检测幽灵传送门点击
      if (this._showGhostPortal && this._portalRect) {
        const pr = this._portalRect;
        if (x >= pr.x && x <= pr.x + pr.w && y >= pr.y && y <= pr.y + pr.h) {
          this._tapGhostPortal();
          return;
        }
      }

      // 检测重置按钮
      if (x < 60 && y < this._navHeight) {
        this._onResetTap();
        return;
      }
    }

    // 当前是笔记本屏
    if (this._currentScreen === 1) {
      // 将 x 坐标转换到笔记本屏的本地坐标
      const localX = x;

      if (this._notesUnlocked) {
        // 已解锁，跳转笔记页
        this._tapNotebook();
      } else if (!this._patternSolved) {
        // 图案密码点击
        this._handlePatternTap(localX, y);
      } else {
        // PIN 键盘点击
        this._handlePinTap(localX, y);
      }
    }

    // 底部指示点
    const dotY = this._screenH - 12;
    if (y >= dotY - 15 && y <= dotY + 15) {
      const cx = this._screenW / 2;
      if (x < cx) {
        this._currentScreen = 0;
        this._targetOffsetX = 0;
      } else {
        this._currentScreen = 1;
        this._targetOffsetX = this._screenW;
      }
    }
  }

  /**
   * 点击应用图标
   * @private
   */
  _tapApp(id, unlocked) {
    if (!unlocked) {
      try { wx.vibrateShort({ type: 'light' }); } catch (e) {}
      return;
    }
    // 防止快速重复点击导致多次 pushScene
    if (this._navigating) return;
    this._navigating = true;
    setTimeout(() => { this._navigating = false; }, 500);

    const pageMap = {
      chat: () => new ChatPage(),
      records: () => new RecordsPage(),
      social: () => new SocialPage(),
      evidence: () => new EvidencePage(),
    };
    const factory = pageMap[id];
    if (factory) {
      this.engine.pushScene(factory());
    }
  }

  /**
   * 点击幽灵传送门
   * @private
   */
  _tapGhostPortal() {
    if (this._navigating) return;
    this._navigating = true;
    setTimeout(() => { this._navigating = false; }, 500);

    if (this._portalMode === 'ending') {
      this.engine.pushScene(new EndingPage());
    } else {
      this.engine.pushScene(new GhostChatPage());
    }
  }

  /**
   * 点击笔记（已解锁后）
   * @private
   */
  _tapNotebook() {
    if (this._navigating) return;
    this._navigating = true;
    setTimeout(() => { this._navigating = false; }, 500);

    this.engine.pushScene(new NotesPage());
  }

  /**
   * 处理图案密码点击
   * @private
   */
  _handlePatternTap(x, y) {
    if (!this._patternGridInfo) return;

    const { startX, startY, gap, dotR } = this._patternGridInfo;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const dx = startX + col * gap;
        const dy = startY + row * gap;
        const dist = Math.sqrt((x - dx) ** 2 + (y - dy) ** 2);

        if (dist <= dotR + 8) {
          this._patternDots[idx] = !this._patternDots[idx];

          // 检查是否正确（X 形：0,2,4,6,8 亮，1,3,5,7 灭）
          const correctX =
            CORRECT_PATTERN.every(i => this._patternDots[i]) &&
            [1, 3, 5, 7].every(i => !this._patternDots[i]);

          if (correctX) {
            this._patternSolved = true;
            this._patternDots = new Array(9).fill(false);
          }
          return;
        }
      }
    }
  }

  /**
   * 处理 PIN 键盘点击
   * @private
   */
  _handlePinTap(x, y) {
    if (!this._pinKeyRects || this._pinError) return;

    for (const rect of this._pinKeyRects) {
      if (!rect) continue;
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        const key = rect.key;

        if (key === 'del') {
          if (this._pinInput.length > 0) {
            this._pinInput = this._pinInput.slice(0, -1);
          }
          return;
        }

        if (this._pinInput.length >= 8) return;
        this._pinInput += key;

        if (this._pinInput.length === 8) {
          if (this._pinInput === CORRECT_PIN) {
            gameState.unlockModule('notes');
            this._refreshState();
          } else {
            this._pinError = true;
            this._pinErrorTimer = 0;
            try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}
          }
        }
        return;
      }
    }
  }

  /**
   * 重置游戏
   * @private
   */
  _onResetTap() {
    // 在小游戏中使用 wx.showModal
    wx.showModal({
      title: '系统重置',
      content: '确认要回到一切的起点吗？所有进度将被清除，无法恢复。',
      confirmText: '确认重置',
      confirmColor: '#ef4444',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          gameState.reset();
          try { wx.removeStorageSync('ghost_portal_animated'); } catch (e) {}
          this.engine.replaceScene(new OpeningPage());
        }
      },
    });
  }

  // ==================== 幽灵入场动画 ====================

  _playGhostEntrance() {
    this._showGlitch = true;
    try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {}

    this._ghostTimer1 = setTimeout(() => {
      this._ghostTimer1 = null;
      this._showGlitch = false;
      this._showGhostPortal = true;
      this._ghostEntering = true;
      wx.setStorageSync('ghost_portal_animated', true);
      try { wx.vibrateShort({ type: 'medium' }); } catch (e) {}

      this._ghostTimer2 = setTimeout(() => {
        this._ghostTimer2 = null;
        this._ghostEntering = false;
      }, 1000);
    }, 2000);
  }
}
