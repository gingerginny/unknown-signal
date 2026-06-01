/**
 * EndingPage.js - 结局页面（多阶段演出）
 * 继承 Scene，完整还原 ending 页面的 5 个演出阶段
 * 阶段：ghost_farewell → xinghe_monologue → collect_prompt → collecting → reveal → card → credits
 */

import { Scene } from '../engine/Scene.js';
import { Node } from '../engine/Node.js';
import { Label } from '../engine/Label.js';
import { Graphics } from '../engine/Graphics.js';
import { ScrollView } from '../engine/ScrollView.js';
import { Button } from '../engine/Button.js';
import { Tween } from '../engine/Tween.js';
import gameState from '../core/GameState.js';
import {
  RUNE_CYAN, RUNE_PURPLE, BG_DARK,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM,
  FONT_PRIMARY, FONT_MONO,
  FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG,
  FONT_SIZE_XL, FONT_SIZE_XXL, FONT_SIZE_TITLE,
  SPACING_SM, SPACING_MD, SPACING_LG, SPACING_XL, SPACING_XXL,
} from '../style/StyleConfig.js';

import { evidenceList } from '../data/story.js';
import OpeningPage from './OpeningPage.js';

// ====== 色彩常量 ======
const ENDING_BG = '#050510';
const GHOST_GREEN = 'rgba(0, 255, 65, 0.9)';
const GHOST_GREEN_DIM = 'rgba(0, 255, 65, 0.5)';
const XINGHE_CYAN = 'rgba(0, 245, 212, 0.85)';
const XINGHE_CYAN_DIM = 'rgba(0, 245, 212, 0.4)';
const SYSTEM_PURPLE = 'rgba(200, 155, 255, 0.9)';

// ====== 打字速度 ======
const CHAR_SPEED = 35;

// ====== 气泡收集数据：8 个词条中各含一个闪烁字 ======
const COLLECT_BUBBLES = [
  { evidenceId: 'weapon', char: '我', charIndex: 26 },
  { evidenceId: 'dual_moon', char: '们', charIndex: 22 },
  { evidenceId: 'world_tree', char: '终', charIndex: 8 },
  { evidenceId: 'spacetime_disturbance', char: '会', charIndex: 18 },
  { evidenceId: 'consciousness_archive', char: '再', charIndex: 35 },
  { evidenceId: 'xinghe', char: '次', charIndex: 13 },
  { evidenceId: 'energy_anomaly', char: '相', charIndex: 44 },
  { evidenceId: 'alias_profile', char: '遇', charIndex: 18 },
];

const FINAL_SENTENCE = '我们终会再次相遇';

// ── 幽灵告别 ──
const GHOST_FAREWELL = [
  '感谢你，陌生人，你是至关重要的一环。',
  '这串信号对应的数字，是七七的祭日。3021是旧万界纪元加上新万界的年份，1106是月和日。',
  '阿里亚斯把妹妹的祭日设成了最后一道锁。',
  '因为你解密的一系列行为，不管是你切换程序，还是连接网络，我才可以快速和你们世界的微子融合。',
  '不用害怕，这不会影响到你们世界分毫。但我也理解你会对此有所顾虑，所以才这么迂回地引导你，或者说欺骗你。',
  '在星河发现之前，我要离开了。',
  '希望我们不会再相见。',
];

// ── 星河独白 ──
const XINGHE_MONOLOGUE = [
  { text: '果然是这样吗？', pause: 5000 },
  { text: '我其实还抱着不切实际的想法，以为是你的灵魂跳跃到了另一个世界。', pause: 2000 },
  { text: '想想都不太可能，我们世界的人，只要一死亡，只会融入法司大人。', pause: 2000 },
  { text: '那个幽灵，也不是什么死而复生的人。它只是一部分灵魂之和。可能是我们熟悉的，可能是陌生的，但那都无所谓，因为那些独特的记忆都消散了。', pause: 3000 },
  { text: '其实事情的真相我早就猜到了。凶手、杀人手法包括动机。', pause: 2000 },
  { text: '我再怎么说也是个调查官，怎么会把所有的推理工作都交给别人呢？', pause: 2000 },
  { text: '凶案是三天前发生的，前天我把情况通报到了时空管理局。然后昨天我冷静下来大概梳理了一下，就知道阿里亚斯想干什么了。', pause: 4000 },
  { text: '……', pause: 3000 },
  { text: 'alias', pause: 3000 },
  { text: '如果这是你想要的，那我会不遗余力地帮你实现。', pause: 2000 },
  { text: '我现在会记住你做的一切，但我也并不认为你是勇敢的，如果你能早点跟我商量，或许也会有别的办法。', pause: 2500 },
  { text: '其实，你也臣服在了法司大人的引力之下吧。', pause: 3000 },
  { text: '算了，说这些也没有用，你也看不到。', pause: 3000 },
  { text: '……不过，那边的陌生人，你应该还在吧？', pause: 2000 },
  { text: '谢谢你陪我走到这里。', pause: 2000 },
  { text: '你大概是这个世界上，除了我以外，唯一了解她的人了。', pause: 2500 },
  { text: '我被允许的通讯的时间差不多也要用完了。', pause: 2000 },
  { text: '最后，如果你有什么想说的……我还在。', pause: 2000 },
  { text: '哦对了，你没有办法向我发送信息', pause: 2000 },
  { text: '那就这样吧，再也不见，陌生人。', pause: 2000 },
  { text: '希望你永远健康幸福。', pause: 3000 },
];

export class EndingPage extends Scene {
  constructor() {
    super();

    // 屏幕尺寸
    this._screenWidth = 375;
    this._screenHeight = 667;

    // 阶段
    this._phase = 'ghost_farewell';

    // 对话
    this._messages = [];         // [{text, type, id}]
    this._msgId = 0;
    this._dialogueQueue = [];
    this._onQueueDone = null;
    this._isTyping = false;
    this._typingFullText = '';
    this._typingMsgIndex = 0;
    this._typingOnDone = null;
    this._waitingForTap = false;
    this._typeTimer = null;
    this._queueTimer = null;

    // 对话区域
    this._dialogueScrollView = null;
    this._dialogueContainer = null;
    this._dialogueContentHeight = 0;
    this._tapHintNode = null;

    // 气泡收集
    this._collectBubbles = [];
    this._collectedChars = new Array(FINAL_SENTENCE.length).fill('');
    this._collectedCount = 0;
    this._bubbleNodes = [];
    this._charSlotNodes = [];

    // 通关卡片
    this._evidencePercent = 0;

    // 制作名单
    this._creditsScrollView = null;

    // 动画计时器
    this._flashTimer = 0;
    this._statAnimTimer = 0;
    this._displayedPercent = 0;

    // 全屏点击区域节点
    this._tapAreaNode = null;
  }

  // ==================== 生命周期 ====================

