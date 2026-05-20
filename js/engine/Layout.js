/**
 * Layout.js - 布局容器组件
 * 支持水平、垂直和网格三种布局模式，自动计算子节点位置
 */

import { Node } from './Node.js';

export class Layout extends Node {
  /**
   * @param {Object} options
   * @param {string} [options.type='vertical'] - 布局类型 'horizontal' | 'vertical' | 'grid'
   * @param {number} [options.gap=0] - 子节点间距
   * @param {Object} [options.padding] - 内边距 { top, right, bottom, left }
   * @param {string} [options.alignItems='start'] - 对齐方式 'start' | 'center' | 'end'
   * @param {boolean} [options.wrap=false] - 是否换行（grid 模式）
   * @param {number} [options.columns=2] - 列数（grid 模式）
   */
  constructor(options = {}) {
    super();

    this.type = options.type || 'vertical';
    this.gap = options.gap || 0;
    this.padding = Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, options.padding);
    this.alignItems = options.alignItems || 'start';
    this.wrap = options.wrap !== undefined ? options.wrap : false;
    this.columns = options.columns || 2;
  }

  /**
   * 计算布局，设置所有子节点的位置
   * @private
   */
  _layout() {
    if (this.children.length === 0) return;

    const { top, right, bottom, left } = this.padding;
    const availableWidth = this.width - left - right;
    const availableHeight = this.height - top - bottom;

    switch (this.type) {
      case 'horizontal':
        this._layoutHorizontal(left, top, availableWidth, availableHeight);
        break;
      case 'vertical':
        this._layoutVertical(left, top, availableWidth, availableHeight);
        break;
      case 'grid':
        this._layoutGrid(left, top, availableWidth, availableHeight);
        break;
    }
  }

  /**
   * 水平布局
   * @private
   */
  _layoutHorizontal(startX, startY, availableWidth, availableHeight) {
    let curX = startX;

    for (const child of this.children) {
      if (!child.visible) continue;

      child.x = curX;

      // 垂直对齐
      switch (this.alignItems) {
        case 'center':
          child.y = startY + (availableHeight - child.height) / 2;
          break;
        case 'end':
          child.y = startY + availableHeight - child.height;
          break;
        default: // 'start'
          child.y = startY;
          break;
      }

      curX += child.width + this.gap;
    }

    // 更新容器实际内容宽度
    if (this.children.length > 0) {
      const lastChild = this._getLastVisibleChild();
      if (lastChild) {
        this.width = Math.max(this.width, lastChild.x + lastChild.width + this.padding.right);
      }
    }
  }

  /**
   * 垂直布局
   * @private
   */
  _layoutVertical(startX, startY, availableWidth, availableHeight) {
    let curY = startY;

    for (const child of this.children) {
      if (!child.visible) continue;

      child.y = curY;

      // 水平对齐
      switch (this.alignItems) {
        case 'center':
          child.x = startX + (availableWidth - child.width) / 2;
          break;
        case 'end':
          child.x = startX + availableWidth - child.width;
          break;
        default: // 'start'
          child.x = startX;
          break;
      }

      curY += child.height + this.gap;
    }

    // 更新容器实际内容高度
    if (this.children.length > 0) {
      const lastChild = this._getLastVisibleChild();
      if (lastChild) {
        this.height = Math.max(this.height, lastChild.y + lastChild.height + this.padding.bottom);
      }
    }
  }

  /**
   * 网格布局
   * @private
   */
  _layoutGrid(startX, startY, availableWidth, availableHeight) {
    const columns = this.columns;
    // 计算每列宽度
    const cellWidth = (availableWidth - (columns - 1) * this.gap) / columns;

    let col = 0;
    let rowY = startY;
    let rowMaxHeight = 0;

    for (const child of this.children) {
      if (!child.visible) continue;

      // 计算列位置
      const cellX = startX + col * (cellWidth + this.gap);

      // 水平对齐（在单元格内）
      switch (this.alignItems) {
        case 'center':
          child.x = cellX + (cellWidth - child.width) / 2;
          break;
        case 'end':
          child.x = cellX + cellWidth - child.width;
          break;
        default: // 'start'
          child.x = cellX;
          break;
      }

      child.y = rowY;

      // 记录当前行最大高度
      rowMaxHeight = Math.max(rowMaxHeight, child.height);

      col++;
      if (col >= columns) {
        // 换行
        col = 0;
        rowY += rowMaxHeight + this.gap;
        rowMaxHeight = 0;
      }
    }

    // 更新容器高度
    if (col > 0) {
      // 最后一行未满
      rowY += rowMaxHeight;
    }
    this.height = Math.max(this.height, rowY + this.padding.bottom);
  }

  /**
   * 获取最后一个可见子节点
   * @private
   * @returns {Node|null}
   */
  _getLastVisibleChild() {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i].visible) return this.children[i];
    }
    return null;
  }

  /**
   * 重写 addChild，添加后自动重新布局
   * @param {Node} node
   * @returns {Node}
   */
  addChild(node) {
    super.addChild(node);
    this._layout();
    return node;
  }

  /**
   * 重写 removeChild，移除后自动重新布局
   * @param {Node} node
   */
  removeChild(node) {
    super.removeChild(node);
    this._layout();
  }

  /**
   * 重写 removeAllChildren，清除后重置布局
   */
  removeAllChildren() {
    super.removeAllChildren();
  }

  /**
   * 手动触发重新布局
   */
  relayout() {
    this._layout();
  }
}
