/**
 * NotesPage.js - 个人笔记页面
 * 继承 Scene，完整还原 notes 页面
 * 笔记列表 + 笔记详情弹窗（Modal 风格） + 未读标记 + ch4→ch5 晋级
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { Tween } from '../engine/Tween.js';
import gameState from '../core/GameState.js';
import { notes } from '../data/notes.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_AMBER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG, FONT_SIZE_XL,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL,
  GLOW_CYAN_40, GLOW_AMBER_40, GLOW_AMBER_80,
  ANIM_NORMAL,
} from '../style/StyleConfig.js';

/** 导航栏高度（不含状态栏） */
const HEADER_HEIGHT = 44;
/** 列表左右内边距 */
const LIST_PADDING = 14;
/** 笔记卡片间距 */
const CARD_GAP = 10;
/** 笔记卡片切角尺寸 */
const CARD_CUT = 10;
/** 弹窗切角尺寸 */
const MODAL_CUT = 14;

export class NotesPage extends Scene {
  constructor() {
    super();

    /** 屏幕尺寸 */
    this._screenWidth = 0;
    this._screenHeight = 0;
    /** 状态栏高度 */
    this._statusBarHeight = 0;

    /** 笔记列表数据 */
    this._noteList = [];

    /** 是否有未读消息 */
    this._hasUnreadChat = false;

    /** ScrollView */
    this._scrollView = null;

    /** 笔记卡片区域信息列表 */
    this._cardRects = [];

    /** 流光线动画计时器 */
    this._flowTimer = 0;

    // ====== 详情弹窗状态 ======
    /** 当前展开的笔记 */
    this._expandedNote = null;
    /** 弹窗遮罩透明度 */
    this._overlayAlpha = 0;
    /** 弹窗缩放 */
    this._modalScale = 0.8;
    /** 弹窗透明度 */
    this._modalAlpha = 0;
    /** 弹窗是否可见 */
    this._modalVisible = false;
    /** 弹窗显示/隐藏动画中 */
    this._isShowingModal = false;
    this._isHidingModal = false;

    /** 弹窗内 ScrollView（笔记内容滚动） */
    this._modalScrollView = null;
    /** 弹窗内换行后的文本行 */
    this._modalContentLines = [];

    /** 按下的卡片索引（用于触摸反馈） */
    this._pressedCardIndex = -1;
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
    gameState.markPageVisited('notes');

    // 检查未读消息
    this._hasUnreadChat = gameState.hasUnreadChat();

    // 加载笔记数据
    this._loadNotes();

    // 构建 UI
    this._buildUI();
  }

  onResume() {
    this._hasUnreadChat = gameState.hasUnreadChat();
    this._loadNotes();
    this._rebuildList();
  }

  onExit() {
    Tween.stopAll(this);
  }

  // ==================== 数据加载 ====================

  /**
   * 根据当前章节加载笔记列表
   * @private
   */
  _loadNotes() {
    const state = gameState.get();
    const currentChapter = state.chapter || 1;

    this._noteList = notes
      .filter(note => note.chapter <= currentChapter)
      .map(note => {
        const rawContent = note.content || '';
        const preview = rawContent.replace(/\n/g, ' ').substring(0, 22) + (rawContent.length > 22 ? '…' : '');
        return {
          id: note.id,
          title: note.title,
          content: note.content,
          preview,
          isViewed: gameState.isViewed('Notes', note.id),
        };
      });
  }

  // ==================== UI 构建 ====================

  _buildUI() {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const headerTotal = this._statusBarHeight + HEADER_HEIGHT + 8;

    // ScrollView
    this._scrollView = new ScrollView({
      width: sw,
      height: sh - headerTotal,
      contentHeight: 0,
      showScrollbar: true,
      bounceEnabled: true,
    });
    this._scrollView.x = 0;
    this._scrollView.y = headerTotal;
    this.addChild(this._scrollView);

    // 构建笔记列表
    this._buildNoteList();
  }

