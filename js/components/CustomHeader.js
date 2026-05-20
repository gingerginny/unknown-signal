/**
 * CustomHeader.js - 统一导航栏组件
 * 所有页面共用的顶部导航栏
 * 包含：返回按钮（可选）、标题、右侧自定义区域、底部流光线动画
 */

import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import {
  BG_DARK, RUNE_CYAN, TEXT_PRIMARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG,
} from '../style/StyleConfig.js';

/** 导航栏内容区固定高度（不含状态栏） */
const HEADER_CONTENT_HEIGHT = 44;

export default class CustomHeader extends Node {
  /**
   * @param {Object} config
   * @param {number} config.width - 屏幕宽度（逻辑像素）
   * @param {number} config.statusBarHeight - 状态栏高度（逻辑像素）
   * @param {string} [config.title=''] - 标题文字
   * @param {string} [config.titleIcon=''] - 标题前置图标字符
   * @param {string} [config.subtitle=''] - 副标题
   * @param {boolean} [config.showBack=false] - 是否显示返回按钮
   * @param {Function} [config.onBack] - 返回按钮回调
   * @param {Node} [config.rightContent] - 右侧自定义子节点
   */
  constructor(config = {}) {
    super();

    this.width = config.width || 375;
    this._statusBarHeight = config.statusBarHeight || 20;
    this.height = this._statusBarHeight + HEADER_CONTENT_HEIGHT;
    this._config = config;

    // 流光线动画相关
    this._flowLineX = 0;       // 发光线当前 x 位置
    this._flowLineSpeed = 60;  // 每秒移动像素

    // 返回按钮交互
    this._backBtn = null;
    this._backBtnPressed = false;

    this._buildUI(config);
  }

  /**
   * 构建 UI 元素
   * @private
   */
  _buildUI(config) {
    const contentY = this._statusBarHeight;
    const padding = 16;

    // -- 左侧区域 --
    let leftX = padding;

    // 返回按钮（可选）
    if (config.showBack) {
      this._backBtn = new Node();
      this._backBtn.x = leftX;
      this._backBtn.y = contentY + (HEADER_CONTENT_HEIGHT - 28) / 2;
      this._backBtn.width = 28;
      this._backBtn.height = 28;
      this._backBtn.interactive = true;
      this._backBtn.on('tap', () => {
        if (config.onBack) config.onBack();
      });
      this.addChild(this._backBtn);
      leftX += 36;
    }

    // 标题组
    if (config.titleIcon) {
      this._titleIcon = new Label({
        text: config.titleIcon,
        fontSize: FONT_SIZE_SM,
        color: RUNE_CYAN,
      });
      this._titleIcon.alpha = 0.6;
      this._titleIcon.x = leftX;
      this._titleIcon.y = contentY + 8;
      this.addChild(this._titleIcon);
      leftX += 16;
    }

    if (config.title) {
      this._titleLabel = new Label({
        text: config.title,
        fontSize: FONT_SIZE_LG + 1,
        color: TEXT_PRIMARY,
        bold: true,
        shadowColor: RUNE_CYAN,
        shadowBlur: 4,
      });
      this._titleLabel.x = leftX;
      this._titleLabel.y = contentY + 6;
      this.addChild(this._titleLabel);
    }

    if (config.subtitle) {
      this._subtitleLabel = new Label({
        text: config.subtitle,
        fontSize: 9,
        color: TEXT_DIM,
        fontFamily: FONT_MONO,
      });
      this._subtitleLabel.x = config.titleIcon ? padding + 16 : padding;
      if (config.showBack) this._subtitleLabel.x += 36;
      this._subtitleLabel.y = contentY + 26;
      this.addChild(this._subtitleLabel);
    }

    // -- 右侧自定义内容 --
    if (config.rightContent) {
      config.rightContent.y = contentY;
      this.addChild(config.rightContent);
    }
  }

  /**
   * 每帧更新：驱动流光线动画
   * @param {number} dt - 帧间隔（毫秒）
   */
  update(dt) {
    super.update(dt);
    // 流光线从左到右循环
    this._flowLineX += this._flowLineSpeed * (dt / 1000);
    if (this._flowLineX > this.width + 40) {
      this._flowLineX = -40;
    }
  }

  /**
   * 绘制导航栏
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const w = this.width;
    const h = this.height;

    // 半透明背景渐变
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(10, 14, 39, 0.95)');
    grad.addColorStop(1, 'rgba(10, 14, 39, 0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 返回按钮绘制（如果有）
    if (this._config.showBack && this._backBtn) {
      const bx = this._backBtn.x;
      const by = this._backBtn.y;
      const bSize = 28;
      ctx.save();
      // 圆形边框
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx + bSize / 2, by + bSize / 2, bSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      // 箭头
      ctx.fillStyle = RUNE_CYAN;
      ctx.font = '14px ' + FONT_PRIMARY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('‹', bx + bSize / 2, by + bSize / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.restore();
    }

    // 底部流光线
    const lineY = h - 1;
    // 基础半透明线
    ctx.save();
    const baseLineGrad = ctx.createLinearGradient(0, lineY, w, lineY);
    baseLineGrad.addColorStop(0, 'transparent');
    baseLineGrad.addColorStop(0.5, 'rgba(0, 245, 212, 0.1)');
    baseLineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = baseLineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(w, lineY);
    ctx.stroke();

    // 发光线（流光扫过）
    const glowWidth = 40;
    const gx = this._flowLineX;
    const flowGrad = ctx.createLinearGradient(gx - glowWidth / 2, lineY, gx + glowWidth / 2, lineY);
    flowGrad.addColorStop(0, 'transparent');
    flowGrad.addColorStop(0.5, RUNE_CYAN);
    flowGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = flowGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx - glowWidth / 2, lineY);
    ctx.lineTo(gx + glowWidth / 2, lineY);
    ctx.stroke();
    ctx.restore();
  }
}

export { HEADER_CONTENT_HEIGHT };
