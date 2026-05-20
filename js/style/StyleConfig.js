/**
 * StyleConfig.js
 * 从 app.wxss CSS 变量转换而来的 JS 常量
 * 用于 Canvas 绘制时的统一样式配置
 */

// ====== 符文色彩 ======
export const RUNE_CYAN = '#00f5d4';
export const RUNE_PURPLE = '#9b5de5';
export const RUNE_BLUE = '#3a86ff';
export const RUNE_MAGENTA = '#ff2de0';
export const RUNE_AMBER = '#f5a623';
export const RUNE_GREEN = '#00e676';
export const RUNE_RED = '#ff4757';

// ====== 背景色 ======
export const BG_DARK = '#0a0e27';
export const BG_CARD = 'rgba(255, 255, 255, 0.05)';

// ====== 文字色 ======
export const TEXT_PRIMARY = '#e0e6ed';
export const TEXT_SECONDARY = '#7f8c9b';
export const TEXT_DIM = '#4a5568';

// ====== 边框 / 发光 ======
export const BORDER_GLOW = 'rgba(0, 245, 212, 0.3)';

// ====== 发光色（带透明度变体，用于多层阴影） ======
export const GLOW_CYAN_80 = 'rgba(0, 245, 212, 0.8)';
export const GLOW_CYAN_40 = 'rgba(0, 245, 212, 0.4)';
export const GLOW_CYAN_20 = 'rgba(0, 245, 212, 0.2)';
export const GLOW_PURPLE_80 = 'rgba(155, 93, 229, 0.8)';
export const GLOW_PURPLE_40 = 'rgba(155, 93, 229, 0.4)';
export const GLOW_PURPLE_20 = 'rgba(155, 93, 229, 0.2)';
export const GLOW_BLUE_80 = 'rgba(58, 134, 255, 0.8)';
export const GLOW_BLUE_40 = 'rgba(58, 134, 255, 0.4)';
export const GLOW_BLUE_20 = 'rgba(58, 134, 255, 0.2)';
export const GLOW_AMBER_80 = 'rgba(245, 166, 35, 0.8)';
export const GLOW_AMBER_40 = 'rgba(245, 166, 35, 0.4)';
export const GLOW_AMBER_20 = 'rgba(245, 166, 35, 0.2)';

// ====== 字体 ======
export const FONT_PRIMARY = 'PingFang SC, Microsoft YaHei, sans-serif';
export const FONT_MONO = 'Courier New, Menlo, monospace';

// ====== 间距（单位：像素） ======
export const SPACING_XS = 4;
export const SPACING_SM = 8;
export const SPACING_MD = 12;
export const SPACING_LG = 16;
export const SPACING_XL = 24;
export const SPACING_XXL = 32;

// ====== 动画时长（单位：毫秒） ======
export const ANIM_FAST = 200;
export const ANIM_NORMAL = 400;
export const ANIM_SLOW = 800;
export const ANIM_VERY_SLOW = 1500;

// ====== 字号（单位：像素） ======
export const FONT_SIZE_XS = 10;
export const FONT_SIZE_SM = 12;
export const FONT_SIZE_MD = 14;
export const FONT_SIZE_LG = 16;
export const FONT_SIZE_XL = 20;
export const FONT_SIZE_XXL = 24;
export const FONT_SIZE_TITLE = 28;

// ====== 圆角 ======
export const RADIUS_SM = 4;
export const RADIUS_MD = 8;
export const RADIUS_LG = 12;
export const RADIUS_XL = 16;

// ====== 扫描线 / CRT 效果参数 ======
export const SCANLINE_ALPHA = 0.06;       // 扫描线透明度
export const SCANLINE_SPACING = 4;        // 扫描线间距（px）
export const CRT_VIGNETTE_ALPHA = 0.4;    // CRT 暗角最大透明度
export const SCREEN_FLICKER_MIN = 0.85;   // 屏幕闪烁最低 opacity
export const SCREEN_FLICKER_MAX = 1.0;    // 屏幕闪烁最高 opacity
