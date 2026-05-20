/**
 * SocialPage.js - 灵波社交平台页面
 * 继承 Scene，完整还原 social 页面
 * 个人资料卡 + Tab 栏 + 帖子列表/热点榜 + 关键词收集
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { RichText } from '../engine/RichText.js';
import { Graphics } from '../engine/Graphics.js';
import { Sprite } from '../engine/Sprite.js';
import { ScrollView } from '../engine/ScrollView.js';
import { Tween } from '../engine/Tween.js';
import { Toast } from '../components/Toast.js';
import gameState from '../core/GameState.js';
import { socialProfile, myPosts, followingPosts, trendingList } from '../data/social.js';
import {
  BG_DARK, RUNE_CYAN, RUNE_BLUE, RUNE_MAGENTA, RUNE_AMBER,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG, FONT_SIZE_XL,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL,
  GLOW_BLUE_40, GLOW_BLUE_80,
  ANIM_NORMAL,
} from '../style/StyleConfig.js';

/** 导航栏高度（不含状态栏） */
const HEADER_HEIGHT = 44;
/** 列表左右内边距 */
const LIST_PADDING = 16;
/** Tab 标签名称 */
const TAB_LABELS = ['我的动态', '关注的人', '热点榜'];
const TAB_KEYS = ['my', 'following', 'trending'];

export class SocialPage extends Scene {
  constructor() {
    super();

    /** 屏幕尺寸 */
    this._screenWidth = 0;
    this._screenHeight = 0;
    /** 状态栏高度 */
    this._statusBarHeight = 0;

    /** 当前激活的 Tab */
    this._activeTab = 'my';
    /** 当前帖子列表（解析后） */
    this._currentPosts = [];
    /** 热点榜数据 */
    this._trendingList = trendingList;

    /** 是否有未读消息 */
    this._hasUnreadChat = false;

    /** ScrollView */
    this._scrollView = null;

    /** 帖子组件列表（用于点击检测） */
    this._postNodes = [];
    /** 热点条目列表（渲染用） */
    this._trendingNodes = [];

    /** 流光线动画计时器 */
    this._flowTimer = 0;

    /** Toast 组件 */
    this._toast = null;

    /** Tab 下划线动画 X 偏移 */
    this._tabUnderlineX = 0;

    /** 所有帖子卡片内 RichText 实例列表（用于关键词点击） */
    this._richTexts = [];

    /** 按下的卡片索引 */
    this._pressedPostIndex = -1;
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
    gameState.markPageVisited('social');

    // 检查未读消息
    this._hasUnreadChat = gameState.hasUnreadChat();

    // 解析帖子数据
    this._currentPosts = this._parsePosts(myPosts);

    // 构建 UI
    this._buildUI();
  }

  onResume() {
    this._hasUnreadChat = gameState.hasUnreadChat();
  }

  onExit() {
    Tween.stopAll(this);
  }

  // ==================== 数据解析 ====================

  /**
   * 解析帖子列表，将关键词拆分为 segments
   * @private
   */
  _parsePosts(posts) {
    const collectedIds = gameState.get().collectedEvidence || [];
    return posts.map(post => {
      const segments = post.keywords && post.keywords.length > 0
        ? this._parseSegments(post.content, post.keywords, collectedIds)
        : null;
      // 处理评论关键词
      const comments = (post.comments || []).map(c => {
        const cSegments = c.keywords && c.keywords.length > 0
          ? this._parseSegments(c.content, c.keywords, collectedIds)
          : null;
        return Object.assign({}, c, { segments: cSegments });
      });
      return Object.assign({}, post, { segments, comments });
    });
  }

