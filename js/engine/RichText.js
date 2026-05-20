/**
 * RichText.js - 富文本组件（关键词高亮 + 点击收集）
 * 支持 text/keyword 混合段落，自动换行，关键词可点击
 * 这是游戏中最核心的文字交互组件
 */

import { Node } from './Node.js';

export class RichText extends Node {
  /**
   * @param {Object} options
   * @param {Array} [options.segments] - 段落数组 [{ type: 'text'|'keyword', content, evidenceId?, collected? }]
   * @param {number} [options.fontSize=14] - 字号
   * @param {string} [options.color='#ffffff'] - 默认文字颜色
   * @param {string} [options.keywordColor='#00f5d4'] - 关键词颜色（青色）
   * @param {string} [options.keywordCollectedColor='#666666'] - 已收集关键词颜色
   * @param {number} [options.maxWidth=300] - 最大宽度
   * @param {number} [options.lineHeight=1.4] - 行高倍数
   * @param {string} [options.fontFamily] - 字体
   * @param {boolean} [options.bold=false] - 是否加粗
   */
  constructor(options = {}) {
    super();

    this.segments = options.segments || [];
    this.fontSize = options.fontSize || 14;
    this.color = options.color || '#ffffff';
    this.keywordColor = options.keywordColor || '#00f5d4';
    this.keywordCollectedColor = options.keywordCollectedColor || '#666666';
    this.maxWidth = options.maxWidth || 300;
    this.lineHeight = options.lineHeight || 1.4;
    this.fontFamily = options.fontFamily || 'PingFang SC, Microsoft YaHei, sans-serif';
    this.bold = options.bold || false;

    /**
     * 关键词点击区域列表
     * @type {Array<{ x: number, y: number, width: number, height: number, segIndex: number, evidenceId: string }>}
     * @private
     */
    this._hitAreas = [];

    /** @private 缓存的排版结果 */
    this._layoutCache = null;
    /** @private 上次排版用的 segments JSON */
    this._cachedSegmentsKey = null;
  }

  /**
   * 构建字体字符串
   * @private
   */
  _buildFont() {
    const prefix = this.bold ? 'bold ' : '';
    return `${prefix}${this.fontSize}px ${this.fontFamily}`;
  }

  /**
   * 排版计算 —— 将 segments 拆分为逐行渲染指令
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @returns {Array} 排版指令数组
   */
  _computeLayout(ctx) {
    const font = this._buildFont();
    const maxWidthPx = this.maxWidth;
    const lineHeightPx = this.fontSize * this.lineHeight;

    ctx.font = font;

    // 排版指令：{ type, content, color, underline, x, y, width, segIndex, evidenceId }
    const renderItems = [];
    // 点击区域
    const hitAreas = [];

    let curX = 0;
    let curY = 0;

    for (let segIdx = 0; segIdx < this.segments.length; segIdx++) {
      const seg = this.segments[segIdx];
      const isKeyword = seg.type === 'keyword';
      const content = seg.content || '';

      if (!content) continue;

      // 确定颜色
      let color;
      if (isKeyword) {
        color = seg.collected ? this.keywordCollectedColor : this.keywordColor;
      } else {
        color = this.color;
      }

      if (isKeyword) {
        // 关键词：尽量整体放置，放不下则换行
        const wordWidth = ctx.measureText(content).width;

        if (curX + wordWidth > maxWidthPx && curX > 0) {
          // 当前行放不下，换行
          curX = 0;
          curY += lineHeightPx;
        }

        // 检查单个关键词是否超过最大宽度（需要拆字）
        if (wordWidth <= maxWidthPx) {
          // 整体放置
          renderItems.push({
            type: 'keyword',
            content,
            color,
            underline: !seg.collected,
            x: curX,
            y: curY,
            width: wordWidth,
            segIndex: segIdx,
            evidenceId: seg.evidenceId,
          });

          hitAreas.push({
            x: curX,
            y: curY,
            width: wordWidth,
            height: (this.fontSize * this.lineHeight),
            segIndex: segIdx,
            evidenceId: seg.evidenceId,
          });

          curX += wordWidth;
        } else {
          // 关键词超长，需要拆字渲染（同时记录多个 hitArea）
          const keywordHitAreas = [];
          for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const charWidth = ctx.measureText(char).width;

            if (curX + charWidth > maxWidthPx && curX > 0) {
              curX = 0;
              curY += lineHeightPx;
            }

            renderItems.push({
              type: 'keyword',
              content: char,
              color,
              underline: !seg.collected,
              x: curX,
              y: curY,
              width: charWidth,
              segIndex: segIdx,
              evidenceId: seg.evidenceId,
            });

            keywordHitAreas.push({
              x: curX,
              y: curY,
              width: charWidth,
              height: (this.fontSize * this.lineHeight),
              segIndex: segIdx,
              evidenceId: seg.evidenceId,
            });

            curX += charWidth;
          }
          // 跨行关键词：每段都加入 hitAreas
          hitAreas.push(...keywordHitAreas);
        }
      } else {
        // 普通文本：逐字排版
        for (let i = 0; i < content.length; i++) {
          const char = content[i];

          // 处理换行符
          if (char === '\n') {
            curX = 0;
            curY += lineHeightPx;
            continue;
          }

          const charWidth = ctx.measureText(char).width;

          if (curX + charWidth > maxWidthPx && curX > 0) {
            curX = 0;
            curY += lineHeightPx;
          }

          renderItems.push({
            type: 'text',
            content: char,
            color,
            underline: false,
            x: curX,
            y: curY,
            width: charWidth,
            segIndex: segIdx,
          });

          curX += charWidth;
        }
      }
    }

