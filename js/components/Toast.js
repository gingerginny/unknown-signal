/**
 * Toast.js - 浮层提示组件
 * 居中显示提示文字，自动消失，淡入淡出动画
 * 支持自定义图标和文字
 */

import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { Tween } from '../engine/Tween.js';
import {
  RUNE_CYAN, RUNE_PURPLE, FONT_MONO, FONT_SIZE_SM,
} from '../style/StyleConfig.js';

export class Toast extends Node {
  /**
   * @param {Object} options
   * @param {string} [options.text='已收集至证据板'] - 提示文字
   * @param {string} [options.icon='◈'] - 图标字符
   * @param {number} [options.duration=1500] - 显示持续时间（毫秒）
   * @param {number} [options.parentWidth=375] - 父容器宽度（用于居中）
   * @param {number} [options.parentHeight=667] - 父容器高度（用于居中）
   */
  constructor(options = {}) {
    super();

    this._text = options.text || '已收集至证据板';
    this._icon = options.icon || '◈';
    this._duration = options.duration || 1500;
    this._parentWidth = options.parentWidth || 375;
    this._parentHeight = options.parentHeight || 667;

    // 组件尺寸
    this._toastWidth = 200;
    this._toastHeight = 36;
    this._cutSize = 8; // 切角尺寸

    this.visible = false;
    this.alpha = 0;

    // 创建背景
    this._bg = new Graphics();
    this.addChild(this._bg);

    // 创建图标标签
    this._iconLabel = new Label({
      text: this._icon,
      fontSize: FONT_SIZE_SM + 2,
      color: RUNE_CYAN,
      textAlign: 'left',
      shadowColor: 'rgba(0, 245, 212, 0.6)',
      shadowBlur: 4,
    });
    this.addChild(this._iconLabel);

    // 创建文字标签
    this._textLabel = new Label({
      text: this._text,
      fontSize: FONT_SIZE_SM,
      color: RUNE_CYAN,
      fontFamily: FONT_MONO,
      textAlign: 'left',
    });
    this.addChild(this._textLabel);

    /** @private 当前动画 Tween */
    this._tween = null;
  }

  /**
   * 布局并绘制背景
   * @private
   */
  _layout() {
    // 背景切角菱形样式
    this._bg.clear()
      .beginPath()
      .augmentedRect(0, 0, this._toastWidth, this._toastHeight, this._cutSize)
      .fill('rgba(4, 18, 24, 0.88)')
      .beginPath()
      .augmentedRect(0, 0, this._toastWidth, this._toastHeight, this._cutSize)
      .stroke('rgba(0, 245, 212, 0.5)', 0.5);

    // 图标位置
    const paddingX = 20;
    this._iconLabel.x = paddingX;
    this._iconLabel.y = (this._toastHeight - (FONT_SIZE_SM + 2)) / 2;

    // 文字位置（图标后面留间距）
    this._textLabel.x = paddingX + (FONT_SIZE_SM + 2) + 6;
    this._textLabel.y = (this._toastHeight - FONT_SIZE_SM) / 2;

    // 居中定位
    this.x = (this._parentWidth - this._toastWidth) / 2;
    this.y = (this._parentHeight - this._toastHeight) / 2;
    this.width = this._toastWidth;
    this.height = this._toastHeight;
  }

  /**
   * 显示 Toast（淡入 → 停留 → 淡出）
   * @param {string} [text] - 可选，覆盖显示文字
   * @param {string} [icon] - 可选，覆盖图标
   */
  show(text, icon) {
    if (text) {
      this._text = text;
      this._textLabel.text = text;
    }
    if (icon) {
      this._icon = icon;
      this._iconLabel.text = icon;
    }

    this._layout();

    // 停止之前的动画
    if (this._tween) {
      this._tween.stop();
    }

    this.visible = true;
    this.alpha = 0;

    // 淡入 → 停留 → 淡出
    const fadeInDuration = 150;
    const fadeOutDuration = 300;
    const stayDuration = this._duration - fadeInDuration - fadeOutDuration;

    this._tween = Tween.create(this)
      .to({ alpha: 1 }, fadeInDuration, 'easeOut')
      .delay(Math.max(stayDuration, 200))
      .to({ alpha: 0 }, fadeOutDuration, 'easeIn')
      .call(() => {
        this.visible = false;
        this._tween = null;
      })
      .start();
  }

  /**
   * 立即隐藏
   */
  hide() {
    if (this._tween) {
      this._tween.stop();
      this._tween = null;
    }
    this.visible = false;
    this.alpha = 0;
  }

  /**
   * 更新父容器尺寸（用于窗口变化时重新居中）
   * @param {number} width
   * @param {number} height
   */
  setParentSize(width, height) {
    this._parentWidth = width;
    this._parentHeight = height;
  }
}
