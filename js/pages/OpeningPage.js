/**
 * OpeningPage.js - 开场动画序列
 * 继承 Scene，还原 opening 页面的完整动画流程：
 * 1. 故障覆盖层（扫描线 + 静电噪点）
 * 2. 信号搜索动画（3根信号柱 + 文字）
 * 3. 消息渐进显示（符文行、系统行、打字机效果）
 * 4. 继续按钮（脉冲发光 + shimmer）
 */

import { Scene } from '../engine/Scene.js';
import { Label } from '../engine/Label.js';
import { Node } from '../engine/Node.js';
import { Tween } from '../engine/Tween.js';
import GlitchEffect from '../effects/GlitchEffect.js';
import ScanlineEffect from '../effects/ScanlineEffect.js';
import MainPage from './MainPage.js';
import gameState from '../core/GameState.js';
import {
  BG_DARK, RUNE_CYAN, TEXT_PRIMARY, TEXT_DIM, TEXT_SECONDARY,
  FONT_PRIMARY, FONT_MONO,
} from '../style/StyleConfig.js';

// 开场消息序列
const MESSAGES = [
  { text: '◈⬡▽◇☉△⬢◯？', isRune: true, delay: 1500 },
  { text: '[ 信号解析中... ]', isSystem: true, delay: 2000 },
  { text: '有人能看到吗？', delay: 2500 },
  { text: '如果你能看到这条消息，请不要关掉。', delay: 4000 },
  { text: '我叫星河，我不是你们世界的人。', delay: 6000 },
  { text: '我是一名调查官，正在追查一桩谋杀案。', delay: 8000 },
  { text: '凶手逃到了你们的宇宙。', delay: 9500 },
  { text: '我需要你的帮助。', delay: 11000 },
];

export default class OpeningPage extends Scene {
  constructor() {
    super();

    // 计时器列表（用于清理）
    this._timers = [];

    // 状态标记
    this._showSignal = false;
    this._signalConnected = false;
    this._signalText = '搜索信号中...';
    this._showContinue = false;

    // 信号柱动画数据（3 根柱，高度 0~1）
    this._signalBars = [0, 0, 0];
    this._signalBarTargets = [0, 0, 0];

    // 消息列表（运行时填充）
    this._messages = [];

    // 打字机光标闪烁计时
    this._cursorTimer = 0;
    this._cursorVisible = true;

    // 按钮脉冲动画
    this._btnGlowPhase = 0;
    this._btnShimmerX = -100;

    // 效果
    this._glitchEffect = null;
    this._scanlineEffect = null;

    // 屏幕尺寸（onEnter 时设置）
    this._screenW = 375;
    this._screenH = 667;
  }

  /**
   * 场景进入
   */
  onEnter() {
    const engine = this.engine;
    this._screenW = engine.getWidth();
    this._screenH = engine.getHeight();

    // 检查是否已完成开场
    const state = gameState.get();
    if (state.isOpeningDone) {
      engine.replaceScene(new MainPage());
      return;
    }

    // 初始化效果
    this._glitchEffect = new GlitchEffect({
      width: this._screenW,
      height: this._screenH,
      sliceCount: 10,
      maxOffset: 15,
    });

    this._scanlineEffect = new ScanlineEffect({
      width: this._screenW,
      height: this._screenH,
      lineAlpha: 0.04,
      spacing: 4,
      animated: true,
    });

    // 启动动画序列
    this._startSequence();
  }

  /**
   * 场景退出
   */
  onExit() {
    this._clearTimers();
  }

  /**
   * 启动完整开场序列
   * @private
   */
  _startSequence() {
    // Phase 1: 初始故障闪烁
    this._delay(300, () => {
      this._glitchEffect.play(500);
    });

    // Phase 2: 显示信号搜索
    this._delay(1000, () => {
      this._showSignal = true;
      // 信号柱阶梯脉冲动画
      this._startSignalBarAnimation();

      // Phase 3: 信号连接
      this._delay(800, () => {
        this._signalConnected = true;
        this._signalText = '信号已连接';

        // 连接时再次故障
        this._delay(200, () => {
          this._glitchEffect.play(300);
        });
      });
    });

    // Phase 4: 依次显示消息
    MESSAGES.forEach((msg, index) => {
      this._delay(msg.delay, () => {
        this._showMessage(msg, index);
      });
    });

    // Phase 5: 显示继续按钮
    const lastDelay = MESSAGES[MESSAGES.length - 1].delay;
    this._delay(lastDelay + 2000, () => {
      this._showContinue = true;
    });
  }

  /**
   * 信号柱阶梯脉冲动画
   * @private
   */
  _startSignalBarAnimation() {
    const animate = () => {
      if (!this._showSignal) return;
      // 随机目标高度
      this._signalBarTargets = [
        0.3 + Math.random() * 0.7,
        0.3 + Math.random() * 0.7,
        0.3 + Math.random() * 0.7,
      ];
      this._delay(400, animate);
    };
    animate();
  }