    // 计算总高度
    const totalHeight = curY + lineHeightPx;

    return { renderItems, hitAreas, totalHeight };
  }

  /**
   * 绘制实现
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    if (!this.segments || this.segments.length === 0) return;

    const font = this._buildFont();

    ctx.font = font;
    ctx.textBaseline = 'top';

    // 计算排版（使用缓存）
    const segKey = JSON.stringify(this.segments) + '|' + this.maxWidth + '|' + this.fontSize;
    if (segKey !== this._cachedSegmentsKey) {
      this._layoutCache = this._computeLayout(ctx);
      this._cachedSegmentsKey = segKey;
    }

    const { renderItems, hitAreas, totalHeight } = this._layoutCache;
    this._hitAreas = hitAreas;

    // 逐项绘制
    for (const item of renderItems) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.content, item.x, item.y);

      // 绘制下划线（虚线）
      if (item.underline) {
        const underlineY = item.y + this.fontSize * 0.95;
        ctx.save();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(item.x, underlineY);
        ctx.lineTo(item.x + item.width, underlineY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // 更新组件高度
    this.height = totalHeight;
  }

  /**
   * 检测点击是否命中关键词
   * @param {number} worldX - 世界坐标 X（逻辑像素）
   * @param {number} worldY - 世界坐标 Y（逻辑像素）
   * @returns {{ segIndex: number, evidenceId: string } | null}
   */
  onTap(worldX, worldY) {
    // 将世界坐标转换为组件本地坐标
    const localX = worldX - this.x;
    const localY = worldY - this.y;
    return this.hitTest(localX, localY);
  }

  /**
   * 使用本地坐标检测关键词命中（无世界坐标转换）
   * @param {number} localX - RichText 本地坐标 X
   * @param {number} localY - RichText 本地坐标 Y
   * @returns {{ segIndex: number, evidenceId: string } | null}
   */
  hitTest(localX, localY) {
    for (const area of this._hitAreas) {
      if (
        localX >= area.x &&
        localX <= area.x + area.width &&
        localY >= area.y &&
        localY <= area.y + area.height
      ) {
        return {
          segIndex: area.segIndex,
          evidenceId: area.evidenceId,
        };
      }
    }

    return null;
  }

  /**
   * 设置段落数据并清除缓存
   * @param {Array} segments
   */
  setSegments(segments) {
    this.segments = segments;
    this._cachedSegmentsKey = null;
    this._layoutCache = null;
  }

  /**
   * 标记某个关键词为已收集
   * @param {string} evidenceId
   */
  markCollected(evidenceId) {
    for (const seg of this.segments) {
      if (seg.type === 'keyword' && seg.evidenceId === evidenceId) {
        seg.collected = true;
      }
    }
    // 清除缓存以触发重新排版
    this._cachedSegmentsKey = null;
    this._layoutCache = null;
  }
}
