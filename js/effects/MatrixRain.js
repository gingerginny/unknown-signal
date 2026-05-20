/**
 * MatrixRain.js
 * 矩阵代码雨效果（用于 ghost-chat 页面背景）
 * - 多列字符从上往下掉落
 * - 字符来源：Unicode 符号、数字、异世界文字
 * - 每列有不同的速度和延迟
 * - 字符有拖尾效果（透明度逐渐降低）
 * - 绿色主调 rgba(0, 255, 65, ...)
 */

import { FONT_MONO } from '../style/StyleConfig.js';

// 字符来源池：数字 + 异世界符文 + 特殊符号
const CHAR_POOL = '0123456789ᚠᚢᚦᚨᚱᚲᛃᛇᛈᛉᛊᛏᛒᛗᛚᛝᛞᛟ⌬⌭⏣⏢⎔⎕⊡⊠⊞⊟◈◇◆▣▧△▽⬡⬢⬣ꕥꕤ';

export default class MatrixRain {
  /**
   * @param {Object} options
   * @param {number} options.width - 画布宽度
   * @param {number} options.height - 画布高度
   * @param {number} [options.fontSize=14] - 字符大小
   * @param {string} [options.color='rgba(0, 255, 65, 1)'] - 主色调
   * @param {number} [options.trailLength=20] - 拖尾长度（字符数）
   * @param {number} [options.density=1.0] - 列密度（0-1，1 = 满屏列数）
   */
  constructor(options = {}) {
    this.width = options.width || 300;
    this.height = options.height || 600;
    this.fontSize = options.fontSize ?? 14;
    this.color = options.color || 'rgba(0, 255, 65, 1)';
    this.trailLength = options.trailLength ?? 20;
    this.density = options.density ?? 1.0;

    /** @type {Array<Object>} 所有列的状态 */
    this._columns = [];

    this._initColumns();
  }

  /** 初始化所有列 */
  _initColumns() {
    const columnCount = Math.floor((this.width / this.fontSize) * this.density);
    this._columns = [];

    for (let i = 0; i < columnCount; i++) {
      this._columns.push(this._createColumn(i, true));
    }
  }

  /**
   * 创建一个列
   * @param {number} index - 列索引
   * @param {boolean} randomStart - 是否随机初始位置
   */
  _createColumn(index, randomStart = false) {
    const x = index * (this.fontSize + 2);
    const speed = 0.5 + Math.random() * 2; // 不同速度
    const y = randomStart ? -Math.random() * this.height * 2 : -this.trailLength * this.fontSize;

    // 预生成拖尾字符序列
    const chars = [];
    for (let j = 0; j < this.trailLength; j++) {
      chars.push(this._randomChar());
    }

    return {
      x,
      y,
      speed,
      chars,
      charChangeTimer: 0,    // 字符变化计时器
      charChangeInterval: 100 + Math.random() * 200, // 字符变化间隔（ms）
    };
  }

  /** 随机获取一个字符 */
  _randomChar() {
    return CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)];
  }

  /**
   * 更新所有列的位置
   * @param {number} dt - 帧间隔时间（ms）
   */
  update(dt) {
    for (let i = 0; i < this._columns.length; i++) {
      const col = this._columns[i];

      // 向下移动
      col.y += col.speed * (dt / 16.67);

      // 随机更新字符（产生闪烁感）
      col.charChangeTimer += dt;
      if (col.charChangeTimer >= col.charChangeInterval) {
        col.charChangeTimer = 0;
        // 随机替换 1-2 个字符
        const idx = Math.floor(Math.random() * col.chars.length);
        col.chars[idx] = this._randomChar();
      }

      // 列完全超出屏幕后重置
      const totalHeight = col.y - this.trailLength * this.fontSize;
      if (totalHeight > this.height) {
        this._columns[i] = this._createColumn(i, false);
      }
    }
  }

  /**
   * 在 Canvas 上绘制代码雨
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
   */
  render(ctx) {
    ctx.save();
    ctx.font = `${this.fontSize}px ${FONT_MONO}`;
    ctx.textAlign = 'center';

    for (const col of this._columns) {
      for (let j = 0; j < col.chars.length; j++) {
        const charY = col.y - j * this.fontSize;

        // 超出屏幕的字符不绘制
        if (charY < -this.fontSize || charY > this.height + this.fontSize) continue;

        // 拖尾透明度：头部最亮，尾部最暗
        const progress = j / col.chars.length;
        let alpha;
        if (j === 0) {
          // 最前面的字符（最亮）— 白色高光
          alpha = 1.0;
          ctx.fillStyle = `rgba(180, 255, 180, ${alpha})`;
        } else {
          alpha = Math.max(0.03, 1.0 - progress * 1.2);
          // 提取主色调 RGB 值用于设置透明度
          ctx.fillStyle = `rgba(0, 255, 65, ${alpha})`;
        }

        ctx.fillText(col.chars[j], col.x + this.fontSize / 2, charY);
      }
    }

    ctx.restore();
  }

  /**
   * 更新画布尺寸并重新初始化列
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this._initColumns();
  }
}
