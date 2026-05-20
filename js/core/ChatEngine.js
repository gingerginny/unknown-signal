/**
 * ChatEngine.js
 * 纯消息引擎（从 pages/chat/chat.js 提取）
 * 事件驱动，不包含任何 UI / setData 代码
 * 外部通过监听事件来更新 UI
 */

import gameState from './GameState.js';

const CHAT_HISTORY_KEY = 'chat_messages_history';
const CHAT_QUEUE_KEY = 'chat_queue_state';

// chatProgress → 对话段名称映射（不含 ch0_followup）
const PROGRESS_SECTIONS = {
  0: 'opening',
  1: 'chapter1_intro',
  2: 'chapter2_intro',
  3: 'chapter3_intro',
  4: 'ch4_recover',
};

// ch0 点击收集词条（chapter1_intro 门控）
const CH0_CLICK_KEYWORDS = [
  'spirit_elevator', 'fasi', 'ghost', 'communicator',
  'weapon', 'parallel_universe', 'spacetime_bureau', 'weizi',
  'timeline', 'xinghe', 'alias_profile',
];

// ====== 延迟工具函数 ======

/** 打字时长：短句快打，长句慢打（500ms 底线 + 每字 50ms，上限 3s） */
export function getTypingDelay(text) {
  const len = (text || '').length;
  return Math.min(500 + len * 50, 3000);
}

/** 阅读间隔：消息出现后的停顿（400ms 底线 + 每字 30ms，上限 2s） */
export function getMsgDelay(text) {
  const len = (text || '').length;
  return Math.min(400 + len * 30, 2000);
}

/**
 * ChatEngine - 事件驱动的消息引擎
 *
 * 事件列表：
 * - 'message'       : (msg) => {}              新消息推送
 * - 'typing'        : (isTyping) => {}          打字状态变化
 * - 'scrollToBottom' : () => {}                 请求滚动到底部
 * - 'sendFailed'    : (show) => {}              发送失败提示
 * - 'collectToast'  : (show) => {}              证据收集提示
 * - 'historyLoaded' : (messages) => {}          历史消息加载完毕
 * - 'sectionComplete': (sectionName) => {}      对话段播放完毕
 */
export default class ChatEngine {
  constructor(dialogueData) {
    /** @type {Object} xingheDialogue 对话数据 */
    this._dialogueData = dialogueData;

    /** @type {Array} 消息列表 */
    this._messages = [];

    /** @type {Array} 当前对话队列 */
    this._dialogueQueue = [];

    /** @type {boolean} 是否正在处理队列 */
    this._isProcessing = false;

    /** @type {string|null} 当前段落名称 */
    this._currentSection = null;

    /** @type {Array<number>} 定时器 ID 列表 */
    this._timers = [];

    /** @type {boolean} 是否在等待玩家发送 */
    this._waitingForSend = false;

    /** @type {number|null} waitSend 超时定时器 */
    this._waitSendTimer = null;

    /** @type {Object|null} 正在处理的节点 */
    this._currentNode = null;

    /** @type {number} 延迟消息到期时间戳 */
    this._delayFireAt = 0;

    /** @type {Object<string, Function[]>} 事件监听器 */
    this._listeners = {};
  }

  // ====== 事件系统 ======

