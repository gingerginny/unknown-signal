/**
 * GameState.js
 * 游戏状态管理（从 utils/gameState.js 迁移至小游戏版本）
 * Storage API 保持不变（wx.getStorageSync / setStorageSync 在小游戏中直接可用）
 * 改用 ES Module 导出
 */

const STORAGE_KEY = 'alien_signal_state';

// 章节→游戏内时间映射（30时辰制）
const CHAPTER_TIME_MAP = {
  0: '12:00',  // 调查开始
  1: '15:30',  // 初步线索
  2: '19:00',  // 深入调查
  3: '22:30',  // 关键发现
  4: '25:03',  // 调查陷入僵局（隐藏线索）
  5: '28:00',  // 真相揭示
};

// 章节内模块解锁（advanceChapter 时自动解锁）
// 注意：notes（加密笔记）不在此列，只能由图形密码解锁
const CHAPTER_MODULE_MAP = {
  1: ['records', 'evidence'],
  2: ['social'],
  3: ['files'],
  4: ['encrypted_chat'],
  5: ['encrypted_zone'],
};

// 章节晋级触发器：收集指定核心 evidenceId 后自动推进到对应章节
// 累积式：后续章节包含所有前置章节的点击收集词条
const CH0_KEYWORDS = [
  'spirit_elevator', 'fasi', 'ghost', 'communicator',
  'weapon', 'parallel_universe', 'spacetime_bureau', 'weizi',
  'timeline', 'xinghe', 'alias_profile',
];
const CH1_KEYWORDS = [
  'spacetime_disturbance', 'universe_coordinate', 'cross_dim_comm',
  'fasi_archive_dept', 'self_defense', 'tree_monitor_bureau',
];
const CH2_KEYWORDS = [
  'qiqi', 'dual_moon', 'lingbo', 'weizi_cluster',
];
const CHAPTER_TRIGGERS = {
  2: CH0_KEYWORDS.concat(CH1_KEYWORDS),
  3: CH0_KEYWORDS.concat(CH1_KEYWORDS, CH2_KEYWORDS),
};

const DEFAULT_STATE = {
  chapter: 0,
  isOpeningDone: false,
  chatProgress: 0,
  unlockedModules: ['chat'],
  collectedEvidence: [],
  viewedConversations: [],
  viewedNotes: [],
  choices: {},
  skippedPrivate: [],
  reasoningResults: [],
  reasoningFailCount: 0,
  deathGravitySearchCount: 0,
  viewedEncryptedNotes: [],
  ch1ContentUnlocked: false,
  visitedPages: [],
  searchedEvidence: [],
  viewedEvidenceCards: [],
};

// 深拷贝 DEFAULT_STATE（避免数组/对象引用共享导致污染）
function _cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function _load() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _save(state) {
  wx.setStorageSync(STORAGE_KEY, JSON.stringify(state));
}

let _state = null;