  /**
   * 将文本拆分为 text/keyword 段
   * @private
   */
  _parseSegments(text, keywords, collectedIds) {
    if (!keywords || keywords.length === 0) {
      return [{ type: 'text', content: text }];
    }
    const positions = [];
    keywords.forEach(kw => {
      let idx = 0;
      while (true) {
        const found = text.indexOf(kw.word, idx);
        if (found === -1) break;
        positions.push({ start: found, end: found + kw.word.length, word: kw.word, evidenceId: kw.evidenceId });
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
        type: 'keyword', content: p.word,
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

  _buildUI() {
    const sw = this._screenWidth;
    const sh = this._screenHeight;
    const headerTotal = this._statusBarHeight + HEADER_HEIGHT + 4;
    const listTop = headerTotal;

    // ScrollView
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

    // Toast
    this._toast = new Toast({
      text: '已收集至证据板',
      icon: '◈',
      duration: 1500,
      parentWidth: sw,
      parentHeight: sh,
    });
    this._toast.zIndex = 100;
    this.addChild(this._toast);

    // 构建列表内容
    this._rebuildScrollContent();
  }

  /**
   * 重建滚动区域内容（Tab 切换时调用）
   * @private
   */
  _rebuildScrollContent() {
    if (!this._scrollView) return;
    this._scrollView.removeAllChildren();
    this._postNodes = [];
    this._trendingNodes = [];
    this._richTexts = [];

    const sw = this._screenWidth;
    const contentWidth = sw - LIST_PADDING * 2;
    let curY = 0;

    // ====== 个人资料卡 ======
    curY = this._buildProfileCard(curY, contentWidth);

    // ====== Tab 栏 ======
    curY = this._buildTabBar(curY);

    // ====== 内容区域 ======
    if (this._activeTab === 'trending') {
      curY = this._buildTrendingList(curY, contentWidth);
    } else {
      curY = this._buildPostList(curY, contentWidth);
    }

    // 底部留白
    curY += 40;
    this._scrollView.contentHeight = curY;
  }

  /**
   * 构建个人资料卡
   * @private
   * @returns {number} 下一个 Y 坐标
   */
  _buildProfileCard(startY, contentWidth) {
    // 个人资料卡通过 _draw 直接绘制（使用固定高度）
    // 返回卡片底部 Y
    this._profileCardHeight = 95;
    return startY + this._profileCardHeight;
  }

  /**
   * 构建 Tab 栏
   * @private
   */
  _buildTabBar(startY) {
    this._tabBarY = startY;
    this._tabBarHeight = 40;

    // 更新下划线位置
    const tabIndex = TAB_KEYS.indexOf(this._activeTab);
    const tabWidth = this._screenWidth / 3;
    this._tabUnderlineX = tabWidth * tabIndex + tabWidth * 0.2;
    this._tabUnderlineWidth = tabWidth * 0.6;

    return startY + this._tabBarHeight;
  }

  /**
   * 构建帖子列表
   * @private
   */
  /**
   * 估算文本行数（处理 \n 换行符 + 自动换行）
   * @private
   * @param {string} text - 文本内容
   * @param {number} maxWidth - 最大宽度
   * @param {number} fontSize - 字体大小
   * @returns {number} 行数
   */
  _estimateLineCount(text, maxWidth, fontSize) {
    if (!text) return 1;
    let totalLines = 0;
    const paragraphs = text.split('\n');
    // 中文字符约等于 fontSize 宽度；用 fontSize 本身（不乘 0.85）
    // 这样估算偏保守（行数偏多），避免内容挤在一起
    const charsPerLine = Math.max(1, Math.floor(maxWidth / fontSize));
    for (const para of paragraphs) {
      if (para === '') {
        totalLines += 1;
      } else {
        totalLines += Math.max(1, Math.ceil(para.length / charsPerLine));
      }
    }
    return totalLines;
  }

  _buildPostList(startY, contentWidth) {
    let curY = startY + SPACING_MD;
    const isFollowing = this._activeTab === 'following';
    // 卡片内边距（对齐旧版 padding: 32rpx = 16px）
    const cardPadTop = 14;
    const cardPadBottom = 14;
    // 帖子之间间距
    const postGap = 10;

    for (let i = 0; i < this._currentPosts.length; i++) {
      const post = this._currentPosts[i];
      const postStartY = curY;
      let localY = cardPadTop; // 顶部内边距

      // ====== 帖子头部 ======
      // following: 头像 32px 高 + margin-bottom 8px = 40px
      // my: 时间戳 11px + margin-bottom 12px = 23px（加大间距避免挤在一起）
      const headerH = isFollowing ? 40 : 23;
      localY += headerH;

      // ====== 帖子正文 ======
      const textStartY = localY;
      const textLines = this._estimateLineCount(post.content, contentWidth, 14);
      // 正文高度 + margin-bottom 12px
      const textHeight = Math.max(textLines * 14 * 1.7, 14) + 12;

      if (post.segments) {
        const richText = new RichText({
          segments: post.segments,
          fontSize: 14,
          color: TEXT_PRIMARY,
          keywordColor: '#38bdf8',
          keywordCollectedColor: 'rgba(56, 189, 248, 0.3)',
          maxWidth: contentWidth,
          lineHeight: 1.7,
        });
        richText.x = LIST_PADDING;
        richText.y = curY + localY;
        this._scrollView.addChild(richText);
        this._richTexts.push({ richText, postIndex: i, type: 'post' });
      }
      localY += textHeight;

      // ====== 配图 ======
      const imageY = localY; // 图片相对帖子起点的 Y
      let imageHeight = 0;
      if (post.image) {
        const imgW = contentWidth;
        imageHeight = Math.floor(imgW * 0.56);
        const imgSprite = new Sprite({
          src: post.image,
          width: imgW,
          height: imageHeight,
        });
        imgSprite.x = LIST_PADDING;
        imgSprite.y = curY + localY;
        imgSprite.on('load', (info) => {
          const ratio = info.height / info.width;
          imgSprite.height = Math.floor(imgW * ratio);
        });
        this._scrollView.addChild(imgSprite);
        localY += imageHeight + 12; // image margin-bottom
      }

      // ====== 点赞 ======
      const likesY = localY;
      localY += 12 + 12; // 点赞行高 12px + margin-bottom 12px（加大与评论区间距）

      // ====== 评论区 ======
      const commentsY = localY;
      let commentsTotalH = 0;
      if (post.comments && post.comments.length > 0) {
        localY += 8; // 评论区 padding-top: 16rpx = 8px
        for (let ci = 0; ci < post.comments.length; ci++) {
          const comment = post.comments[ci];
          const fullCommentText = (comment.author || '') + '：' + (comment.content || '');
          const commentLines = this._estimateLineCount(fullCommentText, contentWidth - 20, 12);
          if (comment.segments) {
            const crt = new RichText({
              segments: [
                { type: 'text', content: comment.author + '：' },
                ...comment.segments,
              ],
              fontSize: 12,
              color: TEXT_SECONDARY,
              keywordColor: '#38bdf8',
              keywordCollectedColor: 'rgba(56, 189, 248, 0.3)',
              maxWidth: contentWidth - 20,
              lineHeight: 1.8,
            });
            crt.x = LIST_PADDING + 10;
            crt.y = curY + localY;
            this._scrollView.addChild(crt);
            this._richTexts.push({ richText: crt, postIndex: i, commentIndex: ci, type: 'comment' });
          }
          const lineH = commentLines * 12 * 1.8;
          commentsTotalH += lineH;
          localY += lineH;
        }
        localY += 8; // 评论区 padding-bottom: 16rpx = 8px
      }

      // 底部内边距
      localY += cardPadBottom;

      // 记录帖子节点信息（缓存各区段的相对 Y 偏移，_drawPostList 直接使用）
      this._postNodes.push({
        index: i,
        x: 0,
        y: postStartY,
        width: this._screenWidth,
        height: localY,
        post,
        // 各区段相对帖子起点的 Y 偏移
        textStartY,
        imageY,
        imageHeight,
        likesY,
        commentsY,
        commentsTotalH,
      });

      curY += localY + postGap; // 帖子之间加间距
    }

    return curY;
  }

  /**
   * 构建热点榜列表
   * @private
   */
  _buildTrendingList(startY, contentWidth) {
    let curY = startY + SPACING_MD;

    for (let i = 0; i < this._trendingList.length; i++) {
      const item = this._trendingList[i];
      const itemStartY = curY;

      // 标签行
      const tagHeight = 16 * 1.4;
      // 内容行
      const contentLen = (item.content || '').length;
      const charsPerLine = Math.floor((contentWidth - 50) / 12);
      const contentLines = Math.max(1, Math.ceil(contentLen / charsPerLine));
      const contentHeight = contentLines * 12 * 1.6;

      const itemHeight = SPACING_LG + tagHeight + 4 + contentHeight + SPACING_LG;

      this._trendingNodes.push({
        index: i,
        x: 0,
        y: itemStartY,
        width: this._screenWidth,
        height: itemHeight,
        item,
      });

      curY += itemHeight;
    }

    return curY;
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

    // 环境光（底部蓝光 + 右上洋红氛围）
    const ambientGrad1 = ctx.createRadialGradient(
      sw * 0.5, sh, 0,
      sw * 0.5, sh, sw * 0.8
    );
    ambientGrad1.addColorStop(0, 'rgba(58, 134, 255, 0.04)');
    ambientGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad1;
    ctx.fillRect(0, 0, sw, sh);

    const ambientGrad2 = ctx.createRadialGradient(
      sw * 0.8, sh * 0.1, 0,
      sw * 0.8, sh * 0.1, sw * 0.5
    );
    ambientGrad2.addColorStop(0, 'rgba(255, 45, 224, 0.03)');
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
    const btnCX = (16 + 14);
    const btnCY = (headerTop + HEADER_HEIGHT / 2);

    ctx.beginPath();
    ctx.arc(btnCX, btnCY, btnR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(58, 134, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(58, 134, 255, 0.04)';
    ctx.fill();
    ctx.stroke();

    // 返回箭头
    ctx.font = `${15}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_BLUE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2190', btnCX, btnCY);

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

    // 装饰符（洋红色）
    ctx.font = `${11}px ${FONT_PRIMARY}`;
    ctx.fillStyle = 'rgba(255, 45, 224, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 标题文字
    ctx.font = `bold ${18}px ${FONT_PRIMARY}`;
    ctx.fillStyle = RUNE_BLUE;
    ctx.shadowColor = GLOW_BLUE_40;
    ctx.shadowBlur = 8;
    ctx.fillText('\u25C8 灵波', titleCX, titleY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 副标题
    ctx.font = `${9}px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText('LINGBO \u00B7 SOCIAL', titleCX, titleY + 14);

    // ====== 流光线（蓝+洋红双色） ======
    const flowLineY = headerH;
    const flowGrad = ctx.createLinearGradient(0, 0, sw, 0);
    flowGrad.addColorStop(0, 'transparent');
    flowGrad.addColorStop(0.25, 'rgba(255, 45, 224, 0.08)');
    flowGrad.addColorStop(0.5, 'rgba(58, 134, 255, 0.15)');
    flowGrad.addColorStop(0.75, 'rgba(255, 45, 224, 0.08)');
    flowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flowGrad;
    ctx.fillRect(0, flowLineY, sw, 1);

    // 流光扫描
    const scanWidth = 60;
    const scanCycle = 4000;
    const scanPos = ((this._flowTimer % scanCycle) / scanCycle) * (sw + scanWidth) - scanWidth;
    const scanGrad = ctx.createLinearGradient(scanPos, 0, scanPos + scanWidth, 0);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.3, RUNE_BLUE);
    scanGrad.addColorStop(0.7, RUNE_MAGENTA);
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(scanPos, flowLineY, scanWidth, 1);
    ctx.globalAlpha = 1;

    // ====== ScrollView 内容绘制（在 ScrollView._draw 前，绘制卡片背景和文字） ======
    // 以下内容在 ScrollView 裁剪后通过 _drawScrollContent 绘制
  }

  /**
   * 重写 render 以在 ScrollView 内绘制自定义内容
   */
  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;

    ctx.save();

    // 计算锚点偏移
    const ax = this.anchorX * this.width;
    const ay = this.anchorY * this.height;
    ctx.translate(this.x + ax, this.y + ay);
    if (this.rotation !== 0) ctx.rotate(this.rotation);
    if (this.scaleX !== 1 || this.scaleY !== 1) ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-ax, -ay);
    ctx.globalAlpha *= this.alpha;

    // 绘制背景和导航栏
    this._draw(ctx);

    // 绘制 ScrollView（含裁剪区域内的自定义内容）
    if (this._scrollView) {
      this._renderScrollView(ctx);
    }

    // 绘制 Toast（最上层）
    if (this._toast) {
      this._toast.render(ctx);
    }

    ctx.restore();
  }

  /**
   * 手动渲染 ScrollView 并在其中绘制帖子/热点榜
   * @private
   */
  _renderScrollView(ctx) {
    const sv = this._scrollView;
    const svX = sv.x;
    const svY = sv.y;
    const svW = sv.width;
    const svH = sv.height;

    ctx.save();
    // 移到 ScrollView 位置
    ctx.translate(svX, svY);

    // 裁剪可视区域
    ctx.beginPath();
    ctx.rect(0, 0, svW, svH);
    ctx.clip();

    // 应用滚动偏移
    ctx.translate(0, -sv.scrollY);

    // 绘制个人资料卡
    this._drawProfileCard(ctx);

    // 绘制 Tab 栏
    this._drawTabBar(ctx);

    // 绘制帖子列表 或 热点榜
    if (this._activeTab === 'trending') {
      this._drawTrendingList(ctx);
    } else {
      this._drawPostList(ctx);
    }

    // 渲染 ScrollView 中的 RichText 子节点
    for (const child of sv.children) {
      child.render(ctx);
    }

    ctx.restore();

    // 绘制滚动条（在裁剪外）
    if (sv.showScrollbar && sv._scrollbarAlpha > 0 && sv.contentHeight > sv.height) {
      ctx.save();
      ctx.translate(svX, svY);
      sv._drawScrollbar(ctx);
      ctx.restore();
    }
  }

  /**
   * 绘制个人资料卡
   * @private
   */
  _drawProfileCard(ctx) {
    const sw = this._screenWidth;
    const padding = LIST_PADDING;
    const startY = 0;

    // 资料卡背景分隔线
    ctx.strokeStyle = 'rgba(68, 136, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, (startY + this._profileCardHeight));
    ctx.lineTo(sw, (startY + this._profileCardHeight));
    ctx.stroke();

    // 头像圆圈
    const avatarR = 24;
    const avatarCX = (padding + 24);
    const avatarCY = (startY + 16 + 24);

    // 头像发光背景
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    const avatarGrad = ctx.createLinearGradient(
      avatarCX - avatarR, avatarCY - avatarR,
      avatarCX + avatarR, avatarCY + avatarR
    );
    avatarGrad.addColorStop(0, 'rgba(58, 134, 255, 0.12)');
    avatarGrad.addColorStop(1, 'rgba(255, 45, 224, 0.08)');
    ctx.fillStyle = avatarGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(58, 134, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 头像发光效果
    ctx.shadowColor = 'rgba(58, 134, 255, 0.15)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 头像文字 "A"
    ctx.font = `bold ${20}px ${FONT_PRIMARY}`;
    ctx.fillStyle = 'rgba(68, 136, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', avatarCX, avatarCY);

    // 名字 + handle
    const infoX = (padding + 60);
    let infoY = (startY + 16);

    ctx.font = `bold ${17}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(socialProfile.name, infoX, infoY);

    const nameWidth = ctx.measureText(socialProfile.name).width;
    ctx.font = `${11}px ${FONT_MONO}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(socialProfile.handle, infoX + nameWidth + 6, infoY + 4);

    // 角色
    infoY += 22;
    ctx.font = `${11}px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(255, 45, 224, 0.7)';
    ctx.shadowColor = 'rgba(255, 45, 224, 0.3)';
    ctx.shadowBlur = 3;
    ctx.fillText(socialProfile.role, infoX, infoY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 简介
    infoY += 16;
    ctx.font = `${13}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.fillText(socialProfile.bio, infoX, infoY);

    // 关注/粉丝
    infoY += 20;
    ctx.font = `${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.textBaseline = 'top';

    const followText = '关注 ';
    ctx.fillText(followText, infoX, infoY);
    let statX = infoX + ctx.measureText(followText).width;

    ctx.font = `bold ${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.fillText(String(socialProfile.following), statX, infoY);
    statX += ctx.measureText(String(socialProfile.following)).width;

    ctx.font = `${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(' · ', statX, infoY);
    statX += ctx.measureText(' · ').width;

    ctx.fillStyle = TEXT_SECONDARY;
    const fansText = '粉丝 ';
    ctx.fillText(fansText, statX, infoY);
    statX += ctx.measureText(fansText).width;

    ctx.font = `bold ${12}px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.fillText(String(socialProfile.followers), statX, infoY);
  }

  /**
   * 绘制 Tab 栏
   * @private
   */
  _drawTabBar(ctx) {
    const sw = this._screenWidth;
    const tabY = this._tabBarY;
    const tabH = this._tabBarHeight;
    const tabW = sw / 3;

    // Tab 背景
    ctx.fillStyle = 'rgba(10, 14, 39, 0.95)';
    ctx.fillRect(0, tabY, sw, tabH);

    // Tab 底边线
    ctx.strokeStyle = 'rgba(58, 134, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, (tabY + tabH));
    ctx.lineTo(sw, (tabY + tabH));
    ctx.stroke();

    // Tab 文字
    for (let i = 0; i < TAB_LABELS.length; i++) {
      const isActive = TAB_KEYS[i] === this._activeTab;
      const tx = (tabW * i + tabW / 2);
      const ty = (tabY + 10);

      ctx.font = `${isActive ? 'bold ' : ''}${13}px ${FONT_MONO}`;
      ctx.fillStyle = isActive ? 'rgba(58, 134, 255, 0.9)' : TEXT_DIM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(TAB_LABELS[i], tx, ty);

      // 活跃下划线
      if (isActive) {
        const ulX = (tabW * i + tabW * 0.2);
        const ulW = tabW * 0.6;
        const ulY = (tabY + tabH - 2);
        const ulH = 2;

        const ulGrad = ctx.createLinearGradient(ulX, 0, ulX + ulW, 0);
        ulGrad.addColorStop(0, 'rgba(58, 134, 255, 0.9)');
        ulGrad.addColorStop(1, 'rgba(255, 45, 224, 0.6)');
        ctx.fillStyle = ulGrad;

        // 发光效果
        ctx.shadowColor = 'rgba(58, 134, 255, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillRect(ulX, ulY, ulW, ulH);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    }
  }

  /**
   * 绘制帖子列表
   * @private
   */
  _drawPostList(ctx) {
    const isFollowing = this._activeTab === 'following';
    const sw = this._screenWidth;
    const contentWidth = sw - LIST_PADDING * 2;

    for (let pi = 0; pi < this._postNodes.length; pi++) {
      const pn = this._postNodes[pi];
      const post = pn.post;
      const py = pn.y; // 帖子绝对起始 Y

      // 帖子卡片背景（微透明，增强视觉分隔）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.fillRect(4, py, sw - 8, pn.height);

      // 帖子底部分隔线（加深）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LIST_PADDING, py + pn.height);
      ctx.lineTo(sw - LIST_PADDING, py + pn.height);
      ctx.stroke();

      // 左侧装饰线（从卡片内边距区域开始）
      const decoGrad = ctx.createLinearGradient(0, py + 12, 0, py + pn.height - 12);
      decoGrad.addColorStop(0, 'rgba(58, 134, 255, 0.3)');
      decoGrad.addColorStop(0.5, 'rgba(255, 45, 224, 0.12)');
      decoGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = decoGrad;
      ctx.fillRect(4, py + 12, 2, pn.height - 24);

      const leftX = LIST_PADDING;

      // ====== 头部（使用缓存的绝对 Y） ======
      if (isFollowing) {
        const author = post.author || '';
        const authorInitial = author.length > 0 ? author[0] : '?';
        const smallR = 16;
        const saCX = leftX + 16;
        const saCY = py + 14 + 20; // 加上卡片顶部内边距

        ctx.beginPath();
        ctx.arc(saCX, saCY, smallR, 0, Math.PI * 2);
        const saGrad = ctx.createLinearGradient(saCX - smallR, saCY - smallR, saCX + smallR, saCY + smallR);
        saGrad.addColorStop(0, 'rgba(58, 134, 255, 0.1)');
        saGrad.addColorStop(1, 'rgba(255, 45, 224, 0.06)');
        ctx.fillStyle = saGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(58, 134, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.shadowColor = 'rgba(58, 134, 255, 0.08)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(saCX, saCY, smallR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.font = `bold ${13}px ${FONT_PRIMARY}`;
        ctx.fillStyle = 'rgba(58, 134, 255, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(authorInitial, saCX, saCY);

        const nameX = leftX + 40;
        ctx.font = `bold ${14}px ${FONT_PRIMARY}`;
        ctx.fillStyle = TEXT_PRIMARY;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(author, nameX, py + 14 + 8);

        if (post.authorRole) {
          ctx.font = `${10}px ${FONT_MONO}`;
          ctx.fillStyle = TEXT_DIM;
          ctx.fillText(post.authorRole, nameX, py + 14 + 24);
        }

        ctx.font = `${11}px ${FONT_MONO}`;
        ctx.fillStyle = TEXT_DIM;
        ctx.textAlign = 'right';
        ctx.fillText(post.time, sw - LIST_PADDING, py + 14 + 12);
      } else {
        // 「我的动态」时间戳 — 偏移卡片顶部内边距
        ctx.font = `${11}px ${FONT_MONO}`;
        ctx.fillStyle = TEXT_DIM;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(post.time, leftX, py + 14);
      }

      // ====== 正文（使用缓存的 textStartY）======
      const textAbsY = py + pn.textStartY;
      if (!post.segments) {
        ctx.font = `${14}px ${FONT_PRIMARY}`;
        ctx.fillStyle = TEXT_PRIMARY;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const maxW = contentWidth;
        const lines = this._wrapText(ctx, post.content || '', maxW);
        for (let li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], leftX, textAbsY + li * 14 * 1.7);
        }
      }
      // RichText 由子节点自动渲染，位置已在 _buildPostList 中设好

      // ====== 点赞（使用缓存的 likesY）======
      const likesAbsY = py + pn.likesY;
      const likeText = `\u2661 ${post.likes}`;
      ctx.font = `${12}px ${FONT_PRIMARY}`;
      ctx.fillStyle = post.likedByUser ? RUNE_MAGENTA : TEXT_DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (post.likedByUser) {
        ctx.shadowColor = 'rgba(255, 45, 224, 0.4)';
        ctx.shadowBlur = 3;
      }
      ctx.fillText(likeText, leftX, likesAbsY);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // ====== 评论区（使用缓存的 commentsY + commentsTotalH）======
      if (post.comments && post.comments.length > 0) {
        let localY = py + pn.commentsY;
        const commentBgX = leftX;
        const commentBgW = contentWidth;
        const commentStartY = localY;
        const commentTotalH = pn.commentsTotalH || 0;

        // 评论背景
        ctx.fillStyle = 'rgba(58, 134, 255, 0.03)';
        ctx.fillRect(commentBgX, commentStartY, commentBgW, commentTotalH + SPACING_SM * 2);

        // 左侧边框线
        const cbGrad = ctx.createLinearGradient(0, commentStartY, 0, commentStartY + commentTotalH);
        cbGrad.addColorStop(0, 'rgba(58, 134, 255, 0.2)');
        cbGrad.addColorStop(1, 'rgba(255, 45, 224, 0.1)');
        ctx.fillStyle = cbGrad;
        ctx.fillRect(commentBgX, commentStartY, 2, commentTotalH + SPACING_SM * 2);

        localY += SPACING_SM;

        for (let ci = 0; ci < post.comments.length; ci++) {
          const comment = post.comments[ci];
          if (!comment.segments) {
            // 无关键词的普通评论
            ctx.font = `${12}px ${FONT_PRIMARY}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // 作者名（洋红）
            ctx.fillStyle = 'rgba(255, 45, 224, 0.7)';
            const authorText = comment.author + '\uFF1A';
            ctx.fillText(authorText, (leftX + 10), localY);
            const authorW = ctx.measureText(authorText).width;

            // 评论内容
            ctx.fillStyle = TEXT_SECONDARY;
            const commentContent = comment.content || '';
            // 简单处理：如果同行放不下则换行
            const remainW = contentWidth - 20 - authorW;
            if (ctx.measureText(commentContent).width <= remainW) {
              ctx.fillText(commentContent, (leftX + 10) + authorW, localY);
              localY += 12 * 1.8;
            } else {
              // 多行
              const fullText = authorText + commentContent;
              const cLines = this._wrapText(ctx, fullText, (contentWidth - 20));
              for (let li = 0; li < cLines.length; li++) {
                if (li === 0) {
                  // 第一行中作者名部分高亮
                  ctx.fillStyle = 'rgba(255, 45, 224, 0.7)';
                  ctx.fillText(authorText, (leftX + 10), (localY + li * 12 * 1.8));
                  ctx.fillStyle = TEXT_SECONDARY;
                  ctx.fillText(cLines[li].slice(authorText.length), (leftX + 10) + authorW, (localY + li * 12 * 1.8));
                } else {
                  ctx.fillStyle = TEXT_SECONDARY;
                  ctx.fillText(cLines[li], (leftX + 10), (localY + li * 12 * 1.8));
                }
              }
              localY += cLines.length * 12 * 1.8;
            }
          } else {
            // 带关键词的评论由 RichText 子节点渲染
            const cLen = ((comment.author || '').length + 1 + (comment.content || '').length);
            const cLines = Math.max(1, Math.ceil(cLen / Math.floor((contentWidth - 20) / 12)));
            localY += cLines * 12 * 1.8;
          }
        }
      }
    }
  }

  /**
   * 绘制热点榜
   * @private
   */
  _drawTrendingList(ctx) {
    const sw = this._screenWidth;

    for (let i = 0; i < this._trendingNodes.length; i++) {
      const tn = this._trendingNodes[i];
      const item = tn.item;
      const iy = tn.y;

      // 底部分隔线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, (iy + tn.height));
      ctx.lineTo(sw, (iy + tn.height));
      ctx.stroke();

      // 排名数字
      const rankX = (LIST_PADDING + 14);
      const rankY = (iy + SPACING_LG + 2);
      ctx.font = `bold ${14}px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (item.isHot) {
        ctx.fillStyle = '#ff6b4a';
        ctx.shadowColor = 'rgba(255, 107, 74, 0.4)';
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = TEXT_DIM;
      }
      ctx.fillText(String(item.rank), rankX, rankY);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 标签
      const tagX = (LIST_PADDING + 38);
      ctx.font = `bold ${14}px ${FONT_PRIMARY}`;
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`#${item.tag}#`, tagX, (iy + SPACING_LG));

      // 内容
      ctx.font = `${12}px ${FONT_PRIMARY}`;
      ctx.fillStyle = TEXT_SECONDARY;
      const tagHeight = 14 * 1.4;
      const contentMaxW = (sw - LIST_PADDING - 38 - LIST_PADDING - 30);
      const contentLines = this._wrapText(ctx, item.content || '', contentMaxW);
      for (let li = 0; li < contentLines.length; li++) {
        ctx.fillText(contentLines[li], tagX, (iy + SPACING_LG + tagHeight + 4 + li * 12 * 1.6));
      }

      // 热点标记
      if (item.isHot) {
        const badgeX = (sw - LIST_PADDING - 20);
        const badgeY = (iy + SPACING_LG + 2);
        ctx.font = `${10}px ${FONT_MONO}`;
        ctx.fillStyle = '#ff6b4a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(255, 107, 74, 0.3)';
        ctx.shadowBlur = 3;
        ctx.fillText('\u70ED', badgeX, badgeY);

        // 边框
        ctx.strokeStyle = 'rgba(255, 107, 74, 0.4)';
        ctx.lineWidth = 1;
        const bw = 16;
        const bh = 14;
        ctx.strokeRect(badgeX - bw / 2, badgeY - 1, bw, bh);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    }
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
    const btnCX = 16 + 14;
    const btnCY = headerTop + HEADER_HEIGHT / 2;
    const dist = Math.sqrt((x - btnCX) ** 2 + (y - btnCY) ** 2);
    if (dist <= 20) {
      this._goBack();
      if (this._scrollView) this._scrollView.onTouchEnd();
      return;
    }

    // ScrollView 内的交互
    if (this._scrollView) {
      const didScroll = this._scrollView.didScroll();
      this._scrollView.onTouchEnd();

      if (!didScroll) {
        // 将触摸坐标转换为 ScrollView 内部坐标
        const localX = x;
        const localY = y - this._scrollView.y + this._scrollView.scrollY;

        // 检查 Tab 栏点击
        if (localY >= this._tabBarY && localY <= this._tabBarY + this._tabBarHeight) {
          const tabW = this._screenWidth / 3;
          const tabIndex = Math.floor(x / tabW);
          if (tabIndex >= 0 && tabIndex < TAB_KEYS.length) {
            this._switchTab(TAB_KEYS[tabIndex]);
          }
          return;
        }

        // 检查 RichText 关键词点击
        for (const rt of this._richTexts) {
          const richText = rt.richText;
          // 将 ScrollView 内的坐标转为 RichText 本地坐标
          const rtLocalX = localX - richText.x;
          const rtLocalY = localY - richText.y;

          if (rtLocalX >= 0 && rtLocalX <= richText.maxWidth &&
              rtLocalY >= 0 && rtLocalY <= richText.height) {
            const hit = richText.onTap(localX, localY);
            if (hit && hit.evidenceId) {
              this._collectKeyword(hit.evidenceId, rt.postIndex, hit.segIndex, rt.type, rt.commentIndex);
              return;
            }
          }
        }
      }
    }
  }

  // ==================== 交互逻辑 ====================

  /**
   * 切换 Tab
   * @private
   */
  _switchTab(tab) {
    if (tab === this._activeTab) return;
    this._activeTab = tab;

    if (tab === 'my') {
      this._currentPosts = this._parsePosts(myPosts);
    } else if (tab === 'following') {
      this._currentPosts = this._parsePosts(followingPosts);
    }

    this._rebuildScrollContent();
    // 重置滚动位置到 Tab 栏下方
    if (this._scrollView) {
      this._scrollView.scrollY = 0;
    }
  }

  /**
   * 收集关键词
   * @private
   */
  _collectKeyword(evidenceId, postIndex, segIndex, type, commentIndex) {
    if (!evidenceId) return;

    // 检查是否已收集
    const state = gameState.get();
    if (state.collectedEvidence && state.collectedEvidence.includes(evidenceId)) return;

    // 收集证据
    gameState.collectEvidence(evidenceId);

    // 振动反馈
    try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* 忽略 */ }

    // 标记 RichText 中相同 evidenceId 的关键词为已收集
    for (const rt of this._richTexts) {
      rt.richText.markCollected(evidenceId);
    }

    // 显示 Toast
    if (this._toast) {
      this._toast.show('已收集至证据板', '◈');
    }
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
