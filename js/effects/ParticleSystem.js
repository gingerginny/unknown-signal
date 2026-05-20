/**
 * ParticleSystem.js
 * 简易粒子系统
 * 用于：幽灵传送门效果、证据收集反馈等
 */

import { RUNE_CYAN, RUNE_PURPLE } from '../style/StyleConfig.js';

/**
 * 单个粒子
 * @typedef {Object} Particle
 * @property {number} x - x 坐标
 * @property {number} y - y 坐标
 * @property {number} vx - x 方向速度
 * @property {number} vy - y 方向速度
 * @property {number} life - 当前存活时间（ms）
 * @property {number} maxLife - 最大存活时间（ms）
 * @property {number} size - 粒子大小
 * @property {string} color - 粒子颜色
 * @property {number} alpha - 当前透明度
 */

/**
 * 发射器配置
 * @typedef {Object} EmitterConfig
 * @property {number} x - 发射位置 x
 * @property {number} y - 发射位置 y
 * @property {number} [rate=10] - 每秒发射粒子数
 * @property {number} [speed=50] - 粒子初始速度
 * @property {number} [angle=0] - 发射方向角度（弧度，0 = 向右）
 * @property {number} [spread=Math.PI*2] - 发射扩散角度（弧度）
 * @property {number} [lifespan=1000] - 粒子寿命（ms）
 * @property {number} [minSize=1] - 最小粒子大小
 * @property {number} [maxSize=3] - 最大粒子大小
 * @property {string[]} [colors] - 可选颜色数组
 * @property {number} [gravity=0] - 重力加速度（正值向下）
 * @property {boolean} [burst=false] - 是否为爆发模式（一次性发射）
 * @property {number} [burstCount=20] - 爆发模式一次发射粒子数
 * @property {string} [shape='circle'] - 粒子形状：'circle' | 'square'
 */

export default class ParticleSystem {
  /**
   * @param {Object} options
   * @param {number} [options.maxParticles=200] - 最大粒子数
   */
  constructor(options = {}) {
    /** @type {number} 最大粒子数 */
    this.maxParticles = options.maxParticles ?? 200;

    /** @type {Particle[]} 粒子池 */
    this._particles = [];

    /** @type {EmitterConfig[]} 活跃的发射器 */
    this._emitters = [];

    /** @type {number} 发射累积器 */
    this._emitAccumulator = 0;
  }

  /**
   * 添加一个发射器
   * @param {EmitterConfig} config - 发射器配置
   * @returns {EmitterConfig} 返回配置对象（可用于后续移除或修改）
   */
  addEmitter(config) {
    const emitter = Object.assign({
      x: 0,
      y: 0,
      rate: 10,
      speed: 50,
      angle: 0,
      spread: Math.PI * 2,
      lifespan: 1000,
      minSize: 1,
      maxSize: 3,
      colors: [RUNE_CYAN, RUNE_PURPLE],
      gravity: 0,
      burst: false,
      burstCount: 20,
      shape: 'circle',
      _accumulator: 0,
    }, config);

    this._emitters.push(emitter);

    // 爆发模式：立即发射一批粒子
    if (emitter.burst) {
      for (let i = 0; i < emitter.burstCount; i++) {
        this._emitParticle(emitter);
      }
    }

    return emitter;
  }

  /**
   * 移除一个发射器
   * @param {EmitterConfig} emitter - 要移除的发射器
   */
  removeEmitter(emitter) {
    const idx = this._emitters.indexOf(emitter);
    if (idx !== -1) {
      this._emitters.splice(idx, 1);
    }
  }

  /** 移除所有发射器 */
  clearEmitters() {
    this._emitters = [];
  }

  /** 清除所有粒子 */
  clearParticles() {
    this._particles = [];
  }

  /**
   * 一次性在指定位置爆发粒子
   * @param {number} x - x 坐标
   * @param {number} y - y 坐标
   * @param {Object} [options] - 额外配置
   */
  burst(x, y, options = {}) {
    this.addEmitter(Object.assign({
      x,
      y,
      burst: true,
      burstCount: options.count ?? 20,
      speed: options.speed ?? 80,
      lifespan: options.lifespan ?? 800,
      colors: options.colors || [RUNE_CYAN, RUNE_PURPLE],
      minSize: options.minSize ?? 1,
      maxSize: options.maxSize ?? 4,
      shape: options.shape || 'circle',
    }, options));
  }

  /**
   * 更新所有粒子
   * @param {number} dt - 帧间隔时间（ms）
   */
  update(dt) {
    // 处理持续发射器
    for (const emitter of this._emitters) {
      if (emitter.burst) continue; // 爆发模式已在 addEmitter 时发射

      emitter._accumulator += dt;
      const interval = 1000 / emitter.rate;

      while (emitter._accumulator >= interval) {
        emitter._accumulator -= interval;
        if (this._particles.length < this.maxParticles) {
          this._emitParticle(emitter);
        }
      }
    }

    // 清理爆发模式的发射器（只用一次）
    this._emitters = this._emitters.filter(e => !e.burst);

    // 更新所有粒子
    const dtSec = dt / 1000;
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life += dt;

      // 超过寿命则移除
      if (p.life >= p.maxLife) {
        this._particles.splice(i, 1);
        continue;
      }

      // 更新位置
      p.vy += p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      // 更新透明度（线性衰减）
      p.alpha = 1.0 - (p.life / p.maxLife);
    }
  }

  /**
   * 在 Canvas 上绘制所有粒子
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
   */
  render(ctx) {
    if (this._particles.length === 0) return;

    ctx.save();

    for (const p of this._particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'square') {
        ctx.fillRect(
          p.x - p.size / 2,
          p.y - p.size / 2,
          p.size,
          p.size
        );
      } else {
        // 默认圆形
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  /** @returns {number} 当前粒子数量 */
  getParticleCount() {
    return this._particles.length;
  }

  /**
   * 从发射器发射一个粒子
   * @param {EmitterConfig} emitter
   */
  _emitParticle(emitter) {
    if (this._particles.length >= this.maxParticles) return;

    // 随机方向（在 angle ± spread/2 范围内）
    const dir = emitter.angle + (Math.random() - 0.5) * emitter.spread;
    const speed = emitter.speed * (0.5 + Math.random() * 0.5);

    // 随机大小
    const size = emitter.minSize + Math.random() * (emitter.maxSize - emitter.minSize);

    // 随机颜色
    const color = emitter.colors[Math.floor(Math.random() * emitter.colors.length)];

    this._particles.push({
      x: emitter.x,
      y: emitter.y,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      life: 0,
      maxLife: emitter.lifespan * (0.7 + Math.random() * 0.6),
      size,
      color,
      alpha: 1.0,
      gravity: emitter.gravity || 0,
      shape: emitter.shape || 'circle',
    });
  }
}