  /**
   * 显示单条消息（打字机效果）
   * @private
   */
  _showMessage(msg, index) {
    const fullText = msg.text;

    // 符文出现时触发故障
    if (msg.isRune) {
      this._glitchEffect.play(200);
    }

    const messageObj = {
      fullText,
      displayText: '',
      isRune: msg.isRune || false,
      isSystem: msg.isSystem || false,
      typing: true,
      fadeOut: false,
      alpha: 1,
      showSenderTag: !msg.isRune && !msg.isSystem && index >= 3,
    };

    this._messages.push(messageObj);

    // 打字机逐字显示
    let charIndex = 0;
    const typeSpeed = msg.isRune ? 80 : msg.isSystem ? 50 : 60;

    const typeNext = () => {
      if (charIndex <= fullText.length) {
        messageObj.displayText = fullText.substring(0, charIndex);
        charIndex++;
        this._delay(typeSpeed, typeNext);
      } else {
        messageObj.typing = false;

        // 符文行淡出
        if (msg.isRune) {
          this._delay(800, () => {
            messageObj.fadeOut = true;
            // 渐隐动画
            const fadeStep = () => {
              messageObj.alpha -= 0.05;
              if (messageObj.alpha > 0) {
                this._delay(30, fadeStep);
              } else {
                messageObj.alpha = 0;
              }
            };
            fadeStep();
          });
        }
      }
    };

    typeNext();
  }

  /**
   * 每帧更新
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);

    // 更新效果
    if (this._glitchEffect) this._glitchEffect.update(dt);
    if (this._scanlineEffect) this._scanlineEffect.update(dt);

    // 光标闪烁
    this._cursorTimer += dt;
    if (this._cursorTimer >= 600) {
      this._cursorTimer = 0;
      this._cursorVisible = !this._cursorVisible;
    }

    // 信号柱缓动
    for (let i = 0; i < 3; i++) {
      this._signalBars[i] += (this._signalBarTargets[i] - this._signalBars[i]) * 0.15;
    }

    // 按钮脉冲
    if (this._showContinue) {
      this._btnGlowPhase += dt * 0.003;
      this._btnShimmerX += dt * 0.08;
      if (this._btnShimmerX > this._screenW) {
        this._btnShimmerX = -100;
      }
    }
  }

  /**
   * 绘制场景
   * @param {CanvasRenderingContext2D} ctx
   */
  _draw(ctx) {
    const W = this._screenW;
    const H = this._screenH;

    // 1. 深色背景
    ctx.fillStyle = BG_DARK;
    ctx.fillRect(0, 0, W, H);

    // 2. 信号搜索动画
    if (this._showSignal) {
      this._drawSignalStatus(ctx, W, H);
    }

    // 3. 消息区域
    this._drawMessages(ctx, W, H);

    // 4. 继续按钮
    if (this._showContinue) {
      this._drawContinueButton(ctx, W, H);
    }

    // 5. 扫描线覆盖
    if (this._scanlineEffect) {
      this._scanlineEffect.render(ctx);
    }

    // 6. 故障效果（最顶层）
    if (this._glitchEffect) {
      this._glitchEffect.render(ctx);
    }
  }

