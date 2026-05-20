/**
 * Tween.js - 动画系统
 * 提供链式动画 API，支持属性动画、缓动函数、并行/序列动画、循环等
 */

// ==================== 缓动函数 ====================

const Easing = {
  linear(t) {
    return t;
  },
  easeIn(t) {
    return t * t * t;
  },
  easeOut(t) {
    const t1 = 1 - t;
    return 1 - t1 * t1 * t1;
  },
  easeInOut(t) {
    if (t < 0.5) {
      return 4 * t * t * t;
    }
    const t1 = -2 * t + 2;
    return 1 - (t1 * t1 * t1) / 2;
  },
};

// ==================== 全局 Tween 管理 ====================

/** 所有活跃的 Tween 实例 */
const _activeTweens = [];

export class Tween {
  /**
   * 创建一个绑定到目标节点的 Tween
   * @param {Object} target - 动画目标（通常是 Node 实例）
   * @returns {Tween}
   */
  static create(target) {
    return new Tween(target);
  }

  /**
   * 全局更新所有活跃的 Tween
   * @param {number} dt - 帧间隔毫秒数
   */
  static updateAll(dt) {
    // 倒序遍历，方便移除已完成的
    for (let i = _activeTweens.length - 1; i >= 0; i--) {
      const tween = _activeTweens[i];
      const finished = tween._update(dt);
      if (finished) {
        _activeTweens.splice(i, 1);
      }
    }
  }

  /**
   * 停止目标节点的所有动画
   * @param {Object} target
   */
  static stopAll(target) {
    for (let i = _activeTweens.length - 1; i >= 0; i--) {
      if (_activeTweens[i]._target === target) {
        _activeTweens.splice(i, 1);
      }
    }
  }

  /**
   * 并行执行多个 Tween（全部同时开始，全部结束后完成）
   * @param {Tween[]} tweens
   * @returns {Tween} 返回一个代理 Tween
   */
  static parallel(tweens) {
    const proxy = new Tween(null);
    proxy._actions = [{ type: 'parallel', tweens }];
    return proxy;
  }

  /**
   * 序列执行多个 Tween（依次执行）
   * @param {Tween[]} tweens
   * @returns {Tween} 返回一个代理 Tween
   */
  static sequence(tweens) {
    const proxy = new Tween(null);
    proxy._actions = [{ type: 'sequence', tweens, index: 0 }];
    return proxy;
  }

  /**
   * @param {Object} target - 动画目标
   */
  constructor(target) {
    this._target = target;

    /** 动画动作队列 */
    this._actions = [];

    /** 当前执行到的动作索引 */
    this._currentIndex = 0;

    /** 当前动作的已经过时间 */
    this._elapsed = 0;

    /** 当前动作的起始属性值快照 */
    this._startProps = null;

    /** 是否已启动 */
    this._started = false;

    /** 循环次数，-1 为无限 */
    this._repeatCount = 0;

    /** 已循环次数 */
    this._repeatDone = 0;
  }

  // ==================== 链式 API ====================

  /**
   * 添加属性动画
   * @param {Object} props - 目标属性值 { alpha: 1, y: 100 }
   * @param {number} duration - 持续时间（毫秒）
   * @param {string} [easing='linear'] - 缓动函数名
   * @returns {Tween} this
   */
  to(props, duration, easing = 'linear') {
    this._actions.push({
      type: 'to',
      props,
      duration,
      easing,
    });
    return this;
  }

  /**
   * 添加延迟
   * @param {number} duration - 延迟毫秒数
   * @returns {Tween} this
   */
  delay(duration) {
    this._actions.push({
      type: 'delay',
      duration,
    });
    return this;
  }

  /**
   * 添加回调
   * @param {Function} callback
   * @returns {Tween} this
   */
  call(callback) {
    this._actions.push({
      type: 'call',
      callback,
    });
    return this;
  }

  /**
   * 设置循环次数
   * @param {number} count - 循环次数
   * @returns {Tween} this
   */
  repeat(count) {
    this._repeatCount = count;
    return this;
  }

  /**
   * 设置无限循环
   * @returns {Tween} this
   */
  repeatForever() {
    this._repeatCount = -1;
    return this;
  }

  /**
   * 启动动画
   * @returns {Tween} this
   */
  start() {
    this._started = true;
    this._currentIndex = 0;
    this._elapsed = 0;
    this._startProps = null;
    this._repeatDone = 0;
    _activeTweens.push(this);
    return this;
  }

