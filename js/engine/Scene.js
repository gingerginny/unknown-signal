/**
 * Scene.js - 场景管理
 * 继承 Node，代表一个"页面"，包含该页面的所有 UI 元素
 * 负责生命周期管理和触摸事件的递归分发
 */

import { Node } from './Node.js';
import { EventSystem } from './EventSystem.js';

export class Scene extends Node {
  constructor() {
    super();

    /** 引擎实例引用（由 Engine 在 pushScene 时设置） */
    this.engine = null;

    /** 事件系统实例 */
    this._eventSystem = new EventSystem();
  }

  // ==================== 生命周期 ====================

  /**
   * 场景进入时调用（子类重写）
   */
  onEnter() {}

  /**
   * 场景退出时调用（子类重写）
   */
  onExit() {}

  /**
   * 场景被新场景覆盖时调用（子类重写）
   */
  onPause() {}

  /**
   * 上层场景退出后恢复时调用（子类重写）
   */
  onResume() {}

  // ==================== 触摸事件处理 ====================

  /**
   * 处理触摸开始事件
   * @param {Object} event - 转换后的触摸事件
   */
  onTouchStart(event) {
    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    this._eventSystem.handleTouchStart(this, touch, event.timeStamp);
  }

  /**
   * 处理触摸移动事件
   * @param {Object} event - 转换后的触摸事件
   */
  onTouchMove(event) {
    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    this._eventSystem.handleTouchMove(this, touch, event.timeStamp);
  }

  /**
   * 处理触摸结束事件
   * @param {Object} event - 转换后的触摸事件
   */
  onTouchEnd(event) {
    if (event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    this._eventSystem.handleTouchEnd(this, touch, event.timeStamp);
  }
}
