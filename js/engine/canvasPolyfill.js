/**
 * canvasPolyfill.js - 微信小游戏 Canvas API 兼容补丁
 * 在 game.js 入口处调用 installPolyfills(canvas) 即可
 */

/**
 * 用 arcTo 手绘圆角矩形路径（不调用 beginPath / closePath）
 */
function _roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * 用 arc + scale 模拟椭圆路径
 */
function _ellipsePath(ctx, cx, cy, rx, ry, rotation, startAngle, endAngle, counterclockwise) {
  ctx.save();
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, startAngle, endAngle, !!counterclockwise);
  ctx.restore();
}

/**
 * 安装 Canvas 兼容补丁
 * @param {Canvas} canvas - wx.createCanvas() 返回的主 canvas
 */
export function installPolyfills(canvas) {
  const ctx = canvas.getContext('2d');
  const proto = Object.getPrototypeOf(ctx);

  // roundRect polyfill
  if (typeof proto.roundRect !== 'function') {
    proto.roundRect = function (x, y, w, h, radii) {
      const r = Array.isArray(radii) ? radii[0] : (radii || 0);
      _roundRectPath(this, x, y, w, h, r);
    };
  } else {
    // 即使存在，也包一层确保支持数字和数组两种传参
    const _origRoundRect = proto.roundRect;
    proto.roundRect = function (x, y, w, h, radii) {
      try {
        _origRoundRect.call(this, x, y, w, h, Array.isArray(radii) ? radii : [radii || 0]);
      } catch (_e) {
        const r = Array.isArray(radii) ? radii[0] : (radii || 0);
        _roundRectPath(this, x, y, w, h, r);
      }
    };
  }

  // ellipse polyfill
  if (typeof proto.ellipse !== 'function') {
    proto.ellipse = function (cx, cy, rx, ry, rotation, startAngle, endAngle, counterclockwise) {
      _ellipsePath(this, cx, cy, rx, ry, rotation, startAngle, endAngle, counterclockwise);
    };
  }
}
