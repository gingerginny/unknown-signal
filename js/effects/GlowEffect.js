/**
 * GlowEffect.js
 * 发光渲染工具函数集
 * 通过多层阴影叠加实现发光效果（适用于 Canvas 2D）
 */

import { RUNE_CYAN } from '../style/StyleConfig.js';

/**
 * 绘制发光文字（多层阴影堆叠）
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {string} text - 文字内容
 * @param {number} x - x 坐标
 * @param {number} y - y 坐标
 * @param {string} [color='#00f5d4'] - 文字颜色
 * @param {number} [blur=10] - 基础模糊半径
 * @param {number} [layers=3] - 发光层数（越多越亮）
 */
export function drawGlowText(ctx, text, x, y, color = RUNE_CYAN, blur = 10, layers = 3) {
  ctx.save();
  ctx.fillStyle = color;

  // 从外层到内层绘制，外层模糊大、透明度低，内层模糊小、透明度高
  for (let i = layers; i >= 1; i--) {
    const layerBlur = blur * (i / layers) * 2;
    const alpha = 0.2 + (1 - i / layers) * 0.6;
    ctx.shadowColor = _colorWithAlpha(color, alpha);
    ctx.shadowBlur = layerBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(text, x, y);
  }

  // 最终层：无模糊的清晰文字
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * 绘制发光线条
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x1 - 起点 x
 * @param {number} y1 - 起点 y
 * @param {number} x2 - 终点 x
 * @param {number} y2 - 终点 y
 * @param {string} [color='#00f5d4'] - 线条颜色
 * @param {number} [blur=8] - 模糊半径
 * @param {number} [lineWidth=1] - 线条宽度
 */
export function drawGlowLine(ctx, x1, y1, x2, y2, color = RUNE_CYAN, blur = 8, lineWidth = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // 外层发光
  ctx.shadowColor = _colorWithAlpha(color, 0.6);
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 内层亮线
  ctx.shadowColor = _colorWithAlpha(color, 0.3);
  ctx.shadowBlur = blur * 0.5;
  ctx.stroke();

  ctx.restore();
}

/**
 * 绘制发光矩形边框
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x - 左上角 x
 * @param {number} y - 左上角 y
 * @param {number} w - 宽度
 * @param {number} h - 高度
 * @param {string} [color='#00f5d4'] - 边框颜色
 * @param {number} [blur=8] - 模糊半径
 * @param {number} [lineWidth=1] - 线条宽度
 */
export function drawGlowRect(ctx, x, y, w, h, color = RUNE_CYAN, blur = 8, lineWidth = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // 外层发光
  ctx.shadowColor = _colorWithAlpha(color, 0.6);
  ctx.shadowBlur = blur;
  ctx.strokeRect(x, y, w, h);

  // 内层发光
  ctx.shadowColor = _colorWithAlpha(color, 0.3);
  ctx.shadowBlur = blur * 0.4;
  ctx.strokeRect(x, y, w, h);

  ctx.restore();
}

/**
 * 绘制发光圆形
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
 * @param {number} x - 圆心 x
 * @param {number} y - 圆心 y
 * @param {number} r - 半径
 * @param {string} [color='#00f5d4'] - 颜色
 * @param {number} [blur=8] - 模糊半径
 * @param {number} [lineWidth=1] - 线条宽度
 * @param {boolean} [fill=false] - 是否填充（默认只描边）
 */
export function drawGlowCircle(ctx, x, y, r, color = RUNE_CYAN, blur = 8, lineWidth = 1, fill = false) {
  ctx.save();
  ctx.lineWidth = lineWidth;

  // 外层发光
  ctx.shadowColor = _colorWithAlpha(color, 0.6);
  ctx.shadowBlur = blur;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);

  if (fill) {
    ctx.fillStyle = _colorWithAlpha(color, 0.15);
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.stroke();

  // 内层发光
  ctx.shadowColor = _colorWithAlpha(color, 0.3);
  ctx.shadowBlur = blur * 0.4;
  ctx.stroke();

  ctx.restore();
}

// ====== 内部工具函数 ======

/**
 * 将颜色字符串转换为带透明度的 rgba
 * 支持 #rrggbb 格式
 * @param {string} color - 十六进制颜色
 * @param {number} alpha - 透明度 0-1
 * @returns {string} rgba 字符串
 */
function _colorWithAlpha(color, alpha) {
  // 如果已经是 rgba 格式，直接替换透明度
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${alpha})`);
  }
  // 如果是 rgb 格式
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  // 十六进制颜色
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