  /** 注册事件监听 */
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  /** 移除事件监听 */
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  /** 触发事件 */
  emit(event, ...args) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => cb(...args));
  }

  // ====== 生命周期 ======

  /** 初始化引擎（相当于原 onLoad） */
  init() {
    gameState.init();
    const history = this._loadHistory();
    const state = gameState.get();

    if (history && history.length > 0) {
      this._messages = history;
      this.emit('historyLoaded', this._messages);
      this._resumeFromProgress(state);
    } else {
      const chapter = state.chapter || 0;
      if (chapter > 0) {
        // 跳章场景：先瞬时填充前置章节对话
        this._backfillSections(0, chapter);
        this._backfillSection('ch0_followup');
        this._setLastPlayedProgress(chapter);
        const currentSection = PROGRESS_SECTIONS[chapter];
        if (currentSection) {
          this.startDialogue(currentSection);
        }
      } else {
        this.startDialogue('opening');
      }
    }

    this.emit('scrollToBottom');
  }

  /** 销毁引擎（清除所有定时器） */
  destroy() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    if (this._waitSendTimer) {
      clearTimeout(this._waitSendTimer);
      this._waitSendTimer = null;
    }
    this._listeners = {};
  }

  // ====== 公共方法 ======

  /** 获取当前消息列表 */
  getMessages() {
    return this._messages;
  }

  /** 玩家尝试发送消息 */
  handleSend(inputText) {
    if (!inputText || !inputText.trim()) return;

    // waitSend 阶段：玩家首次发送 → 注入 after_send_fail 并继续队列
    if (this._waitingForSend) {
      this._waitingForSend = false;
      if (this._waitSendTimer) {
        clearTimeout(this._waitSendTimer);
        this._waitSendTimer = null;
      }
      const failSection = this._dialogueData['after_send_fail'] || [];
      this._dialogueQueue = failSection.concat(this._dialogueQueue);
      this._saveQueueState();
      this.emit('sendFailed', true);
      const hideTimer = setTimeout(() => {
        this.emit('sendFailed', false);
        this._processQueue();
      }, 2000);
      this._timers.push(hideTimer);
      return;
    }

    this.emit('sendFailed', true);
    const hideTimer = setTimeout(() => {
      this.emit('sendFailed', false);
    }, 2000);
    this._timers.push(hideTimer);
  }

  /** 收集关键词证据 */
  collectKeyword(msgIdx, segIdx, evidenceId) {
    const msg = this._messages[msgIdx];
    if (!msg || !msg.segments) return;
    if (!msg.segments[segIdx]) return;
    if (msg.segments[segIdx].collected) return;

    gameState.collectEvidence(evidenceId);

    // 标记所有消息中相同 evidenceId 的关键词为已收集
    this._messages.forEach((m) => {
      if (!m.segments) return;
      m.segments.forEach((seg) => {
        if (seg.type === 'keyword' && seg.evidenceId === evidenceId && !seg.collected) {
          seg.collected = true;
        }
      });
    });

    this.emit('collectToast', true);
    this._saveHistory();

    const timer = setTimeout(() => {
      this.emit('collectToast', false);
    }, 1500);
    this._timers.push(timer);
  }

  // ====== 关键词段落解析（100% 复用） ======

  /**
   * 将带关键词的文本切分为 text/keyword 段落数组
   * @param {string} text - 原始文本
   * @param {Array<{word: string, evidenceId: string}>} keywords - 关键词列表
   * @returns {Array<{type: string, content: string, evidenceId?: string, collected?: boolean}>}
   */
  parseSegments(text, keywords) {
    if (!keywords || keywords.length === 0) {
      return [{ type: 'text', content: text }];
    }

    const collectedIds = gameState.get().collectedEvidence || [];
    const positions = [];
    keywords.forEach(kw => {
      let idx = 0;
      while (true) {
        const found = text.indexOf(kw.word, idx);
        if (found === -1) break;
        positions.push({
          start: found,
          end: found + kw.word.length,
          word: kw.word,
          evidenceId: kw.evidenceId,
        });
        idx = found + kw.word.length;
      }
    });

    positions.sort((a, b) => a.start - b.start);
    const segments = [];
    let pos = 0;
    positions.forEach(p => {
      if (p.start > pos) {
        segments.push({ type: 'text', content: text.slice(pos, p.start) });
      }
      segments.push({
        type: 'keyword',
        content: p.word,
        evidenceId: p.evidenceId,
        collected: collectedIds.includes(p.evidenceId),
      });
      pos = p.end;
    });
    if (pos < text.length) {
      segments.push({ type: 'text', content: text.slice(pos) });
    }
    return segments.length > 0 ? segments : [{ type: 'text', content: text }];
  }

  // ====== 历史记录管理 ======

  _loadHistory() {
    try {
      const raw = wx.getStorageSync(CHAT_HISTORY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _saveHistory() {
    try {
      wx.setStorageSync(CHAT_HISTORY_KEY, JSON.stringify(this._messages));
    } catch (e) {
      // 存储失败静默忽略
    }
  }

  // ====== 队列状态持久化 ======

  _saveQueueState() {
    try {
      wx.setStorageSync(CHAT_QUEUE_KEY, JSON.stringify({
        section: this._currentSection,
        queue: this._dialogueQueue,
        currentNode: this._currentNode || null,
        delayFireAt: this._delayFireAt || 0,
      }));
    } catch (e) {
      // 静默忽略
    }
  }

  _loadQueueState() {
    try {
      const raw = wx.getStorageSync(CHAT_QUEUE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _clearQueueState() {
    try {
      wx.removeStorageSync(CHAT_QUEUE_KEY);
    } catch (e) {
      // 静默忽略
    }
  }

  // ====== 对话进度管理 ======

  _getLastPlayedProgress() {
    try {
      const val = wx.getStorageSync('chat_last_played');
      return typeof val === 'number' ? val : -1;
    } catch (e) {
      return -1;
    }
  }

  _setLastPlayedProgress(progress) {
    try {
      wx.setStorageSync('chat_last_played', progress);
    } catch (e) {
      // 静默忽略
    }
  }

  _isCh0FollowupPlayed() {
    try {
      return !!wx.getStorageSync('ch0_followup_played');
    } catch (e) {
      return false;
    }
  }

  _markCh0FollowupPlayed() {
    try {
      wx.setStorageSync('ch0_followup_played', true);
    } catch (e) {
      // 静默忽略
    }
  }

  // ====== 对话进度恢复 ======

  _resumeFromProgress(state) {
    // 优先恢复未完成的队列
    const saved = this._loadQueueState();
    if (saved) {
      this._currentSection = saved.section;
      const restoredQueue = [];
      if (saved.currentNode) {
        const node = saved.currentNode;
        if (saved.delayFireAt && node.delay) {
          const remaining = Math.max(0, saved.delayFireAt - Date.now());
          node.delay = remaining;
        }
        restoredQueue.push(node);
      }
      if (saved.queue && saved.queue.length > 0) {
        Array.prototype.push.apply(restoredQueue, saved.queue);
      }
      if (restoredQueue.length > 0) {
        this._dialogueQueue = restoredQueue;
        this._processQueue();
        return;
      }
      this._clearQueueState();
    }

    // ch0_followup 独立门控
    if (state.chapter >= 1 && !this._isCh0FollowupPlayed()) {
      if (gameState.isPageVisited('records') && gameState.isPageVisited('evidence')) {
        this._markCh0FollowupPlayed();
        this.startDialogue('ch0_followup');
        return;
      }
      return;
    }

    // chapter intros
    const targetProgress = state.chapter || 0;
    const lastPlayed = this._getLastPlayedProgress();
    if (targetProgress <= lastPlayed) return;

    // chapter1_intro 门控
    if (targetProgress >= 1 && lastPlayed < 1) {
      const collected = state.collectedEvidence || [];
      const searched = state.searchedEvidence || [];
      const allDone = CH0_CLICK_KEYWORDS.every(id => collected.includes(id))
                   && CH0_CLICK_KEYWORDS.every(id => searched.includes(id));
      if (!allDone) return;
    }

    // 跳章补齐
    const backfillFrom = lastPlayed + 1;
    if (targetProgress > backfillFrom) {
      this._backfillSections(backfillFrom, targetProgress);
    }

    this._setLastPlayedProgress(targetProgress);

    const section = PROGRESS_SECTIONS[targetProgress];
    if (section) {
      this.startDialogue(section);
    }
  }

  // ====== 瞬时填充 ======

  _backfillSection(sectionName) {
    const section = this._dialogueData[sectionName];
    if (!section) return;
    const msgs = [];
    section.forEach(node => {
      if (node.type === 'xinghe') {
        const segments = this.parseSegments(node.text, node.keywords);
        msgs.push({ type: 'xinghe', text: node.text, segments });
      } else if (node.type === 'system') {
        msgs.push({ type: 'system', text: node.text });
        if (node.action) this._performAction(node.action);
      }
    });
    if (msgs.length > 0) {
      this._messages = this._messages.concat(msgs);
      this.emit('historyLoaded', this._messages);
      this._saveHistory();
    }
  }

  _backfillSections(fromProgress, toProgress) {
    const backfillMessages = [];
    for (let p = fromProgress; p < toProgress; p++) {
      const sectionName = PROGRESS_SECTIONS[p];
      if (!sectionName) continue;
      const section = this._dialogueData[sectionName];
      if (!section) continue;
      section.forEach(node => {
        if (node.type === 'xinghe') {
          const segments = this.parseSegments(node.text, node.keywords);
          backfillMessages.push({ type: 'xinghe', text: node.text, segments });
        } else if (node.type === 'system') {
          backfillMessages.push({ type: 'system', text: node.text });
          if (node.action) this._performAction(node.action);
        }
      });
    }
    if (backfillMessages.length > 0) {
      this._messages = this._messages.concat(backfillMessages);
      this.emit('historyLoaded', this._messages);
      this._saveHistory();
    }
  }

  // ====== 核心对话引擎 ======

  /** 开始播放指定对话段 */
  startDialogue(sectionName) {
    const section = this._dialogueData[sectionName];
    if (!section) return;

    this._currentSection = sectionName;
    this._dialogueQueue = section.slice(0);
    this._saveQueueState();
    this._processQueue();
  }

  _processQueue() {
    if (this._isProcessing) return;
    if (this._dialogueQueue.length === 0) {
      this._saveHistory();
      this._clearQueueState();
      this.emit('sectionComplete', this._currentSection);
      return;
    }

    this._isProcessing = true;
    const node = this._dialogueQueue.shift();
    this._currentNode = node;
    this._saveQueueState();

    if (node.type === 'xinghe') {
      this._displayXingheMessage(node);
    } else if (node.type === 'system') {
      this._displaySystemMessage(node);
    } else if (node.type === 'waitSend') {
      this._waitForSend(node);
    } else {
      this._isProcessing = false;
      this._processQueue();
    }
  }

  // ====== waitSend 节点 ======

  _waitForSend(node) {
    this._waitingForSend = true;
    this._isProcessing = false;
    this._currentNode = null;
    this._saveQueueState();

    if (node.timeout) {
      this._waitSendTimer = setTimeout(() => {
        if (this._waitingForSend) {
          this._waitingForSend = false;
          this._waitSendTimer = null;
          const failSection = this._dialogueData['after_send_fail'] || [];
          this._dialogueQueue = failSection.concat(this._dialogueQueue);
          this._saveQueueState();
          this._processQueue();
        }
      }, node.timeout);
      this._timers.push(this._waitSendTimer);
    }
  }

  // ====== 消息显示 ======

  _displayXingheMessage(node) {
    const preDelay = node.delay || 0;

    // 记录全局到期时间戳
    if (preDelay > 0) {
      this._delayFireAt = Date.now() + preDelay;
    } else {
      this._delayFireAt = 0;
    }
    this._saveQueueState();

    const startTyping = () => {
      this._delayFireAt = 0;
      this._saveQueueState();
      this.emit('typing', true);
      this.emit('scrollToBottom');
    };

    if (preDelay > 0) {
      const delayTimer = setTimeout(startTyping, preDelay);
      this._timers.push(delayTimer);
    } else {
      startTyping();
    }

    const typingTimer = setTimeout(() => {
      const segments = this.parseSegments(node.text, node.keywords);
      const msg = { type: 'xinghe', text: node.text, segments };
      this._messages.push(msg);

      this.emit('typing', false);
      this.emit('message', msg);
      this.emit('scrollToBottom');
      this._saveHistory();

      this._currentNode = null;
      this._delayFireAt = 0;
      this._saveQueueState();

      if (node.goto) {
        const gotoTimer = setTimeout(() => {
          this._isProcessing = false;
          this.startDialogue(node.goto);
        }, getMsgDelay(node.text));
        this._timers.push(gotoTimer);
        return;
      }

      const nextTimer = setTimeout(() => {
        this._isProcessing = false;
        this._processQueue();
      }, getMsgDelay(node.text));
      this._timers.push(nextTimer);
    }, preDelay + getTypingDelay(node.text));

    this._timers.push(typingTimer);
  }

  _displaySystemMessage(node) {
    const msg = { type: 'system', text: node.text };
    this._messages.push(msg);

    this.emit('message', msg);
    this.emit('scrollToBottom');

    if (node.action) {
      this._performAction(node.action);
    }
    this._currentNode = null;
    this._saveHistory();

    const timer = setTimeout(() => {
      this._isProcessing = false;
      this._processQueue();
    }, getMsgDelay(node.text));
    this._timers.push(timer);
  }

  // ====== Action 处理器 ======

  _performAction(action) {
    if (action === 'unlock_chapter1') {
      gameState.advanceChapter(1);
      gameState.setChatProgress(1);
    } else if (action === 'unlock_chapter1_content') {
      gameState.update({ ch1ContentUnlocked: true });
      gameState.setChatProgress(1);
    } else if (action === 'unlock_chapter2') {
      gameState.advanceChapter(2);
      gameState.setChatProgress(2);
    } else if (action === 'unlock_chapter3') {
      gameState.advanceChapter(3);
      gameState.setChatProgress(3);
    } else if (action.startsWith('collect_evidence_')) {
      const evidenceId = action.replace('collect_evidence_', '');
      gameState.collectEvidence(evidenceId);
    }
  }
}