const gameState = {
  init() {
    _state = _load() || _cloneDefault();
  },

  get() {
    if (!_state) this.init();
    return Object.assign({}, _state);
  },

  update(patch) {
    if (!_state) this.init();
    Object.assign(_state, patch);
    _save(_state);
  },

  reset() {
    _state = _cloneDefault();
    _save(_state);
    // 同时清除聊天相关存储
    const chatKeys = ['chat_messages_history', 'chat_queue_state', 'chat_last_played', 'ch0_followup_played'];
    chatKeys.forEach(key => {
      try { wx.removeStorageSync(key); } catch (e) { /* 忽略 */ }
    });
  },

  // --- 模块解锁 ---
  isModuleUnlocked(moduleId) {
    if (!_state) this.init();
    return _state.unlockedModules.includes(moduleId);
  },

  unlockModule(moduleId) {
    if (!_state) this.init();
    if (!_state.unlockedModules.includes(moduleId)) {
      _state.unlockedModules.push(moduleId);
      _save(_state);
    }
  },

  // --- 证据收集 ---
  collectEvidence(evidenceId) {
    if (!_state) this.init();
    if (!_state.collectedEvidence.includes(evidenceId)) {
      _state.collectedEvidence.push(evidenceId);
      _save(_state);
      return true;
    }
    return false;
  },

  getEvidenceCount() {
    if (!_state) this.init();
    return _state.collectedEvidence.length;
  },

  // --- 内容浏览标记 ---
  markViewed(type, id) {
    if (!_state) this.init();
    const key = `viewed${type}`;
    if (!_state[key]) _state[key] = [];
    if (!_state[key].includes(id)) {
      _state[key].push(id);
      _save(_state);
    }
  },

  isViewed(type, id) {
    if (!_state) this.init();
    const key = `viewed${type}`;
    return _state[key] ? _state[key].includes(id) : false;
  },

  // --- 章节推进 ---
  advanceChapter(chapter) {
    if (!_state) this.init();
    if (chapter > _state.chapter) {
      _state.chapter = chapter;
      const newModules = CHAPTER_MODULE_MAP[chapter] || [];
      newModules.forEach(m => {
        if (!_state.unlockedModules.includes(m)) {
          _state.unlockedModules.push(m);
        }
      });
      _save(_state);
    }
  },

  // --- 证据触发章节晋级 ---
  // 门控：触发词条必须全部收集（搜索为可选加分项，不阻塞推进）
  checkAndAdvanceChapter() {
    if (!_state) this.init();
    const nextChapter = _state.chapter + 1;

    // ch3→ch4: 由推理系统控制，暂不在此处理
    if (nextChapter === 4) return false;

    // ch4→ch5: 阅读完全部 8 条加密笔记
    if (nextChapter === 5) {
      if (this.areAllEncryptedNotesViewed(8)) {
        this.advanceChapter(5);
        return true;
      }
      return false;
    }

    const triggers = CHAPTER_TRIGGERS[nextChapter];
    if (!triggers || triggers.length === 0) return false;
    const collected = _state.collectedEvidence || [];
    const searched = _state.searchedEvidence || [];
    const allCollected = triggers.every(id => collected.includes(id));
    const allSearched = triggers.every(id => searched.includes(id));
    if (allCollected && allSearched) {
      this.advanceChapter(nextChapter);
      return true;
    }
    return false;
  },

  // --- 对话进度 ---
  getChatProgress() {
    if (!_state) this.init();
    return _state.chatProgress;
  },

  setChatProgress(progress) {
    if (!_state) this.init();
    _state.chatProgress = progress;
    _save(_state);
  },

  // --- 选择记录 ---
  setChoice(key, value) {
    if (!_state) this.init();
    _state.choices[key] = value;
    _save(_state);
  },

  // --- 死亡引力搜索计数 ---
  incrementDeathGravitySearch() {
    if (!_state) this.init();
    if (_state.deathGravitySearchCount < 3) {
      _state.deathGravitySearchCount++;
      _save(_state);
    }
    return _state.deathGravitySearchCount;
  },

  getDeathGravitySearchCount() {
    if (!_state) this.init();
    return _state.deathGravitySearchCount || 0;
  },

  // --- 推理结果 ---
  addReasoningResult(resultId) {
    if (!_state) this.init();
    if (!_state.reasoningResults) _state.reasoningResults = [];
    if (!_state.reasoningResults.includes(resultId)) {
      _state.reasoningResults.push(resultId);
      _state.reasoningFailCount = 0;
      _save(_state);
      return true;
    }
    return false;
  },

  incrementReasoningFail() {
    if (!_state) this.init();
    _state.reasoningFailCount = (_state.reasoningFailCount || 0) + 1;
    _save(_state);
    return _state.reasoningFailCount;
  },

  getReasoningResults() {
    if (!_state) this.init();
    return _state.reasoningResults || [];
  },

  // --- 加密笔记阅读标记 ---
  markEncryptedNoteViewed(noteId) {
    if (!_state) this.init();
    if (!_state.viewedEncryptedNotes) _state.viewedEncryptedNotes = [];
    if (!_state.viewedEncryptedNotes.includes(noteId)) {
      _state.viewedEncryptedNotes.push(noteId);
      _save(_state);
    }
  },

  areAllEncryptedNotesViewed(totalCount) {
    if (!_state) this.init();
    return (_state.viewedEncryptedNotes || []).length >= totalCount;
  },

  // --- 页面访问标记（探索门控） ---
  markPageVisited(pageId) {
    if (!_state) this.init();
    if (!_state.visitedPages) _state.visitedPages = [];
    if (!_state.visitedPages.includes(pageId)) {
      _state.visitedPages.push(pageId);
      _save(_state);
    }
  },

  isPageVisited(pageId) {
    if (!_state) this.init();
    return (_state.visitedPages || []).includes(pageId);
  },

  // --- 搜索记录（证据板搜索门控） ---
  markEvidenceSearched(evidenceId) {
    if (!_state) this.init();
    if (!_state.searchedEvidence) _state.searchedEvidence = [];
    if (!_state.searchedEvidence.includes(evidenceId)) {
      _state.searchedEvidence.push(evidenceId);
      _save(_state);
    }
  },

  isEvidenceSearched(evidenceId) {
    if (!_state) this.init();
    return (_state.searchedEvidence || []).includes(evidenceId);
  },

  // --- 证据卡片查看标记（微光消失） ---
  markEvidenceCardViewed(evidenceId) {
    if (!_state) this.init();
    if (!_state.viewedEvidenceCards) _state.viewedEvidenceCards = [];
    if (!_state.viewedEvidenceCards.includes(evidenceId)) {
      _state.viewedEvidenceCards.push(evidenceId);
      _save(_state);
    }
  },

  isEvidenceCardViewed(evidenceId) {
    if (!_state) this.init();
    return (_state.viewedEvidenceCards || []).includes(evidenceId);
  },

  // --- 未读消息检测（供其他页面返回按钮红点使用） ---
  hasUnreadChat() {
    if (!_state) this.init();
    // ch5+ 不再推送消息
    if (_state.chapter >= 5) return false;
    // ch4：ch4_recover 未播放时显示红点
    if (_state.chapter === 4) {
      try {
        const lp = wx.getStorageSync('chat_last_played');
        return typeof lp !== 'number' || lp < 4;
      } catch (e) { return true; }
    }
    try {
      // 检查是否有延迟消息已到期
      const queueRaw = wx.getStorageSync('chat_queue_state');
      if (queueRaw) {
        const queueState = JSON.parse(queueRaw);
        if (queueState.delayFireAt && Date.now() >= queueState.delayFireAt) {
          return true;
        }
      }

      // ch0_followup 未播放
      const ch0FollowupPlayed = wx.getStorageSync('ch0_followup_played');
      if (_state.chapter >= 1 && !ch0FollowupPlayed) {
        return (_state.visitedPages || []).includes('records')
            && (_state.visitedPages || []).includes('evidence');
      }

      // chapter intros 未播放
      const lastPlayed = wx.getStorageSync('chat_last_played');
      if (lastPlayed === '' || lastPlayed === null || lastPlayed === undefined) {
        if (_state.chapter === 0) return true;
        const ch0kw = ['spirit_elevator', 'fasi', 'ghost', 'communicator', 'weapon', 'parallel_universe', 'spacetime_bureau', 'weizi', 'timeline'];
        const collected = _state.collectedEvidence || [];
        const searched = _state.searchedEvidence || [];
        return ch0kw.every(id => collected.includes(id))
            && ch0kw.every(id => searched.includes(id));
      }

      // 后续章节
      const lastPlayedN = typeof lastPlayed === 'number' ? lastPlayed : -1;
      const maxDialogueChapter = 3;
      return lastPlayedN < Math.min(_state.chapter, maxDialogueChapter);
    } catch (e) {
      return true;
    }
  },

  // --- 游戏内时间 ---
  getGameTime() {
    if (!_state) this.init();
    return CHAPTER_TIME_MAP[_state.chapter] || '12:00';
  },
};

export default gameState;