  /**
   * 停止动画
   * @returns {Tween} this
   */
  stop() {
    const idx = _activeTweens.indexOf(this);
    if (idx !== -1) {
      _activeTweens.splice(idx, 1);
    }
    this._started = false;
    return this;
  }

  // ==================== 内部更新 ====================

  /**
   * 每帧更新
   * @param {number} dt - 帧间隔毫秒数
   * @returns {boolean} 是否已完成
   * @private
   */
  _update(dt) {
    if (!this._started) return true;
    if (this._currentIndex >= this._actions.length) {
      return this._handleRepeat();
    }

    const action = this._actions[this._currentIndex];

    switch (action.type) {
      case 'to':
        return this._updateTo(action, dt);
      case 'delay':
        return this._updateDelay(action, dt);
      case 'call':
        return this._updateCall(action);
      case 'parallel':
        return this._updateParallel(action, dt);
      case 'sequence':
        return this._updateSequence(action, dt);
      default:
        // 未知类型，跳过
        this._advance();
        return false;
    }
  }

  /**
   * 处理属性动画更新
   * @private
   */
  _updateTo(action, dt) {
    // 首次进入，快照起始值
    if (!this._startProps) {
      this._startProps = {};
      for (const key in action.props) {
        this._startProps[key] = this._target[key] || 0;
      }
      this._elapsed = 0;
    }

    this._elapsed += dt;
    const progress = Math.min(this._elapsed / action.duration, 1);
    const easingFn = Easing[action.easing] || Easing.linear;
    const easedProgress = easingFn(progress);

    // 插值更新属性
    for (const key in action.props) {
      const start = this._startProps[key];
      const end = action.props[key];
      this._target[key] = start + (end - start) * easedProgress;
    }

    if (progress >= 1) {
      this._advance();
    }

    return false;
  }

  /**
   * 处理延迟更新
   * @private
   */
  _updateDelay(action, dt) {
    this._elapsed += dt;
    if (this._elapsed >= action.duration) {
      this._advance();
    }
    return false;
  }

  /**
   * 处理回调
   * @private
   */
  _updateCall(action) {
    action.callback();
    this._advance();
    return false;
  }

  /**
   * 处理并行动画
   * @private
   */
  _updateParallel(action, dt) {
    // 首次进入，启动所有子 Tween（不加入全局列表，手动更新）
    if (!action._started) {
      action._started = true;
      for (const tween of action.tweens) {
        tween._started = true;
        tween._currentIndex = 0;
        tween._elapsed = 0;
        tween._startProps = null;
      }
    }

    let allDone = true;
    for (const tween of action.tweens) {
      if (tween._started) {
        const done = tween._update(dt);
        if (!done) {
          allDone = false;
        } else {
          tween._started = false;
        }
      }
    }

    if (allDone) {
      this._advance();
    }

    return false;
  }

  /**
   * 处理序列动画
   * @private
   */
  _updateSequence(action, dt) {
    if (action.index >= action.tweens.length) {
      this._advance();
      return false;
    }

    const current = action.tweens[action.index];
    // 首次进入该子 Tween
    if (!current._started) {
      current._started = true;
      current._currentIndex = 0;
      current._elapsed = 0;
      current._startProps = null;
    }

    const done = current._update(dt);
    if (done) {
      current._started = false;
      action.index++;
    }

    return false;
  }

  /**
   * 推进到下一个动作
   * @private
   */
  _advance() {
    this._currentIndex++;
    this._elapsed = 0;
    this._startProps = null;

    // 检查是否全部完成
    if (this._currentIndex >= this._actions.length) {
      return this._handleRepeat();
    }
    return false;
  }

  /**
   * 处理循环逻辑
   * @returns {boolean} 是否已完成
   * @private
   */
  _handleRepeat() {
    if (this._repeatCount === 0) {
      this._started = false;
      return true;
    }

    this._repeatDone++;

    // 无限循环或未达到循环次数
    if (this._repeatCount === -1 || this._repeatDone < this._repeatCount) {
      this._currentIndex = 0;
      this._elapsed = 0;
      this._startProps = null;

      // 重置 parallel/sequence 子动画状态
      for (const action of this._actions) {
        if (action.type === 'parallel') {
          action._started = false;
        } else if (action.type === 'sequence') {
          action.index = 0;
        }
      }

      return false;
    }

    this._started = false;
    return true;
  }
}
