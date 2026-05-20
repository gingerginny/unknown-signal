/**
 * Sprite.js - 图片渲染组件
 * 使用 wx.createImage() 加载并绘制图片
 */

import { Node } from './Node.js';

export class Sprite extends Node {
  /**
   * @param {Object|string} options - 配置对象或图片路径
   * @param {string} [options.src] - 图片路径
   * @param {number} [options.width] - 显示宽度（不设则用图片原始宽度）
   * @param {number} [options.height] - 显示高度（不设则用图片原始高度）
   */
  constructor(options = {}) {
    super();

    // 支持直接传字符串作为 src
    if (typeof options === 'string') {
      options = { src: options };
    }

    /** 图片路径 */
    this.src = options.src || '';

    /** @private wx.createImage() 实例 */
    this._image = null;
    /** @private 是否加载完成 */
    this._loaded = false;

    if (options.width) this.width = options.width;
    if (options.height) this.height = options.height;

    // 如果传入了 src，立即开始加载
    if (this.src) {
      this.load(this.src);
    }
  }

  /**
   * 获取 DPR
   * @private
   */
  _getDPR() {
    const engine = this.getEngine();
    return engine ? engine.getDPR() : 2;
  }

  /**
   * 加载图片
   * @param {string} src - 图片路径
   * @returns {Promise<void>}
   */
  load(src) {
    this.src = src;
    this._loaded = false;

    return new Promise((resolve, reject) => {
      const img = wx.createImage();

      img.onload = () => {
        this._image = img;
        this._loaded = true;

        // 如果未设置宽高，使用图片原始尺寸（转换为逻辑像素）
        const dpr = this._getDPR();
        if (!this.width || this.width === 0) {
          this.width = img.width / dpr;
        }
        if (!this.height || this.height === 0) {
          this.height = img.height / dpr;
        }

        this.emit('load', { width: img.width, height: img.height });
        resolve();
      };

      img.onerror = (err) => {
        console.error(`[Sprite] 图片加载失败: ${src}`, err);
        this.emit('error', err);
        reject(err);
      };

      img.src = src;
    });
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    if (!this._loaded || !this._image) return;

    const w = this.width;
    const h = this.height;

    ctx.drawImage(this._image, 0, 0, w, h);
  }

  /**
   * 图片是否已加载
   * @returns {boolean}
   */
  isLoaded() {
    return this._loaded;
  }
}
