/**
 * 「未知信号源」微信小游戏入口
 * 初始化 Canvas、引擎主循环、加载首场景
 */

import { Engine } from './js/engine/Engine.js';
import { installPolyfills } from './js/engine/canvasPolyfill.js';
import OpeningPage from './js/pages/OpeningPage.js';

// 创建主 Canvas
const canvas = wx.createCanvas();

// 安装 Canvas API 兼容补丁（roundRect、ellipse 等）
installPolyfills(canvas);
const ctx = canvas.getContext('2d');

// 获取屏幕信息
const { windowWidth, windowHeight, pixelRatio } = wx.getWindowInfo();

// 设置 Canvas 物理尺寸（高清适配）
canvas.width = windowWidth * pixelRatio;
canvas.height = windowHeight * pixelRatio;

// 初始化引擎
const engine = new Engine(canvas, ctx, {
  width: windowWidth,
  height: windowHeight,
  pixelRatio,
});

// 加载开场页面
engine.pushScene(new OpeningPage());

// 启动主循环
engine.start();