  /**
   * 绘制信号搜索状态
   * @private
   */
  _drawSignalStatus(ctx, W, H) {
    const cx = W / 2;
    const baseY = H * 0.15;

    ctx.save();

    // 3 根信号柱
    const barWidth = 30;
    const barGap = 8;
    const maxBarHeight = 6;
    const totalWidth = barWidth * 3 + barGap * 2;
    const startX = cx - totalWidth / 2;

    for (let i = 0; i < 3; i++) {
      const bx = startX + i * (barWidth + barGap);
      const barH = 2 + this._signalBars[i] * (maxBarHeight - 2);
      const by = baseY;

      ctx.beginPath();
      ctx.roundRect(bx, by, barWidth, barH, [1.5]);

      if (this._signalConnected) {
        ctx.fillStyle = RUNE_CYAN;
        ctx.shadowColor = RUNE_CYAN;
        ctx.shadowBlur = 5;
      } else {
        ctx.fillStyle = 'rgba(0, 245, 212, 0.2)';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 信号文字
    ctx.font = `11px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (this._signalConnected) {
      ctx.fillStyle = RUNE_CYAN;
      ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
      ctx.shadowBlur = 5;
    } else {
      ctx.fillStyle = TEXT_DIM;
    }
    ctx.fillText(this._signalText, cx, baseY + 16);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.restore();
  }

  /**
   * 绘制消息列表
   * @private
   */
  _drawMessages(ctx, W, H) {
    const startY = H * 0.35;
    const lineGap = 20;
    const paddingX = 32;
    let curY = startY;

    ctx.save();

    for (let i = 0; i < this._messages.length; i++) {
      const msg = this._messages[i];
      if (msg.alpha <= 0) continue;

      ctx.globalAlpha = msg.alpha;

      if (msg.isRune) {
        // 符文行：居中，大字号，青色发光
        ctx.font = `24px ${FONT_PRIMARY}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = RUNE_CYAN;
        ctx.shadowColor = RUNE_CYAN;
        ctx.shadowBlur = 10;
        ctx.fillText(msg.displayText, W / 2, curY);
        // 更强外发光
        ctx.shadowBlur = 20;
        ctx.globalAlpha = msg.alpha * 0.3;
        ctx.fillText(msg.displayText, W / 2, curY);
        ctx.globalAlpha = msg.alpha;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        curY += 40;
      } else if (msg.isSystem) {
        // 系统行：居中，小字号，灰色等宽
        ctx.font = `12px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = TEXT_SECONDARY;
        ctx.fillText(msg.displayText, W / 2, curY);
        ctx.textAlign = 'left';
        curY += 28;
      } else {
        // 普通消息行
        // 发送者标签
        if (msg.showSenderTag) {
          ctx.font = `11px ${FONT_PRIMARY}`;
          ctx.fillStyle = 'rgba(0, 245, 212, 0.6)';
          ctx.fillText('星河', paddingX, curY);
          curY += 18;
        }

        // 消息文字
        ctx.font = `16px ${FONT_PRIMARY}`;
        ctx.fillStyle = TEXT_PRIMARY;
        ctx.fillText(msg.displayText, paddingX, curY);

        // 打字机光标
        if (msg.typing && this._cursorVisible) {
          const textW = ctx.measureText(msg.displayText).width;
          ctx.fillStyle = RUNE_CYAN;
          ctx.fillText('|', paddingX + textW + 1, curY);
        }

        curY += 32;
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * 绘制继续按钮
   * @private
   */
  _drawContinueButton(ctx, W, H) {
    const btnW = 180;
    const btnH = 44;
    const btnX = (W - btnW) / 2;
    const btnY = H - 120;
    const btnR = 22;

    ctx.save();

    // 脉冲发光强度
    const glowIntensity = 0.5 + Math.sin(this._btnGlowPhase) * 0.3;

    // 按钮背景
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, [btnR]);
    ctx.fillStyle = `rgba(0, 245, 212, ${0.08 * glowIntensity})`;
    ctx.fill();

    // 按钮边框
    ctx.strokeStyle = `rgba(0, 245, 212, ${0.5 + glowIntensity * 0.3})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 外发光
    ctx.shadowColor = `rgba(0, 245, 212, ${0.2 * glowIntensity})`;
    ctx.shadowBlur = 15 * glowIntensity;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, [btnR]);
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Shimmer 效果（内部扫光）
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, [btnR]);
    ctx.clip();
    const shimmerGrad = ctx.createLinearGradient(
      this._btnShimmerX - 30, btnY,
      this._btnShimmerX + 30, btnY
    );
    shimmerGrad.addColorStop(0, 'transparent');
    shimmerGrad.addColorStop(0.5, 'rgba(0, 245, 212, 0.1)');
    shimmerGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.restore();

    // 按钮文字
    ctx.font = `15px ${FONT_PRIMARY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = RUNE_CYAN;
    ctx.shadowColor = 'rgba(0, 245, 212, 0.4)';
    ctx.shadowBlur = 6;
    ctx.fillText('进 入 通 讯 仪', W / 2, btnY + btnH / 2);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 副标题提示
    const hintAlpha = 0.4 + Math.sin(this._btnGlowPhase * 0.8) * 0.2;
    ctx.font = `11px ${FONT_PRIMARY}`;
    ctx.fillStyle = TEXT_DIM;
    ctx.globalAlpha = hintAlpha;
    ctx.fillText('与神秘人建立跨维度连接', W / 2, btnY + btnH + 18);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 1;

    ctx.restore();

    // 存储按钮区域用于触摸检测
    this._btnRect = { x: btnX, y: btnY, w: btnW, h: btnH };
  }

  /**
   * 触摸结束：检测继续按钮点击
   */
  onTouchEnd(event) {
    super.onTouchEnd(event);

    if (this._showContinue && this._btnRect && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      const { x, y, w, h } = this._btnRect;
      if (touch.x >= x && touch.x <= x + w && touch.y >= y && touch.y <= y + h) {
        this._onContinue();
      }
    }
  }

  /**
   * 点击继续按钮
   * @private
   */
  _onContinue() {
    gameState.update({ isOpeningDone: true });

    this.engine.replaceScene(new MainPage());
  }

  // ==================== 工具方法 ====================

  /**
   * 延迟执行（自动追踪清理）
   * @private
   */
  _delay(ms, callback) {
    const timer = setTimeout(callback, ms);
    this._timers.push(timer);
    return timer;
  }

  /**
   * 清理所有计时器
   * @private
   */
  _clearTimers() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  }
}
