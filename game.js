/**
 * 「未知信号源」H5 入口
 * 支持 ?entry=XXXX 跳转测试入口
 */

import { Engine } from './js/engine/Engine.js';
import { installPolyfills } from './js/engine/canvasPolyfill.js';
import GameState from './js/core/GameState.js';
import OpeningPage from './js/pages/OpeningPage.js';
import MainPage from './js/pages/MainPage.js';
import { EndingPage } from './js/pages/EndingPage.js';
import { EvidencePage } from './js/pages/EvidencePage.js';
import { ChatPage } from './js/pages/ChatPage.js';

// ===== Canvas 初始化 =====
const { windowWidth, windowHeight, pixelRatio } = wx.getWindowInfo();

const canvas = document.createElement('canvas');
canvas.width = windowWidth * pixelRatio;
canvas.height = windowHeight * pixelRatio;
canvas.style.width = windowWidth + 'px';
canvas.style.height = windowHeight + 'px';

document.getElementById('game-container').appendChild(canvas);
window._gameCanvas = canvas;

installPolyfills(canvas);
const ctx = canvas.getContext('2d');

const engine = new Engine(canvas, ctx, { width: windowWidth, height: windowHeight, pixelRatio });
engine.start();

// 监听可见区域变化（地址栏收起/弹出），动态更新 canvas 高度
// 只在高度增大时更新（地址栏收起），键盘弹出导致高度骤减时跳过，避免页面被压缩
const _initCanvasH = windowHeight;
const _updateCanvasHeight = () => {
  const vvp = window.visualViewport;
  const newH = vvp ? vvp.height : window.innerHeight;
  const newW = Math.min(vvp ? vvp.width : window.innerWidth, 430);
  canvas.style.width = newW + 'px';
  // 高度减少超过 25% 认为是键盘弹出，不压缩 canvas
  if (newH >= _initCanvasH * 0.75) {
    canvas.style.height = newH + 'px';
  }
};

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', _updateCanvasHeight);
} else {
  window.addEventListener('resize', _updateCanvasHeight);
}

// ===== 测试入口路由 =====
const entry = new URLSearchParams(location.search).get('entry');

if (entry) {
  _loadTestEntry(entry);
} else {
  engine.pushScene(new OpeningPage());
}

function _loadTestEntry(entry) {
  const ALL_MODULES = ['chat', 'records', 'evidence', 'social', 'files', 'encrypted_chat', 'encrypted_zone'];

  // 各章节解锁的模块（累积）
  const MODULE_BY_CHAPTER = {
    0: ['chat'],
    1: ['chat', 'records', 'evidence'],
    2: ['chat', 'records', 'evidence', 'social'],
    3: ['chat', 'records', 'evidence', 'social', 'files'],
    4: ['chat', 'records', 'evidence', 'social', 'files', 'encrypted_chat'],
    5: ALL_MODULES,
  };

  // 各章节收集的核心关键词（用于触发器满足）
  const EVIDENCE_BY_CHAPTER = {
    0: [],
    1: ['spirit_elevator','fasi','ghost','communicator','weapon','parallel_universe',
        'spacetime_bureau','weizi','timeline','xinghe','alias_profile'],
    2: ['spirit_elevator','fasi','ghost','communicator','weapon','parallel_universe',
        'spacetime_bureau','weizi','timeline','xinghe','alias_profile',
        'spacetime_disturbance','universe_coordinate','cross_dim_comm',
        'fasi_archive_dept','self_defense','tree_monitor_bureau'],
    3: ['spirit_elevator','fasi','ghost','communicator','weapon','parallel_universe',
        'spacetime_bureau','weizi','timeline','xinghe','alias_profile',
        'spacetime_disturbance','universe_coordinate','cross_dim_comm',
        'fasi_archive_dept','self_defense','tree_monitor_bureau',
        'qiqi','dual_moon','lingbo','weizi_cluster'],
    4: [], // 与ch3相同，后续可补充
    5: [],
  };
  EVIDENCE_BY_CHAPTER[4] = EVIDENCE_BY_CHAPTER[3];
  EVIDENCE_BY_CHAPTER[5] = EVIDENCE_BY_CHAPTER[3];

  function setupChapter(ch) {
    GameState.reset();
    GameState.init();
    const s = GameState.get();
    s.chapter = ch;
    s.isOpeningDone = true;
    s.unlockedModules = MODULE_BY_CHAPTER[ch] || ['chat'];
    s.collectedEvidence = EVIDENCE_BY_CHAPTER[ch] || [];
    s.chatProgress = ch;
    GameState.update(s);
  }

  switch (entry) {
    case 'ch0':
      GameState.reset();
      GameState.init();
      engine.pushScene(new OpeningPage());
      break;

    case 'ch1':
    case 'ch2':
    case 'ch3':
    case 'ch4':
    case 'ch5': {
      const ch = parseInt(entry.replace('ch', ''));
      setupChapter(ch);
      engine.pushScene(new MainPage());
      break;
    }

    case 'chat': {
      // 直达星河消息页（测试发送失败提示）
      setupChapter(1);
      engine.pushScene(new ChatPage());
      break;
    }

    case 'ending':
      GameState.reset();
      GameState.init();
      GameState.update({ ...GameState.get(), chapter: 5, isOpeningDone: true });
      engine.pushScene(new EndingPage());
      break;

    case 'credits': {
      GameState.reset();
      GameState.init();
      GameState.update({ ...GameState.get(), chapter: 5, isOpeningDone: true, choices: { endingComplete: true, directToCredits: true } });
      engine.pushScene(new EndingPage());
      break;
    }

    case 'reasoning': {
      // 是因是果测试：ch3 + 推理 Tab + 前置推理结果已满足
      setupChapter(3);
      const s = GameState.get();
      // 已完成前三组推理，可以解锁「是因是果」
      s.reasoningResults = ['locked_room_cause', 'impossible_leap', 'leap_framework'];
      // 确保 cross_dim_comm 已收集（是因是果需要）
      if (!s.collectedEvidence.includes('cross_dim_comm')) {
        s.collectedEvidence.push('cross_dim_comm');
      }
      // 确保 x_structure 已收集（leap_framework 需要）
      if (!s.collectedEvidence.includes('x_structure')) {
        s.collectedEvidence.push('x_structure');
      }
      GameState.update(s);
      const ep = new EvidencePage();
      ep._startOnReasoningTab = true;
      engine.pushScene(ep);
      break;
    }

    default:
      engine.pushScene(new OpeningPage());
  }
}