  /**
   * 构建笔记卡片列表
   * @private
   */
  _buildNoteList() {
    this._cardRects = [];
    const sw = this._screenWidth;
    const cardWidth = sw - LIST_PADDING * 2;
    let curY = SPACING_LG;

    if (this._noteList.length === 0) {
      // 空状态（高度占位，在 _draw 中绘制）
      this._scrollView.contentHeight = 300;
      return;
    }

    for (let i = 0; i < this._noteList.length; i++) {
      const note = this._noteList[i];
      const cardHeight = 70; // 卡片固定高度

      this._cardRects.push({
        index: i,
        x: LIST_PADDING,
        y: curY,
        width: cardWidth,
        height: cardHeight,
        note,
      });

      curY += cardHeight + CARD_GAP;
    }

    this._scrollView.contentHeight = curY + SPACING_XL;
  }

  /**
   * 刷新列表
   * @private
   */
  _rebuildList() {
    if (!this._scrollView) return;
    this._scrollView.removeAllChildren();
    this._buildNoteList();
  }

  // ==================== 渲染 ====================

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

    // 环境光（底部琥珀 + 左侧青色）
    const ambientGrad1 = ctx.createRadialGradient(
      sw * 0.5, sh, 0,
      sw * 0.5, sh, sw * 0.7
    );
    ambientGrad1.addColorStop(0, 'rgba(245, 166, 35, 0.04)');
    ambientGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad1;
    ctx.fillRect(0, 0, sw, sh);