  onEnter() {
    const engine = this.engine;
    this._screenWidth = engine.getWidth();
    this._screenHeight = engine.getHeight();

    this.width = this._screenWidth;
    this.height = this._screenHeight;

    // 构建背景
    this._buildBackground();

    // 检查是否已通关
    const state = gameState.get();
    if (state.choices && state.choices.directToCredits) {
      this._showCredits();
      return;
    }
    if (state.choices && state.choices.endingComplete) {
      this._showEndingCard();
      return;
    }

    // 开始幽灵告别
    this._buildDialoguePhase();
    this._playGhostFarewell();
  }

  onExit() {
    if (this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    if (this._queueTimer) {
      clearTimeout(this._queueTimer);
      this._queueTimer = null;
    }
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
  }

  // ==================== UI 构建 ====================

  _buildBackground() {
    const self = this;
    const bgNode = new Node();
    bgNode.width = this._screenWidth;
    bgNode.height = this._screenHeight;
    bgNode.zIndex = -10;
    let _bgGlow1 = null, _bgGlow2 = null;
    bgNode._draw = function(ctx) {
      const w = self._screenWidth;
      const h = self._screenHeight;

      ctx.fillStyle = ENDING_BG;
      ctx.fillRect(0, 0, w, h);

      if (!_bgGlow1) {
        _bgGlow1 = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.5);
        _bgGlow1.addColorStop(0, 'rgba(0, 245, 212, 0.02)');
        _bgGlow1.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = _bgGlow1;
      ctx.fillRect(0, 0, w, h);

      if (!_bgGlow2) {
        _bgGlow2 = ctx.createRadialGradient(w * 0.3, h * 0.8, 0, w * 0.3, h * 0.8, w * 0.4);
        _bgGlow2.addColorStop(0, 'rgba(155, 93, 229, 0.02)');
        _bgGlow2.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = _bgGlow2;
      ctx.fillRect(0, 0, w, h);
    };
    this.addChild(bgNode);
  }

  // ==================== Phase 1 & 2: 对话阶段 ====================

  _buildDialoguePhase() {
    // 全屏点击区域
    this._tapAreaNode = new Node();
    this._tapAreaNode.x = 0;
    this._tapAreaNode.y = 0;
    this._tapAreaNode.width = this._screenWidth;
    this._tapAreaNode.height = this._screenHeight;
    this._tapAreaNode.interactive = true;
    this._tapAreaNode.zIndex = 50;
    this._tapAreaNode.on('tap', () => this._tapToContinue());
    this.addChild(this._tapAreaNode);

    // 对话 ScrollView
    this._dialogueScrollView = new ScrollView({
      width: this._screenWidth - 32,
      height: this._screenHeight - 60,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });
    this._dialogueScrollView.x = 16;
    this._dialogueScrollView.y = 60;
    this._dialogueScrollView.zIndex = 10;
    this._dialogueScrollView.interactive = true;

    this._dialogueScrollView.on('touchstart', (e) => {
      this._dialogueScrollView.onTouchStart(e.y - this._dialogueScrollView.y);
      e.stopPropagation();
    });
    this._dialogueScrollView.on('touchmove', (e) => {
      if (!this._dialogueScrollView) return;
      this._dialogueScrollView.onTouchMove(e.y - this._dialogueScrollView.y);
      e.stopPropagation();
    });
    this._dialogueScrollView.on('touchend', (e) => {
      if (!this._dialogueScrollView) return;
      this._dialogueScrollView.onTouchEnd();
      if (!this._dialogueScrollView.didScroll()) {
        this._tapToContinue();
      }
    });

    this.addChild(this._dialogueScrollView);

    // 内容容器
    this._dialogueContainer = new Node();
    this._dialogueContainer.x = 0;
    this._dialogueContainer.y = 0;
    this._dialogueScrollView.addChild(this._dialogueContainer);

    this._dialogueContentHeight = 24;

    // 点击继续提示
    this._tapHintNode = new Label({
      text: '点击继续',
      fontSize: 11,
      color: 'rgba(0, 245, 212, 0.3)',
      textAlign: 'center',
    });
    this._tapHintNode.width = this._screenWidth - 32;
    this._tapHintNode.visible = false;
    this._tapHintNode.zIndex = 20;
    // 位置在 update 中动态更新
    this._dialogueScrollView.addChild(this._tapHintNode);
  }

  _playGhostFarewell() {
    this._phase = 'ghost_farewell';
    this._dialogueQueue = GHOST_FAREWELL.map(text => ({ text, type: 'ghost' }));
    this._onQueueDone = () => {
      // 幽灵告别结束 → 系统消息过渡
      this._addSystemMsg('幽灵的信号消失了');
      this._queueTimer = setTimeout(() => {
        this._addSystemMsg('检测到新的通讯信号');
        this._queueTimer = setTimeout(() => {
          this._playXingheMonologue();
        }, 1500);
      }, 1500);
    };
    this._playNextInQueue();
  }

  _playXingheMonologue() {
    this._phase = 'xinghe_monologue';
    this._dialogueQueue = XINGHE_MONOLOGUE.map(item => ({ text: item.text, type: 'xinghe' }));
    this._onQueueDone = () => {
      this._queueTimer = setTimeout(() => {
        this._startCollectPhase();
      }, 1500);
    };
    this._playNextInQueue();
  }

  _tapToContinue() {
    if (this._phase !== 'ghost_farewell' && this._phase !== 'xinghe_monologue') return;

    if (this._isTyping) {
      this._skipTyping();
      return;
    }
    if (this._waitingForTap) {
      this._waitingForTap = false;
      this._tapHintNode.visible = false;
      this._playNextInQueue();
    }
  }

  _playNextInQueue() {
    if (this._dialogueQueue.length === 0) {
      if (this._onQueueDone) {
        const cb = this._onQueueDone;
        this._onQueueDone = null;
        cb();
      }
      return;
    }

    const msg = this._dialogueQueue.shift();
    this._addTypingMsg(msg.text, msg.type, () => {
      this._waitingForTap = true;
      this._tapHintNode.visible = true;
      this._tapHintNode.y = this._dialogueContentHeight + 12;
      this._scrollDialogueToBottom();
    });
  }

  _addTypingMsg(fullText, type, onDone) {
    const msgId = 'msg_' + (++this._msgId);
    const msgNode = this._createDialogueMsgNode(type, '');

    // 用完整文本重新估算高度，避免空字符串导致后续消息 y 坐标偏移过小造成重叠
    if (type === 'ghost') {
      const estLines = Math.max(1, Math.ceil(fullText.length / Math.floor((this._screenWidth - 60) / 14)));
      msgNode.height = estLines * 24;
    } else if (type === 'xinghe') {
      const estLines = Math.max(1, Math.ceil(fullText.length / Math.floor((this._screenWidth - 50) / 14)));
      msgNode.height = 22 + estLines * 24;
    }

    msgNode.y = this._dialogueContentHeight;

    this._dialogueContainer.addChild(msgNode);
    const msgIndex = this._messages.length;
    this._messages.push({ text: '', type, id: msgId, node: msgNode });
    this._dialogueContentHeight += msgNode.height + 14;
    this._dialogueScrollView.contentHeight = this._dialogueContentHeight + 100;
    if (this._dialogueContainer) this._dialogueContainer.height = this._dialogueContentHeight + 100;

    // 淡入
    msgNode.alpha = 0;
    Tween.create(msgNode).to({ alpha: 1 }, 200, 'easeOut').start();

    this._isTyping = true;
    this._typingFullText = fullText;
    this._typingMsgIndex = msgIndex;
    this._typingOnDone = onDone;

    let charIdx = 0;
    if (this._typeTimer) clearInterval(this._typeTimer);
    this._typeTimer = setInterval(() => {
      charIdx++;
      if (charIdx > fullText.length) {
        clearInterval(this._typeTimer);
        this._typeTimer = null;
        this._isTyping = false;
        this._messages[msgIndex].text = fullText;
        this._updateMsgLabel(msgNode, type, fullText);
        if (onDone) onDone();
        return;
      }
      const partialText = fullText.slice(0, charIdx);
      this._messages[msgIndex].text = partialText;
      this._updateMsgLabel(msgNode, type, partialText);
      this._scrollDialogueToBottom();
    }, CHAR_SPEED);
  }

  _skipTyping() {
    if (this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
    }
    this._isTyping = false;
    const msg = this._messages[this._typingMsgIndex];
    if (msg) {
      msg.text = this._typingFullText;
      this._updateMsgLabel(msg.node, msg.type, this._typingFullText);
    }
    if (this._typingOnDone) {
      this._typingOnDone();
    }
  }

  _addSystemMsg(text) {
    const msgId = 'msg_' + (++this._msgId);
    const msgNode = this._createDialogueMsgNode('system', text);
    msgNode.y = this._dialogueContentHeight;

    this._dialogueContainer.addChild(msgNode);
    this._messages.push({ text, type: 'system', id: msgId, node: msgNode });
    this._dialogueContentHeight += msgNode.height + 14;
    this._dialogueScrollView.contentHeight = this._dialogueContentHeight + 100;
    if (this._dialogueContainer) this._dialogueContainer.height = this._dialogueContentHeight + 100;

    // 淡入
    msgNode.alpha = 0;
    Tween.create(msgNode).to({ alpha: 1 }, 400, 'easeOut').start();

    this._scrollDialogueToBottom();
  }

  /**
   * 创建对话消息节点
   */
  _createDialogueMsgNode(type, text) {
    const node = new Node();
    node.width = this._screenWidth - 32;

    if (type === 'system') {
      const label = new Label({
        text: `[ ${text} ]`,
        fontSize: 11,
        color: SYSTEM_PURPLE,
        textAlign: 'center',
        fontFamily: FONT_MONO,
      });
      label.width = this._screenWidth - 32;
      label.y = 6;
      node.addChild(label);
      node.height = 28;
      node._label = label;
    } else if (type === 'ghost') {
      const prefix = new Label({
        text: '>',
        fontSize: 14,
        color: GHOST_GREEN_DIM,
      });
      prefix.x = 0;
      prefix.y = 0;
      node.addChild(prefix);

      const label = new Label({
        text: text,
        fontSize: 14,
        color: GHOST_GREEN,
        maxWidth: this._screenWidth - 60,
        shadowLayers: [
          { color: 'rgba(0, 255, 65, 0.25)', blur: 3 },
        ],
      });
      label.x = 16;
      label.y = 0;
      node.addChild(label);
      node._label = label;

      const estLines = Math.max(1, Math.ceil(text.length / Math.floor((this._screenWidth - 60) / 14)));
      node.height = estLines * 24;
    } else if (type === 'xinghe') {
      const prefix = new Label({
        text: '星河',
        fontSize: 11,
        color: XINGHE_CYAN_DIM,
      });
      prefix.x = 0;
      prefix.y = 0;
      node.addChild(prefix);

      const label = new Label({
        text: text,
        fontSize: 14,
        color: XINGHE_CYAN,
        maxWidth: this._screenWidth - 50,
        shadowLayers: [
          { color: 'rgba(0, 245, 212, 0.15)', blur: 3 },
        ],
      });
      label.x = 0;
      label.y = 18;
      node.addChild(label);
      node._label = label;

      const estLines = Math.max(1, Math.ceil(text.length / Math.floor((this._screenWidth - 50) / 14)));
      node.height = 22 + estLines * 24;
    }

    return node;
  }

  /**
   * 更新消息标签文字
   */
  _updateMsgLabel(node, type, text) {
    if (node._label) {
      if (type === 'system') {
        node._label.text = `[ ${text} ]`;
      } else {
        node._label.text = text;
      }
    }
  }

  _scrollDialogueToBottom() {
    if (this._dialogueScrollView) {
      if (this._scrollTimer) clearTimeout(this._scrollTimer);
      this._scrollTimer = setTimeout(() => {
        this._scrollTimer = null;
        this._dialogueScrollView.scrollToBottom(true);
      }, 50);
    }
  }

  // ==================== Phase 3: 气泡收集 ====================

  _startCollectPhase() {
    // 清理对话 UI
    this._clearDialoguePhase();

    // 构建收集气泡数据
    this._collectBubbles = COLLECT_BUBBLES.map(b => {
      const ev = evidenceList[b.evidenceId];
      const slotIndex = FINAL_SENTENCE.indexOf(b.char);
      return {
        id: b.evidenceId,
        name: ev ? ev.name : b.evidenceId,
        desc: ev ? ev.desc : '',
        char: b.char,
        charIndex: b.charIndex,
        slotIndex,
        collected: false,
      };
    });

    this._collectedChars = new Array(FINAL_SENTENCE.length).fill('');
    this._collectedCount = 0;

    // 先显示收集提示
    this._showCollectPrompt();
  }

  _showCollectPrompt() {
    this._phase = 'collect_prompt';
    const selfRef = this;

    // 背景暗化覆盖层 — 模拟维度裂缝
    const dimOverlay = new Node();
    dimOverlay.x = 0;
    dimOverlay.y = 0;
    dimOverlay.width = this._screenWidth;
    dimOverlay.height = this._screenHeight;
    dimOverlay.alpha = 0;
    dimOverlay.zIndex = 5;
    dimOverlay._draw = function(ctx) {
      ctx.fillStyle = 'rgba(2, 5, 25, 0.82)';
      ctx.fillRect(0, 0, selfRef._screenWidth, selfRef._screenHeight);

      // 维度裂缝横线
      const cx = selfRef._screenWidth / 2;
      const cy = selfRef._screenHeight / 2;
      for (let i = -2; i <= 2; i++) {
        const ry = cy + i * 14;
        const alpha = Math.max(0, 0.18 - Math.abs(i) * 0.05);
        const grad = ctx.createLinearGradient(0, 0, selfRef._screenWidth, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.25, `rgba(0, 245, 212, ${alpha})`);
        grad.addColorStop(0.5, `rgba(155, 93, 229, ${alpha * 1.5})`);
        grad.addColorStop(0.75, `rgba(0, 245, 212, ${alpha})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, ry, selfRef._screenWidth, 1.5);
      }
    };
    this.addChild(dimOverlay);

    // 逐字显灵：每个字从虚空中单独浮现，模拟阿里亚斯的低语
    const fontSize = 22;
    const text = '把想说的话传达给星河吧';
    const charWidth = fontSize;
    const totalWidth = text.length * charWidth;
    const baseY = this._screenHeight / 2 - fontSize / 2;
    const startX = (this._screenWidth - totalWidth) / 2;
    const STAGGER = 110;
    const FADE_IN = 350;
    const DRIFT = 7;

    const charLabels = [];
    for (let i = 0; i < text.length; i++) {
      const cl = new Label({
        text: text[i],
        fontSize,
        color: RUNE_CYAN,
        textAlign: 'left',
        shadowLayers: [
          { color: 'rgba(0, 245, 212, 0.9)', blur: 12 },
          { color: 'rgba(0, 245, 212, 0.5)', blur: 28 },
          { color: 'rgba(155, 93, 229, 0.4)', blur: 48 },
        ],
      });
      cl.width = charWidth;
      cl.x = startX + i * charWidth;
      cl.y = baseY + DRIFT;
      cl.alpha = 0;
      cl.zIndex = 10;
      this.addChild(cl);
      charLabels.push(cl);

      Tween.create(cl)
        .delay(150 + i * STAGGER)
        .to({ alpha: 1, y: baseY }, FADE_IN, 'easeOut')
        .start();
    }

    // 背景渐暗
    Tween.create(dimOverlay)
      .to({ alpha: 1 }, 500, 'easeIn')
      .start();

    // 最后一字在 150 + 10*110 + 350 = 1600ms 完全显现，停留后整体淡出
    const allAppearAt = 150 + (text.length - 1) * STAGGER + FADE_IN;
    const trigger = new Node();
    this.addChild(trigger);
    Tween.create(trigger)
      .delay(allAppearAt + 600)
      .call(() => {
        for (const cl of charLabels) {
          Tween.create(cl).to({ alpha: 0 }, 400, 'easeIn').start();
        }
        Tween.create(dimOverlay)
          .delay(50)
          .to({ alpha: 0 }, 400, 'easeOut')
          .call(() => {
            for (const cl of charLabels) cl.removeFromParent();
            dimOverlay.removeFromParent();
            trigger.removeFromParent();
            selfRef._showCollectingPhase();
          })
          .start();
      })
      .start();
  }

  _showCollectingPhase() {
    this._phase = 'collecting';
    const self = this;

    // 顶部槽位
    const slotStartX = (this._screenWidth - FINAL_SENTENCE.length * 36) / 2;
    this._charSlotNodes = [];

    for (let i = 0; i < FINAL_SENTENCE.length; i++) {
      const slotNode = new Node();
      slotNode.x = slotStartX + i * 36;
      slotNode.y = 40;
      slotNode.width = 32;
      slotNode.height = 32;
      slotNode.zIndex = 20;

      slotNode._slotIndex = i;
      slotNode._filled = false;
      slotNode._char = '';

      slotNode._draw = function(ctx) {
        const w = 32;
        const h = 32;
        const r = 4;

        // 边框
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.arcTo(w, 0, w, r, r);
        ctx.lineTo(w, h - r);
        ctx.arcTo(w, h, w - r, h, r);
        ctx.lineTo(r, h);
        ctx.arcTo(0, h, 0, h - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
        ctx.closePath();

        if (this._filled) {
          ctx.strokeStyle = RUNE_CYAN;
          ctx.fillStyle = 'rgba(0, 245, 212, 0.06)';
          ctx.shadowColor = 'rgba(0, 245, 212, 0.2)';
          ctx.shadowBlur = 6;
        } else {
          ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
          ctx.fillStyle = 'rgba(0, 245, 212, 0.02)';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        ctx.lineWidth = 0.5;
        ctx.fill();
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 填充的字符
        if (this._filled && this._char) {
          ctx.font = `${16}px ${FONT_PRIMARY}`;
          ctx.fillStyle = RUNE_CYAN;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 245, 212, 0.5)';
          ctx.shadowBlur = 4;
          ctx.fillText(this._char, w / 2, h / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      };

      this.addChild(slotNode);
      this._charSlotNodes.push(slotNode);
    }

    // 提示文字
    const hintLabel = new Label({
      text: '点击词条中闪烁的字',
      fontSize: 11,
      color: TEXT_DIM,
      textAlign: 'center',
    });
    hintLabel.width = this._screenWidth;
    hintLabel.y = 80;
    hintLabel.zIndex = 20;
    this.addChild(hintLabel);
    this._collectHintLabel = hintLabel;

    // 气泡网格（ScrollView）
    const gridY = 100;
    const gridH = this._screenHeight - gridY - 40;

    this._bubbleScrollView = new ScrollView({
      width: this._screenWidth - 32,
      height: gridH,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });
    this._bubbleScrollView.x = 16;
    this._bubbleScrollView.y = gridY;
    this._bubbleScrollView.zIndex = 10;
    this._bubbleScrollView.interactive = true;

    this._bubbleScrollView.on('touchstart', (e) => {
      this._bubbleScrollView.onTouchStart(e.y - this._bubbleScrollView.y);
      e.stopPropagation();
    });
    this._bubbleScrollView.on('touchmove', (e) => {
      this._bubbleScrollView.onTouchMove(e.y - this._bubbleScrollView.y);
      e.stopPropagation();
    });
    this._bubbleScrollView.on('touchend', (e) => {
      this._bubbleScrollView.onTouchEnd();
      if (!this._bubbleScrollView.didScroll()) {
        this._handleBubbleTap(e.x - this._bubbleScrollView.x, e.y - this._bubbleScrollView.y + this._bubbleScrollView.scrollY);
      }
    });

    this.addChild(this._bubbleScrollView);

    // 渲染气泡
    let bubbleY = 0;
    const bubbleWidth = this._screenWidth - 32;
    this._bubbleNodes = [];

    this._collectBubbles.forEach((bubble, idx) => {
      const itemH = 80;
      const bubbleNode = new Node();
      bubbleNode.x = 0;
      bubbleNode.y = bubbleY;
      bubbleNode.width = bubbleWidth;
      bubbleNode.height = itemH;
      bubbleNode._bubbleIndex = idx;

      // 预计算描述文字每个字符的 x 坐标和行号（只算一次，避免每帧 measureText）
      // 需要在 _draw 首次调用时初始化（此时有 ctx），用 _charLayout 缓存
      bubbleNode._charLayout = null; // { xs: [], ys: [], highlightX, highlightY }

      bubbleNode._draw = function(ctx) {
        const w = bubbleWidth;
        const h = itemH;
        const r = 4;
        const b = self._collectBubbles[idx];

        // 预计算字符布局（只算一次）
        if (!this._charLayout) {
          const desc = b.desc || '';
          const maxDescWidth = w - 20;
          const descY1 = 38;
          const descY2 = 54;
          const xs = [];
          const ys = [];
          ctx.font = `${11}px ${FONT_PRIMARY}`;
          let cx = 10;
          let descLine = 1;
          let lineY = descY1;
          for (let ci = 0; ci < desc.length; ci++) {
            const ch = desc[ci];
            const cw = ctx.measureText(ch).width;
            if (cx + cw > maxDescWidth) {
              if (descLine >= 2) { xs.push(-1); ys.push(-1); continue; }
              descLine++;
              lineY = descY2;
              cx = 10;
            }
            xs.push(cx);
            ys.push(lineY);
            cx += cw;
          }
          this._charLayout = { xs, ys, desc };
        }

        // 边框
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.arcTo(w, 0, w, r, r);
        ctx.lineTo(w, h - r);
        ctx.arcTo(w, h, w - r, h, r);
        ctx.lineTo(r, h);
        ctx.arcTo(0, h, 0, h - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
        ctx.closePath();

        if (b.collected) {
          ctx.strokeStyle = 'rgba(155, 93, 229, 0.08)';
          ctx.fillStyle = 'rgba(155, 93, 229, 0.01)';
          ctx.globalAlpha = 0.3;
        } else {
          const pulse = Math.sin(self._flashTimer * 0.002 + idx) * 0.5 + 0.5;
          const borderR = Math.round(155 * (1 - pulse));
          const borderG = Math.round(93 * (1 - pulse) + 245 * pulse);
          const borderB = Math.round(229 * (1 - pulse) + 212 * pulse);
          ctx.strokeStyle = `rgba(${borderR}, ${borderG}, ${borderB}, 0.2)`;
          ctx.fillStyle = 'rgba(155, 93, 229, 0.03)';
        }

        ctx.lineWidth = 0.5;
        ctx.fill();
        ctx.stroke();

        if (b.collected) ctx.globalAlpha = 0.3;

        // 名称
        ctx.font = `${12}px ${FONT_PRIMARY}`;
        ctx.fillStyle = RUNE_CYAN;
        ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
        ctx.shadowBlur = 2;
        ctx.fillText(b.name, 10, 16);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 描述（使用预计算的字符布局，无 measureText）
        ctx.font = `${11}px ${FONT_PRIMARY}`;
        const layout = this._charLayout;
        const desc = layout.desc;
        for (let ci = 0; ci < desc.length; ci++) {
          const cx = layout.xs[ci];
          const lineY = layout.ys[ci];
          if (cx < 0) break; // 超出两行则截断

          if (ci === b.charIndex && !b.collected) {
            const flash = Math.sin(self._flashTimer * 0.005 + idx * 2) * 0.5 + 0.5;
            ctx.fillStyle = RUNE_CYAN;
            ctx.font = `bold ${12}px ${FONT_PRIMARY}`;
            ctx.shadowColor = `rgba(0, 245, 212, ${0.3 + flash * 0.5})`;
            ctx.shadowBlur = (4 + flash * 8);
            ctx.fillText(desc[ci], cx, lineY);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.font = `${11}px ${FONT_PRIMARY}`;
          } else {
            ctx.fillStyle = TEXT_DIM;
            ctx.fillText(desc[ci], cx, lineY);
          }
        }

        // 已收集覆盖层
        if (b.collected) {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = 'rgba(5, 5, 16, 0.7)';
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1;

          ctx.font = `${20}px ${FONT_PRIMARY}`;
          ctx.fillStyle = RUNE_CYAN;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = 0.4;
          ctx.fillText(b.char, w / 2, h / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.globalAlpha = 1;
        }
      };

      // 让节点本身可交互，直接接收 tap 事件（避免依赖 didScroll 阈值导致误判）
      bubbleNode.interactive = true;
      bubbleNode.on('tap', () => this._tapCollectBubble(idx));

      // 入场动画
      bubbleNode.alpha = 0;
      bubbleNode.scaleX = 0.9;
      bubbleNode.scaleY = 0.9;
      Tween.create(bubbleNode)
        .delay(idx * 100)
        .to({ alpha: 1, scaleX: 1, scaleY: 1 }, 400, 'easeOut')
        .start();

      this._bubbleScrollView.addChild(bubbleNode);
      this._bubbleNodes.push(bubbleNode);

      bubbleY += itemH + 8;
    });

    this._bubbleScrollView.contentHeight = bubbleY + 40;
  }

  _handleBubbleTap(tapX, tapContentY) {
    if (this._phase !== 'collecting') return;

    for (const node of this._bubbleNodes) {
      if (tapContentY >= node.y && tapContentY <= node.y + node.height &&
          tapX >= node.x && tapX <= node.x + node.width) {
        const idx = node._bubbleIndex;
        this._tapCollectBubble(idx);
        break;
      }
    }
  }

  _tapCollectBubble(idx) {
    if (this._collectBubbles[idx].collected) return;

    const bubble = this._collectBubbles[idx];
    bubble.collected = true;
    this._collectedCount++;

    // 填充槽位
    this._collectedChars[bubble.slotIndex] = bubble.char;
    if (this._charSlotNodes[bubble.slotIndex]) {
      this._charSlotNodes[bubble.slotIndex]._filled = true;
      this._charSlotNodes[bubble.slotIndex]._char = bubble.char;

      // 槽位填充动画
      const slot = this._charSlotNodes[bubble.slotIndex];
      slot.scaleX = 1.3;
      slot.scaleY = 1.3;
      Tween.create(slot).to({ scaleX: 1, scaleY: 1 }, 300, 'easeOut').start();
    }

    // 振动反馈
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (e) { /* ignore */ }

    // 检查是否全部收集
    if (this._collectedCount >= FINAL_SENTENCE.length) {
      this._queueTimer = setTimeout(() => {
        this._showReveal();
      }, 800);
    }
  }

  // ==================== Phase 4: 最终揭示 ====================

  _showReveal() {
    this._phase = 'reveal';
    this._clearCollectingPhase();

    const revealLabel = new Label({
      text: FINAL_SENTENCE,
      fontSize: 22,
      color: RUNE_CYAN,
      textAlign: 'center',
      shadowLayers: [
        { color: 'rgba(0, 245, 212, 0.8)', blur: 10 },
        { color: 'rgba(0, 245, 212, 0.4)', blur: 20 },
        { color: 'rgba(0, 245, 212, 0.2)', blur: 40 },
      ],
    });
    revealLabel.width = this._screenWidth;
    revealLabel.y = this._screenHeight / 2 - 15;
    revealLabel.alpha = 0;
    revealLabel.scaleX = 0.95;
    revealLabel.scaleY = 0.95;
    this.addChild(revealLabel);
    this._revealLabel = revealLabel;

    Tween.create(revealLabel)
      .to({ alpha: 1, scaleX: 1, scaleY: 1 }, 2000, 'easeOut')
      .delay(1000)
      .call(() => {
        this._showEndingCard();
      })
      .start();
  }

  // ==================== Phase 5: 通关卡片 ====================

  _showEndingCard() {
    this._phase = 'card';
    this._clearAllPhaseUI();

    const state = gameState.get();
    const totalEvidence = Object.keys(evidenceList).length;
    const collected = (state.collectedEvidence || []).length;
    this._evidencePercent = Math.round((collected / totalEvidence) * 100);
    this._displayedPercent = 0;
    this._statAnimTimer = 0;

    gameState.setChoice('endingComplete', true);

    const self = this;

    // 通关卡片容器
    const cardContainer = new Node();
    cardContainer.x = 0;
    cardContainer.y = 0;
    cardContainer.width = this._screenWidth;
    cardContainer.height = this._screenHeight;
    cardContainer.zIndex = 30;
    this.addChild(cardContainer);
    this._cardContainer = cardContainer;

    // 卡片背景
    const cardW = this._screenWidth - 48 * 2;
    const cardH = 240;
    const cardX = 48;
    const cardY = (this._screenHeight - cardH) / 2 - 30;

    const cardBg = new Node();
    cardBg.x = cardX;
    cardBg.y = cardY;
    cardBg.width = cardW;
    cardBg.height = cardH;
    cardBg._draw = function(ctx) {
      const w = cardW;
      const h = cardH;
      const r = 6;

      // 背景
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.arcTo(w, 0, w, r, r);
      ctx.lineTo(w, h - r);
      ctx.arcTo(w, h, w - r, h, r);
      ctx.lineTo(r, h);
      ctx.arcTo(0, h, 0, h - r, r);
      ctx.lineTo(0, r);
      ctx.arcTo(0, 0, r, 0, r);
      ctx.closePath();

      ctx.fillStyle = 'rgba(10, 14, 39, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 顶部发光线
      const lineW = w * 0.7;
      const lineX = (w - lineW) / 2;
      const lineGrad = ctx.createLinearGradient(lineX, 0, lineX + lineW, 0);
      lineGrad.addColorStop(0, 'transparent');
      lineGrad.addColorStop(0.5, RUNE_CYAN);
      lineGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = lineGrad;
      ctx.shadowColor = 'rgba(0, 245, 212, 0.3)';
      ctx.shadowBlur = 6;
      ctx.fillRect(lineX, -1, lineW, 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    };
    cardContainer.addChild(cardBg);

    // 卡片标题
    const cardTitle = new Label({
      text: '你找到了真相。',
      fontSize: 20,
      color: RUNE_CYAN,
      textAlign: 'center',
      shadowLayers: [
        { color: 'rgba(0, 245, 212, 0.6)', blur: 8 },
        { color: 'rgba(0, 245, 212, 0.3)', blur: 16 },
      ],
    });
    cardTitle.width = cardW;
    cardTitle.x = cardX;
    cardTitle.y = cardY + 24;
    cardContainer.addChild(cardTitle);

    // 统计信息
    this._statLabel = new Label({
      text: `线索收集程度 0%`,
      fontSize: 12,
      color: TEXT_SECONDARY,
      textAlign: 'center',
      fontFamily: FONT_MONO,
    });
    this._statLabel.width = cardW;
    this._statLabel.x = cardX;
    this._statLabel.y = cardY + 70;
    cardContainer.addChild(this._statLabel);

    // 分隔线
    const dividerNode = new Node();
    dividerNode.x = cardX;
    dividerNode.y = cardY + 100;
    dividerNode.width = cardW;
    dividerNode.height = 1;
    dividerNode._draw = function(ctx) {
      const w = cardW;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, 'rgba(0, 245, 212, 0.15)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 1);
    };
    cardContainer.addChild(dividerNode);

    // 引言
    const quoteLabel = new Label({
      text: '\u300C\u6CA1\u6709\u52C7\u6562\u8005\uFF0C\u4EA6\u6CA1\u6709\u602F\u61E6\u8005\u300D',
      fontSize: 12,
      color: TEXT_DIM,
      textAlign: 'center',
    });
    quoteLabel.width = cardW;
    quoteLabel.x = cardX;
    quoteLabel.y = cardY + 120;
    cardContainer.addChild(quoteLabel);

    // 继续按钮
    const continueBtn = new Button({
      text: '继续',
      fontSize: 13,
      fontColor: RUNE_CYAN,
      bgColor: 'rgba(0, 245, 212, 0.04)',
      borderColor: 'rgba(0, 245, 212, 0.3)',
      borderWidth: 0.5,
      cornerRadius: 4,
      width: 80,
      height: 36,
    });
    continueBtn.x = cardX + (cardW - 80) / 2;
    continueBtn.y = cardY + 170;
    continueBtn.interactive = true;
    continueBtn.on('tap', () => this._showCredits());
    cardContainer.addChild(continueBtn);

    // 底部文字
    const creditText = new Label({
      text: '\u2014\u2014 \u672A\u77E5\u4FE1\u53F7\u6E90 \u2014\u2014',
      fontSize: 11,
      color: TEXT_DIM,
      textAlign: 'center',
    });
    creditText.width = this._screenWidth;
    creditText.y = cardY + cardH + 24;
    creditText.alpha = 0.5;
    cardContainer.addChild(creditText);

    // 淡入动画
    cardContainer.alpha = 0;
    Tween.create(cardContainer).to({ alpha: 1 }, 1500, 'easeInOut').start();
  }

  // ==================== Phase 6: 制作名单 ====================

  _showCredits() {
    this._phase = 'credits';
    this._clearAllPhaseUI();

    const self = this;

    // 制作名单 ScrollView
    this._creditsScrollView = new ScrollView({
      width: this._screenWidth,
      height: this._screenHeight,
      contentHeight: 0,
      showScrollbar: false,
      bounceEnabled: true,
    });
    this._creditsScrollView.x = 0;
    this._creditsScrollView.y = 0;
    this._creditsScrollView.zIndex = 30;
    this._creditsScrollView.interactive = true;

    this._creditsScrollView.on('touchstart', (e) => {
      this._creditsScrollView.onTouchStart(e.y);
      e.stopPropagation();
    });
    this._creditsScrollView.on('touchmove', (e) => {
      this._creditsScrollView.onTouchMove(e.y);
      e.stopPropagation();
    });
    this._creditsScrollView.on('touchend', () => {
      this._creditsScrollView.onTouchEnd();
    });

    this.addChild(this._creditsScrollView);

    // 星河头图（cover 模式：等比居中裁剪，不拉伸）
    const imgH = Math.round(this._screenWidth * 0.52);
    const headerNode = new Node();
    headerNode.x = 0;
    headerNode.y = 0;
    headerNode.width = this._screenWidth;
    headerNode.height = imgH;
    headerNode._img = null;
    headerNode._imgLoaded = false;
    const headerImg = wx.createImage();
    headerImg.onload = () => {
      headerNode._img = headerImg;
      headerNode._imgLoaded = true;
    };
    headerImg.src = 'res/images/xinghe.png';
    headerNode._draw = function(ctx) {
      if (!this._imgLoaded) return;
      const dw = self._screenWidth;
      const dh = imgH;
      const iw = this._img.width;
      const ih = this._img.height;
      const scale = Math.max(dw / iw, dh / ih);
      const sw = dw / scale;
      const sh = dh / scale;
      const sx = (iw - sw) / 2;
      const sy = (ih - sh) / 2;
      ctx.drawImage(this._img, sx, sy, sw, sh, 0, 0, dw, dh);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, dw, dh);
    };
    this._creditsScrollView.addChild(headerNode);

    // 图片底部渐变过渡
    const fadeMask = new Node();
    fadeMask.x = 0;
    fadeMask.y = imgH - 70;
    fadeMask.width = this._screenWidth;
    fadeMask.height = 70;
    fadeMask._draw = function(ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 70);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, ENDING_BG);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, self._screenWidth, 70);
    };
    this._creditsScrollView.addChild(fadeMask);

    let curY = imgH + 16;

    // 游戏标题
    const titleLabel = new Label({
      text: '未知信号源',
      fontSize: 28,
      color: RUNE_CYAN,
      textAlign: 'center',
      shadowLayers: [
        { color: 'rgba(0, 245, 212, 0.6)', blur: 8 },
        { color: 'rgba(0, 245, 212, 0.3)', blur: 16 },
      ],
    });
    titleLabel.width = this._screenWidth;
    titleLabel.y = curY;
    this._creditsScrollView.addChild(titleLabel);
    curY += 44;

    const subtitleLabel = new Label({
      text: 'UNKNOWN SIGNAL',
      fontSize: 10,
      color: TEXT_DIM,
      textAlign: 'center',
      fontFamily: FONT_MONO,
    });
    subtitleLabel.width = this._screenWidth;
    subtitleLabel.y = curY;
    subtitleLabel.alpha = 0.5;
    this._creditsScrollView.addChild(subtitleLabel);
    curY += 30;

    // 分隔线工具函数
    const addGlowLine = (y) => {
      const lineNode = new Node();
      lineNode.x = 60;
      lineNode.y = y;
      lineNode.width = this._screenWidth - 120;
      lineNode.height = 1;
      lineNode._draw = function(ctx) {
        const w = (self._screenWidth - 120);
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, 'rgba(0, 245, 212, 0.15)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, 1);
      };
      self._creditsScrollView.addChild(lineNode);
      return y + 20;
    };

    // 添加制作组工具函数
    const addSection = (title, names, y) => {
      const titleL = new Label({
        text: title,
        fontSize: 12,
        color: 'rgba(0, 245, 212, 0.5)',
        textAlign: 'center',
      });
      titleL.width = self._screenWidth;
      titleL.y = y;
      self._creditsScrollView.addChild(titleL);
      y += 24;

      names.forEach(name => {
        const nameL = new Label({
          text: name,
          fontSize: 15,
          color: TEXT_PRIMARY,
          textAlign: 'center',
        });
        nameL.width = self._screenWidth;
        nameL.y = y;
        self._creditsScrollView.addChild(nameL);
        y += 32;
      });

      return y + 10;
    };

    curY = addGlowLine(curY);
    curY = addSection('制作', ['小金'], curY);
    curY = addGlowLine(curY);
    curY = addSection('协作', ['Claude, Gemini, GPT'], curY);
    curY = addGlowLine(curY);
    curY = addSection('特别感谢', ['Yana','AdrainH', 'B4C5'], curY);
    curY = addGlowLine(curY);

    // 联络
    const contactTitle = new Label({
      text: '联络',
      fontSize: 12,
      color: 'rgba(0, 245, 212, 0.5)',
      textAlign: 'center',
    });
    contactTitle.width = this._screenWidth;
    contactTitle.y = curY;
    this._creditsScrollView.addChild(contactTitle);
    curY += 24;

    const emailLabel = new Label({
      text: 'wangyjzoe@163.com',
      fontSize: 13,
      color: TEXT_SECONDARY,
      textAlign: 'center',
      fontFamily: FONT_MONO,
    });
    emailLabel.width = this._screenWidth;
    emailLabel.y = curY;
    this._creditsScrollView.addChild(emailLabel);
    curY += 40;

    curY = addGlowLine(curY);

    // 结语
    const endNote = new Label({
      text: '感谢你的游玩',
      fontSize: 13,
      color: TEXT_DIM,
      textAlign: 'center',
    });
    endNote.width = this._screenWidth;
    endNote.y = curY;
    endNote.alpha = 0.6;
    this._creditsScrollView.addChild(endNote);
    curY += 40;

    // 按钮行：分享 + 返回通讯仪，并排居中
    const btnGap = 12;
    const shareBtn = new Button({
      text: '分享',
      fontSize: 13,
      fontColor: RUNE_PURPLE,
      bgColor: 'rgba(155, 93, 229, 0.04)',
      borderColor: 'rgba(155, 93, 229, 0.3)',
      borderWidth: 0.5,
      cornerRadius: 4,
      width: 80,
      height: 36,
    });
    const homeBtn = new Button({
      text: '返回通讯仪',
      fontSize: 13,
      fontColor: RUNE_CYAN,
      bgColor: 'rgba(0, 245, 212, 0.04)',
      borderColor: 'rgba(0, 245, 212, 0.3)',
      borderWidth: 0.5,
      cornerRadius: 4,
      width: 120,
      height: 36,
    });
    const btnRowW = 80 + btnGap + 120;
    const btnRowX = (this._screenWidth - btnRowW) / 2;
    shareBtn.x = btnRowX;
    shareBtn.y = curY;
    shareBtn.interactive = true;
    shareBtn.on('tap', () => this._shareGame());
    this._creditsScrollView.addChild(shareBtn);

    homeBtn.x = btnRowX + 80 + btnGap;
    homeBtn.y = curY;
    homeBtn.interactive = true;
    homeBtn.on('tap', () => this._goHome());
    this._creditsScrollView.addChild(homeBtn);
    curY += 52;

    // 重新开始按钮
    const restartBtn = new Button({
      text: '重新开始',
      fontSize: 13,
      fontColor: TEXT_DIM,
      bgColor: 'transparent',
      borderColor: 'rgba(255,255,255,0.15)',
      width: 120,
      height: 36,
    });
    restartBtn.x = (this._screenWidth - 120) / 2;
    restartBtn.y = curY;
    restartBtn.interactive = true;
    restartBtn.on('tap', () => this._restartGame());
    this._creditsScrollView.addChild(restartBtn);
    curY += 60;

    this._creditsScrollView.contentHeight = curY;

    // 淡入
    this._creditsScrollView.alpha = 0;
    Tween.create(this._creditsScrollView).to({ alpha: 1 }, 1500, 'easeInOut').start();
  }

  // ==================== 清理 ====================

  _clearDialoguePhase() {
    if (this._dialogueScrollView) {
      this._dialogueScrollView.removeFromParent();
      this._dialogueScrollView = null;
    }
    if (this._tapAreaNode) {
      this._tapAreaNode.removeFromParent();
      this._tapAreaNode = null;
    }
    this._dialogueContainer = null;
    this._tapHintNode = null;
  }

  _clearCollectingPhase() {
    // 清理槽位
    this._charSlotNodes.forEach(n => n.removeFromParent());
    this._charSlotNodes = [];

    // 清理提示
    if (this._collectHintLabel) {
      this._collectHintLabel.removeFromParent();
      this._collectHintLabel = null;
    }

    // 清理气泡 ScrollView
    if (this._bubbleScrollView) {
      this._bubbleScrollView.removeFromParent();
      this._bubbleScrollView = null;
    }
    this._bubbleNodes = [];
  }

  _clearAllPhaseUI() {
    this._clearDialoguePhase();
    this._clearCollectingPhase();

    // 清理揭示标签
    if (this._revealLabel) {
      this._revealLabel.removeFromParent();
      this._revealLabel = null;
    }

    // 清理通关卡片
    if (this._cardContainer) {
      this._cardContainer.removeFromParent();
      this._cardContainer = null;
    }

    // 清理制作名单
    if (this._creditsScrollView) {
      this._creditsScrollView.removeFromParent();
      this._creditsScrollView = null;
    }
  }

  // ==================== 导航 ====================

  _shareGame() {
    try {
      wx.shareAppMessage({
        title: '那边的人，能看到这条消息吗？',
        imageUrl: 'https://mmocgame.qpic.cn/wechatgame/BE1I0ibxriaQHIqDe5vNbGxGSWaaYbNz8vSwxSnKvwNDDw7kicwPcY0IYK06GEpSSF2/0',
        query: '',
      });
    } catch (e) { /* ignore */ }
  }

  _draw(ctx) {
    // 右滑时补绘左侧背景
    if (this.x > 0) {
      const sh = this._screenHeight || 667;
      ctx.save();
      ctx.translate(-this.x, 0);
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, this.x + 1, sh);
      const _swipeShadow = ctx.createLinearGradient(0, 0, this.x, 0);
      _swipeShadow.addColorStop(0, 'rgba(0,0,0,0.25)');
      _swipeShadow.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = _swipeShadow;
      ctx.fillRect(0, 0, this.x + 1, sh);
      ctx.restore();
    }
  }

  onTouchStart(event) {
    super.onTouchStart(event);
    if (event.changedTouches && event.changedTouches.length > 0) {
      const t = event.changedTouches[0];
      this._swipeStartX = t.x;
      this._swipeStartY = t.y;
      this._swipeActive = false;
    }
  }

  onTouchMove(event) {
    if (event.changedTouches && event.changedTouches.length > 0) {
      const t = event.changedTouches[0];
      const dx = t.x - this._swipeStartX;
      const dy = t.y - this._swipeStartY;
      if (!this._swipeActive && this._swipeStartX < 60 && dx > 10 && Math.abs(dx) > Math.abs(dy)) {
        this._swipeActive = true;
      }
      if (this._swipeActive) {
        this.x = Math.max(0, dx);
        return;
      }
    }
    super.onTouchMove(event);
  }

  onTouchEnd(event) {
    if (this._swipeActive) {
      this._swipeActive = false;
      const sw = this._screenWidth || 375;
      if (this.x > sw * 0.35) {
        Tween.create(this).to({ x: sw }, 200, 'easeOut').call(() => {
          this.x = 0;
          this._onBack();
        }).start();
      } else {
        Tween.create(this).to({ x: 0 }, 180, 'easeOut').start();
      }
      return;
    }
    super.onTouchEnd(event);
  }

    _onBack() {
    if (this.engine) {
      this.engine.popScene();
    }
  }

  _goHome() {
    // 返回主界面 — 回到场景栈底部
    if (this.engine) {
      // 弹出所有场景直到只剩主界面
      while (this.engine._sceneStack && this.engine._sceneStack.length > 1) {
        this.engine.popScene();
      }
    }
  }

  _restartGame() {
    try {
      wx.showModal({
        title: '重新开始',
        content: '将清除所有进度，从头开始游戏。',
        confirmText: '确认',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            gameState.reset();
            try { wx.removeStorageSync('ghost_portal_animated'); } catch (e) {}
            try { wx.removeStorageSync('ghost_chat_progress'); } catch (e) {}
            try { wx.removeStorageSync('chat_messages_history'); } catch (e) {}
            if (this.engine) this.engine.replaceScene(new OpeningPage());
          }
        },
      });
    } catch (e) {}
  }

  // ==================== 每帧更新 ====================

  update(dt) {
    super.update(dt);

    // 闪烁计时器
    this._flashTimer += dt;

    // 对话阶段 — 更新 ScrollView
    if (this._dialogueScrollView) {
      this._dialogueScrollView.update(dt);
    }

    // 气泡阶段 — 更新 ScrollView
    if (this._bubbleScrollView) {
      this._bubbleScrollView.update(dt);
    }

    // 制作名单 — 更新 ScrollView
    if (this._creditsScrollView) {
      this._creditsScrollView.update(dt);
    }

    // 通关卡片数字增长动画
    if (this._phase === 'card' && this._statLabel && this._displayedPercent < this._evidencePercent) {
      this._statAnimTimer += dt;
      if (this._statAnimTimer > 30) {
        this._statAnimTimer = 0;
        this._displayedPercent = Math.min(this._displayedPercent + 1, this._evidencePercent);
        this._statLabel.text = `线索收集程度 ${this._displayedPercent}%`;
      }
    }

    // 点击继续提示闪烁
    if (this._tapHintNode && this._tapHintNode.visible) {
      const blinkT = (this._flashTimer % 1500) / 1500;
      this._tapHintNode.alpha = blinkT < 0.5
        ? 0.3 + 0.5 * Math.sin(blinkT / 0.5 * Math.PI)
        : 0.3 + 0.5 * Math.sin((1 - blinkT) / 0.5 * Math.PI);
    }
  }
}