    const ambientGrad2 = ctx.createRadialGradient(
      sw * 0.2, sh * 0.3, 0,
      sw * 0.2, sh * 0.3, sw * 0.5
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

    // ====== 返回按钮（琥珀色边框） ======
    const btnR = 14;
    const btnCX = (16 + 14);
    const btnCY = (headerTop + HEADER_HEIGHT / 2);

    ctx.beginPath();
    ctx.arc(btnCX, btnCY, btnR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.25)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(245, 166, 35, 0.04)';
    ctx.fill();
    ctx.stroke();

    // 返回箭头
    ctx.font = `${15}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_AMBER;
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

    // 装饰符（琥珀色）
    ctx.font = `${11}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_AMBER;
    ctx.globalAlpha = 0.7;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 标题文字
    ctx.globalAlpha = 1;
    ctx.font = `bold ${16}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = GLOW_CYAN_40;
    ctx.shadowBlur = 8;
    ctx.fillText('\u229E 加密笔记', titleCX, titleY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 副标题
    ctx.font = `${9}px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('PRIVATE NOTES \u00B7 ALIAS', titleCX, titleY + 14);

    // 占位（右侧平衡）
    // 无需绘制

    // ====== 流光线（琥珀+青双色） ======
    const flowLineY = headerH;
    const flowGrad = ctx.createLinearGradient(0, 0, sw, 0);
    flowGrad.addColorStop(0, 'transparent');
    flowGrad.addColorStop(0.3, 'rgba(0, 245, 212, 0.06)');
    flowGrad.addColorStop(0.5, 'rgba(245, 166, 35, 0.12)');
    flowGrad.addColorStop(0.7, 'rgba(0, 245, 212, 0.06)');
    flowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flowGrad;
    ctx.fillRect(0, flowLineY, sw, 1);

    // 流光扫描
    const scanWidth = 60;
    const scanCycle = 4000;
    const scanPos = ((this._flowTimer % scanCycle) / scanCycle) * (sw + scanWidth) - scanWidth;
    const scanGrad = ctx.createLinearGradient(scanPos, 0, scanPos + scanWidth, 0);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.3, RUNE_AMBER);
    scanGrad.addColorStop(0.7, RUNE_CYAN);
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(scanPos, flowLineY, scanWidth, 1);
    ctx.globalAlpha = 1;
  }

  /**
   * 重写 render 以绘制 ScrollView 内的笔记卡片 + 弹窗
   */
  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;

    ctx.save();

    const ax = this.anchorX * this.width;
    const ay = this.anchorY * this.height;
    ctx.translate(this.x + ax, this.y + ay);
    if (this.rotation !== 0) ctx.rotate(this.rotation);
    if (this.scaleX !== 1 || this.scaleY !== 1) ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-ax, -ay);
    ctx.globalAlpha *= this.alpha;

    // 绘制背景和导航栏
    this._draw(ctx);

    // 绘制 ScrollView 内容
    if (this._scrollView) {
      this._renderScrollView(ctx);
    }

    // 绘制详情弹窗
    if (this._modalVisible) {
      this._renderModal(ctx);
    }

    ctx.restore();
  }

  /**
   * 渲染 ScrollView 内的笔记卡片
   * @private
   */
  _renderScrollView(ctx) {
    const sv = this._scrollView;

    ctx.save();
    ctx.translate(sv.x, sv.y);

    // 裁剪
    ctx.beginPath();
    ctx.rect(0, 0, sv.width, sv.height);
    ctx.clip();

    // 滚动偏移
    ctx.translate(0, -sv.scrollY);

    if (this._noteList.length === 0) {
      // 空状态
      ctx.font = `${14}px ${FONT_PRIMARY}`;
      ctx.fillStyle = '#4a5568';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('暂无可查看的笔记', (sv.width / 2), 100);

      ctx.font = `${11}px ${FONT_MONO}`;
      ctx.fillStyle = '#2d3748';
      ctx.fillText('更多数据解密中...', (sv.width / 2), 125);
    } else {
      // 绘制笔记卡片
      for (let i = 0; i < this._cardRects.length; i++) {
        const cr = this._cardRects[i];
        const note = cr.note;

        // 可视区域判断
        const cardTop = cr.y;
        const cardBottom = cr.y + cr.height;
        if (cardBottom < sv.scrollY || cardTop > sv.scrollY + sv.height) continue;

        const cx = cr.x;
        const cy = cr.y;
        const cw = cr.width;
        const ch = cr.height;
        const cut = CARD_CUT;

        // 双色阴影（琥珀+青）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 245, 212, 0.06)';
        ctx.shadowBlur = 2;

        // 卡片切角路径
        ctx.beginPath();
        ctx.moveTo(cx + cut, cy);
        ctx.lineTo(cx + cw, cy);
        ctx.lineTo(cx + cw, cy + ch - cut);
        ctx.lineTo(cx + cw - cut, cy + ch);
        ctx.lineTo(cx, cy + ch);
        ctx.lineTo(cx, cy + cut);
        ctx.closePath();

        // 卡片背景
        const cardGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
        cardGrad.addColorStop(0, 'rgba(12, 18, 48, 0.9)');
        cardGrad.addColorStop(1, 'rgba(8, 12, 32, 0.95)');
        ctx.fillStyle = cardGrad;

        // 按下状态
        if (i === this._pressedCardIndex) {
          ctx.fillStyle = 'rgba(0, 245, 212, 0.05)';
        }

        // 已阅读透明度降低
        if (note.isViewed) {
          ctx.globalAlpha = 0.72;
        }

        ctx.fill();
        ctx.restore();

        // 卡片边框（青+琥珀渐变）
        ctx.save();
        const borderGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
        borderGrad.addColorStop(0, 'rgba(0, 245, 212, 0.25)');
        borderGrad.addColorStop(1, 'rgba(245, 166, 35, 0.1)');
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + cut, cy);
        ctx.lineTo(cx + cw, cy);
        ctx.lineTo(cx + cw, cy + ch - cut);
        ctx.lineTo(cx + cw - cut, cy + ch);
        ctx.lineTo(cx, cy + ch);
        ctx.lineTo(cx, cy + cut);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 扫描线纹理
        ctx.save();
        ctx.globalAlpha = 0.01;
        for (let sy = cy; sy < cy + ch; sy += 5) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cx, sy, cw, 1);
        }
        ctx.restore();

        // 已阅读状态处理
        ctx.save();
        if (note.isViewed) {
          ctx.globalAlpha = 0.72;
        }

        // 笔记图标 ◈
        const iconX = (cr.x + 14);
        const iconY = (cr.y + 14);
        ctx.font = `${11}px ${FONT_PRIMARY}`;
        ctx.fillStyle = RUNE_CYAN;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
        ctx.shadowBlur = 3;
        ctx.fillText('\u25C8', iconX, iconY);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 笔记标题
        const titleX = iconX + 16;
        ctx.font = `500 ${15}px ${FONT_PRIMARY}`;
        ctx.fillStyle = '#d1dce8';
        ctx.fillText(note.title, titleX, iconY);

        // 笔记预览
        ctx.font = `${12}px ${FONT_PRIMARY}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(note.preview, titleX, iconY + 22);

        ctx.restore();

        // 未读红点
        if (!note.isViewed) {
          const dotR = 3;
          const dotX = (cr.x + cr.width - 7);
          const dotY = (cr.y + 7);
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = RUNE_AMBER;
          ctx.shadowColor = 'rgba(245, 166, 35, 0.7)';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      }
    }

    ctx.restore();

    // 绘制滚动条
    if (sv.showScrollbar && sv._scrollbarAlpha > 0 && sv.contentHeight > sv.height) {
      ctx.save();
      ctx.translate(sv.x, sv.y);
      sv._drawScrollbar(ctx);
      ctx.restore();
    }
  }

  /**
   * 渲染笔记详情弹窗
   * @private
   */
  _renderModal(ctx) {
    if (!this._expandedNote) return;

    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const note = this._expandedNote;

    // ====== 遮罩层 ======
    ctx.save();
    ctx.globalAlpha = this._overlayAlpha * 0.78;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, sw, sh);
    ctx.restore();

    // ====== 弹窗卡片 ======
    const modalW = sw * 0.9;
    const modalH = sh * 0.65;
    const mx = (sw - modalW) / 2;
    const my = (sh - modalH) / 2;
    const cut = MODAL_CUT;

    ctx.save();

    // 弹窗变换（缩放 + 透明度）
    const cardCX = (mx + modalW / 2);
    const cardCY = (my + modalH / 2);
    ctx.translate(cardCX, cardCY);
    ctx.scale(this._modalScale, this._modalScale);
    ctx.translate(-cardCX, -cardCY);
    ctx.globalAlpha = this._modalAlpha;

    const mxd = mx;
    const myd = my;
    const mwd = modalW;
    const mhd = modalH;
    const cutd = cut;

    // 切角路径
    ctx.beginPath();
    ctx.moveTo(mxd + cutd, myd);
    ctx.lineTo(mxd + mwd - cutd, myd);
    ctx.lineTo(mxd + mwd, myd + cutd);
    ctx.lineTo(mxd + mwd, myd + mhd - cutd);
    ctx.lineTo(mxd + mwd - cutd, myd + mhd);
    ctx.lineTo(mxd + cutd, myd + mhd);
    ctx.lineTo(mxd, myd + mhd - cutd);
    ctx.lineTo(mxd, myd + cutd);
    ctx.closePath();

    // 弹窗背景
    ctx.fillStyle = 'rgba(10, 14, 38, 0.99)';
    ctx.fill();

    // 弹窗边框
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 弹窗阴影效果
    ctx.shadowColor = 'rgba(245, 166, 35, 0.06)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.moveTo(mxd + cutd, myd);
    ctx.lineTo(mxd + mwd - cutd, myd);
    ctx.lineTo(mxd + mwd, myd + cutd);
    ctx.lineTo(mxd + mwd, myd + mhd - cutd);
    ctx.lineTo(mxd + mwd - cutd, myd + mhd);
    ctx.lineTo(mxd + cutd, myd + mhd);
    ctx.lineTo(mxd, myd + mhd - cutd);
    ctx.lineTo(mxd, myd + cutd);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // ====== HUD 四角线装饰 ======
    const cornerLen = 20;
    const cornerOff = 3;

    // 左上（琥珀）
    ctx.beginPath();
    ctx.moveTo(mxd + cornerOff, myd + cornerOff + cornerLen);
    ctx.lineTo(mxd + cornerOff, myd + cornerOff);
    ctx.lineTo(mxd + cornerOff + cornerLen, myd + cornerOff);
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 右上（青）
    ctx.beginPath();
    ctx.moveTo(mxd + mwd - cornerOff - cornerLen, myd + cornerOff);
    ctx.lineTo(mxd + mwd - cornerOff, myd + cornerOff);
    ctx.lineTo(mxd + mwd - cornerOff, myd + cornerOff + cornerLen);
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.stroke();

    // 左下（青）
    ctx.beginPath();
    ctx.moveTo(mxd + cornerOff, myd + mhd - cornerOff - cornerLen);
    ctx.lineTo(mxd + cornerOff, myd + mhd - cornerOff);
    ctx.lineTo(mxd + cornerOff + cornerLen, myd + mhd - cornerOff);
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.5)';
    ctx.stroke();

    // 右下（琥珀）
    ctx.beginPath();
    ctx.moveTo(mxd + mwd - cornerOff - cornerLen, myd + mhd - cornerOff);
    ctx.lineTo(mxd + mwd - cornerOff, myd + mhd - cornerOff);
    ctx.lineTo(mxd + mwd - cornerOff, myd + mhd - cornerOff - cornerLen);
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.5)';
    ctx.stroke();

    // ====== 标题行 ======
    const headerPadding = 16;
    const titleX = (mx + headerPadding);
    const titleY = (my + 14);

    ctx.font = `500 ${16}px ${FONT_PRIMARY}`;
    ctx.fillStyle = '#d1dce8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(note.title, titleX, titleY);

    // ====== 关闭按钮 ×（六角形） ======
    const closeBtnR = 14;
    const closeCX = (mx + modalW - headerPadding - 14);
    const closeCY = (my + 14 + 9);

    // 六角形背景
    ctx.beginPath();
    for (let a = 0; a < 6; a++) {
      const angle = (Math.PI / 3) * a - Math.PI / 2;
      const px = closeCX + closeBtnR * Math.cos(angle);
      const ppy = closeCY + closeBtnR * Math.sin(angle);
      if (a === 0) ctx.moveTo(px, ppy);
      else ctx.lineTo(px, ppy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(245, 166, 35, 0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // × 符号
    ctx.font = `${18}px ${FONT_PRIMARY}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u00D7', closeCX, closeCY);

    // 记录关闭按钮区域
    this._closeBtnRect = {
      x: (mx + modalW - headerPadding - 28),
      y: (my + 14 - 5),
      width: 28,
      height: 28,
    };

    // ====== 分隔线 ======
    const dividerY = (my + 42);
    const divGrad = ctx.createLinearGradient(mxd + headerPadding, 0, mxd + mwd - headerPadding, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.3, 'rgba(245, 166, 35, 0.15)');
    divGrad.addColorStop(0.7, 'rgba(0, 245, 212, 0.1)');
    divGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = divGrad;
    ctx.fillRect(mxd + headerPadding, dividerY, mwd - headerPadding * 2, 1);

    // ====== 内容区域（裁剪 + 滚动） ======
    const contentPadding = 16;
    const contentTop = my + 56;
    const contentHeight = modalH - 66;
    const contentWidth = modalW - contentPadding * 2;

    // 裁剪内容区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      (mx + contentPadding),
      contentTop,
      contentWidth,
      contentHeight
    );
    ctx.clip();

    // 内容滚动偏移
    const modalScrollY = this._modalScrollView ? this._modalScrollView.scrollY : 0;
    ctx.translate(0, -modalScrollY);

    // 绘制笔记正文
    ctx.font = `${13.5}px ${FONT_PRIMARY}`;
    ctx.fillStyle = '#a8b8cc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const maxContentW = contentWidth;
    const lineH = 13.5 * 1.95;

    // 计算换行（缓存）
    if (!this._modalContentLines || this._modalContentLines.length === 0) {
      this._modalContentLines = this._wrapText(ctx, note.content || '', maxContentW);
    }

    const contentInnerPad = 4;
    for (let li = 0; li < this._modalContentLines.length; li++) {
      ctx.fillText(
        this._modalContentLines[li],
        (mx + contentPadding),
        (contentTop + contentInnerPad + li * 13.5 * 1.95)
      );
    }

    // 更新弹窗 ScrollView 内容高度
    const totalContentH = this._modalContentLines.length * 13.5 * 1.95;
    if (this._modalScrollView) {
      this._modalScrollView.contentHeight = totalContentH;
      this._modalScrollView.height = contentHeight;
    }

    ctx.restore();

    // 弹窗记录区域（用于点击检测）
    this._modalRect = { x: mx, y: my, width: modalW, height: modalH };

    ctx.restore();
  }

  /**
   * 文字换行工具
   * @private
   */
  _wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
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

  // ==================== 更新 ====================

  update(dt) {
    super.update(dt);
    this._flowTimer += dt;

    if (this._scrollView) {
      this._scrollView.update(dt);
    }

    if (this._modalScrollView) {
      this._modalScrollView.update(dt);
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

    // 如果弹窗可见，处理弹窗内的触摸
    if (this._modalVisible) {
      if (this._modalScrollView) {
        this._modalScrollView.onTouchStart(y);
      }
      return;
    }

    // ScrollView 处理
    if (this._scrollView && this._scrollView.containsPoint(x, y)) {
      this._scrollView.onTouchStart(y);

      // 检查是否按下了卡片
      const scrollLocalY = y - this._scrollView.y + this._scrollView.scrollY;
      for (let i = 0; i < this._cardRects.length; i++) {
        const cr = this._cardRects[i];
        if (scrollLocalY >= cr.y && scrollLocalY <= cr.y + cr.height &&
            x >= cr.x && x <= cr.x + cr.width) {
          this._pressedCardIndex = i;
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

    if (this._modalVisible) {
      if (this._modalScrollView) {
        this._modalScrollView.onTouchMove(y);
      }
      return;
    }

    if (this._scrollView) {
      this._scrollView.onTouchMove(y);

      // 如果发生滚动，取消卡片按下状态
      if (this._pressedCardIndex >= 0 && this._scrollView.didScroll()) {
        this._pressedCardIndex = -1;
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

    // 弹窗模式下的点击处理
    if (this._modalVisible) {
      if (this._modalScrollView) {
        const didScroll = this._modalScrollView.didScroll();
        this._modalScrollView.onTouchEnd();
        if (didScroll) return;
      }

      // 检查关闭按钮
      if (this._closeBtnRect) {
        const cb = this._closeBtnRect;
        if (x >= cb.x && x <= cb.x + cb.width && y >= cb.y && y <= cb.y + cb.height) {
          this._collapseNote();
          return;
        }
      }

      // 检查是否点击在弹窗外部 → 关闭
      if (this._modalRect) {
        const mr = this._modalRect;
        const inModal = x >= mr.x && x <= mr.x + mr.width &&
                        y >= mr.y && y <= mr.y + mr.height;
        if (!inModal) {
          this._collapseNote();
        }
      }
      return;
    }

    // 检查返回按钮
    const headerTop = this._statusBarHeight;
    const btnCX = 16 + 14;
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

      // 如果没有滚动且有按下的卡片，则打开笔记
      if (!didScroll && this._pressedCardIndex >= 0) {
        const cr = this._cardRects[this._pressedCardIndex];
        if (cr) {
          this._expandNote(cr.note);
        }
      }

      this._pressedCardIndex = -1;
    }
  }

  // ==================== 交互逻辑 ====================

  /**
   * 展开笔记详情
   * @private
   */
  _expandNote(note) {
    if (!note || this._isShowingModal) return;

    // 标记已阅读
    gameState.markViewed('Notes', note.id);

    // 加密笔记阅读追踪（ch4→ch5 触发条件）
    if (note.id.startsWith('encrypted_note_')) {
      gameState.markEncryptedNoteViewed(note.id);
      // 检查是否所有加密笔记已阅读 → 推进到 ch5
      if (gameState.areAllEncryptedNotesViewed(8)) {
        gameState.advanceChapter(5);
      }
    }

    this._expandedNote = note;
    this._modalContentLines = []; // 清除缓存，重新计算
    this._modalVisible = true;
    this._isShowingModal = true;
    this._overlayAlpha = 0;
    this._modalScale = 0.8;
    this._modalAlpha = 0;

    // 创建弹窗内 ScrollView
    this._modalScrollView = new ScrollView({
      width: this._screenWidth * 0.9 - 32,
      height: this._screenHeight * 0.65 - 60,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });

    // 显示动画
    Tween.stopAll(this);
    Tween.create(this)
      .to({
        _overlayAlpha: 1,
        _modalScale: 1,
        _modalAlpha: 1,
      }, ANIM_NORMAL, 'easeOut')
      .call(() => {
        this._isShowingModal = false;
      })
      .start();

    // 刷新列表（更新已阅读状态）
    this._loadNotes();
    this._rebuildList();
  }

  /**
   * 关闭笔记详情
   * @private
   */
  _collapseNote() {
    if (this._isHidingModal) return;
    this._isHidingModal = true;

    Tween.stopAll(this);
    Tween.create(this)
      .to({
        _overlayAlpha: 0,
        _modalScale: 0.8,
        _modalAlpha: 0,
      }, ANIM_NORMAL, 'easeIn')
      .call(() => {
        this._modalVisible = false;
        this._isHidingModal = false;
        this._expandedNote = null;
        this._modalScrollView = null;
        this._modalContentLines = [];
      })
      .start();
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
