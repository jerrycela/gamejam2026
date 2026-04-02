// BattleUI.js
// Visual layer for BattleManager: hero circles, HP bars, damage popups, result banner.

import { MOVE_DURATION } from '../models/BattleManager.js';

const HERO_COLORS = {
  trainee_swordsman: 0x3498db,
  light_archer:      0x2ecc71,
  priest:            0xf39c12,
  fire_mage:         0xe74c3c,
  holy_knight:       0x9b59b6,
};

const HP_BAR_W = 30;
const HP_BAR_H = 4;
const HERO_RADIUS = 12;

export default class BattleUI {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../models/BattleManager.js').default} battleManager
   * @param {import('../models/GameState.js').default} gameState
   * @param {import('./DungeonMapUI.js').default} dungeonMapUI
   */
  constructor(scene, battleManager, gameState, dungeonMapUI) {
    this._scene = scene;
    this._battleManager = battleManager;
    this._gameState = gameState;
    this._dungeonMapUI = dungeonMapUI;

    this._heroVisuals = new Map(); // instanceId -> visual object
    this._timers = [];
    this._tweens = [];
    this._transients = [];
    this._sessionId = 0;
    this._active = false;
    this._speedMultiplier = 1;

    // Bound event handlers (stored for cleanup)
    this._handlers = {};
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start() {
    if (this._active) this.stop();

    this._active = true;
    this._sessionId++;
    const session = this._sessionId;

    this._heroVisuals = new Map();
    this._timers = [];
    this._tweens = [];
    this._transients = [];

    // Set battle mode on map
    this._dungeonMapUI.setBattleMode(true);

    // Bind BattleManager events
    this._bind('heroSpawn',       (data) => this._onHeroSpawn(data, session));
    this._bind('heroMove',        (data) => this._onHeroMove(data, session));
    this._bind('heroArrive',      (data) => this._onHeroArrive(data, session));
    this._bind('combatStart',     (data) => this._onCombatStart(data, session));
    this._bind('attack',          (data) => this._onAttack(data, session));
    this._bind('bossHit',         (data) => this._onBossHit(data, session));
    this._bind('trapTrigger',     (data) => this._onTrapTrigger(data, session));
    this._bind('monsterDefeated', (data) => this._onMonsterDefeated(data, session));
    this._bind('heroDefeated',    (data) => this._onHeroDefeated(data, session));
    this._bind('battleEnd',       (data) => this._onBattleEnd(data, session));
    this._bind('dotDamage',       (data) => this._onDotDamage(data, session));
  }

  update(dt) {
    if (!this._active) return;

    const heroes = this._battleManager.getHeroes();
    const heroMap = new Map(heroes.map(h => [h.instanceId, h]));

    for (const [instanceId, visual] of this._heroVisuals) {
      const hero = heroMap.get(instanceId);
      if (!hero) continue;
      if (hero.state === 'dead' || hero.state === 'captured') continue;

      // Lerp position during move
      if (hero.state === 'moving' && visual.lerpFrom && visual.lerpTo) {
        const progress = Math.min(1, hero.moveTimer / (hero.effectiveMoveDuration || MOVE_DURATION));
        const x = visual.lerpFrom.x + (visual.lerpTo.x - visual.lerpFrom.x) * progress;
        const y = visual.lerpFrom.y + (visual.lerpTo.y - visual.lerpFrom.y) * progress;
        visual.container.setPosition(x, y);
      }

      // HP bar: update for all alive heroes regardless of state
      const ratio = Math.max(0, hero.hp / hero.maxHp);
      visual.hpFill.width = ratio * HP_BAR_W;
      visual.hpFill.fillColor = ratio > 0.5 ? 0x27ae60 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c;

      // Debuff stroke: slow (blue) takes priority over dot (green); clear if none
      const hasSlow = hero.debuffs && hero.debuffs.some(d => d.type === 'slow');
      const hasDot  = hero.debuffs && hero.debuffs.some(d => d.type === 'dot');
      if (hasSlow) {
        visual.circle.setStrokeStyle(2, 0x3498db);
      } else if (hasDot) {
        visual.circle.setStrokeStyle(2, 0x2ecc71);
      } else {
        visual.circle.setStrokeStyle(0);
      }
    }
  }

  stop() {
    if (!this._active) return;
    this._active = false;

    // Increment session to invalidate stale callbacks
    this._sessionId++;

    // Unbind all events
    for (const [event, handler] of Object.entries(this._handlers)) {
      this._battleManager.off(event, handler);
    }
    this._handlers = {};

    // Cancel all timers
    for (const timer of this._timers) {
      if (timer && timer.remove) timer.remove();
    }
    this._timers = [];

    // Stop all tweens
    for (const tween of this._tweens) {
      if (tween && tween.isPlaying && tween.isPlaying()) tween.stop();
    }
    this._tweens = [];

    // Destroy hero visuals
    for (const [, visual] of this._heroVisuals) {
      if (visual.container && visual.container.scene) {
        visual.container.destroy();
      }
    }
    this._heroVisuals = new Map();

    // Destroy transient display objects (popups, banners, captured text)
    for (const obj of this._transients) {
      if (obj && obj.scene) obj.destroy();
    }
    this._transients = [];

    // Clean up map
    this._dungeonMapUI.clearBattleHighlights();
    this._dungeonMapUI.setBattleMode(false);
  }

  // ---------------------------------------------------------------------------
  // Event binding helper
  // ---------------------------------------------------------------------------

  _bind(event, handler) {
    this._handlers[event] = handler;
    this._battleManager.on(event, handler);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  _onHeroSpawn({ hero }, session) {
    if (this._sessionId !== session) return;

    // Get portal position
    const portalCell = this._gameState.dungeonGrid.find(c => c.type === 'portal');
    const pos = portalCell ? portalCell.position : { x: 100, y: 100 };

    const mapCont = this._dungeonMapUI.getMapWorldContainer();
    const scene = this._scene;
    const color = HERO_COLORS[hero.typeId] || 0xffffff;

    // Container at portal position
    const container = scene.add.container(pos.x, pos.y);

    // Circle
    const circle = scene.add.arc(0, -4, HERO_RADIUS, 0, 360, false, color, 1);

    // Letter (first char of typeId)
    const letter = scene.add.text(0, -4, (hero.typeId[0] || '?').toUpperCase(), {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // HP bar background (gray)
    const hpBg = scene.add.rectangle(0, HERO_RADIUS + 4, HP_BAR_W, HP_BAR_H, 0x444444);
    hpBg.setOrigin(0.5, 0);

    // HP bar fill (green)
    const hpFill = scene.add.rectangle(
      -HP_BAR_W / 2, HERO_RADIUS + 4,
      HP_BAR_W, HP_BAR_H,
      0x27ae60
    );
    hpFill.setOrigin(0, 0);

    container.add([hpBg, hpFill, circle, letter]);
    mapCont.add(container);

    this._heroVisuals.set(hero.instanceId, {
      container,
      circle,
      letter,
      hpBg,
      hpFill,
      lerpFrom: null,
      lerpTo: null,
    });
  }

  _onHeroMove({ hero, fromCellId, toCellId }, session) {
    if (this._sessionId !== session) return;

    const visual = this._heroVisuals.get(hero.instanceId);
    if (!visual) return;

    const from = this._dungeonMapUI.getCellPosition(fromCellId);
    const to = this._dungeonMapUI.getCellPosition(toCellId);
    if (!from || !to) return;

    visual.lerpFrom = from;
    visual.lerpTo = to;
  }

  _onHeroArrive({ hero, cellId }, session) {
    if (this._sessionId !== session) return;

    const visual = this._heroVisuals.get(hero.instanceId);
    if (!visual) return;

    // Snap to cell position
    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) visual.container.setPosition(pos.x, pos.y);

    // Clear lerp cache
    visual.lerpFrom = null;
    visual.lerpTo = null;
  }

  _onCombatStart({ cellId }, session) {
    if (this._sessionId !== session) return;
    this._dungeonMapUI.setCellHighlight(cellId, 0xff0000);
  }

  _onAttack({ attackerType, targetType, targetId, damage, cellId }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    if (attackerType === 'boss') {
      // Boss attacks hero: show popup at hero visual position
      const visual = this._heroVisuals.get(targetId);
      if (visual) {
        const pos = visual.container;
        this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#e74c3c');
      }
    } else if (targetType === 'hero') {
      // Monster attacks hero
      const visual = this._heroVisuals.get(targetId);
      if (visual) {
        const pos = visual.container;
        this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#e74c3c');
      }
    } else if (targetType === 'monster') {
      // Hero attacks monster: show popup at cell position
      const pos = this._dungeonMapUI.getCellPosition(cellId);
      if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#ffffff');
    }
  }

  _onBossHit({ hero, damage }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    // Show popup at heart cell position
    const heartCell = this._gameState.dungeonGrid.find(c => c.type === 'heart');
    if (heartCell) {
      this._spawnDamagePopup(heartCell.position.x, heartCell.position.y - 20, damage, '#9b59b6');
    }
  }

  _onTrapTrigger({ cellId, damage }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#f39c12');
  }

  _onDotDamage({ hero, cellId, damage }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#2ecc71');
  }

  _onMonsterDefeated({ cellId }, session) {
    if (this._sessionId !== session) return;

    // Clear red highlight and restore default
    this._dungeonMapUI.setCellHighlight(cellId, null);

    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    // Flash green for 300ms
    this._dungeonMapUI.setCellHighlight(cellId, 0x00ff44);
    const timer = this._scene.time.delayedCall(300, () => {
      if (this._sessionId !== session) return;
      this._dungeonMapUI.setCellHighlight(cellId, null);
    });
    this._timers.push(timer);
  }

  _onHeroDefeated({ hero, cellId, captured }, session) {
    if (this._sessionId !== session) return;

    const visual = this._heroVisuals.get(hero.instanceId);
    if (!visual) return;

    // Clear cell highlight if hero was fighting there
    if (cellId) this._dungeonMapUI.setCellHighlight(cellId, null);

    if (captured) {
      // Show "Captured!" text at hero position
      const scene = this._scene;
      const capturedText = scene.add.text(
        visual.container.x,
        visual.container.y - 30,
        'Captured!',
        { fontSize: '12px', color: '#f1c40f', fontFamily: 'monospace' }
      ).setOrigin(0.5).setDepth(2001);

      this._dungeonMapUI.getMapWorldContainer().add(capturedText);
      this._transients.push(capturedText);

      const tween = scene.tweens.add({
        targets: capturedText,
        alpha: 0,
        y: capturedText.y - 20,
        duration: 1000,
        onComplete: () => { capturedText.destroy(); },
      });
      this._tweens.push(tween);
    }

    // Fade out hero visual
    const tween = this._scene.tweens.add({
      targets: visual.container,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        if (visual.container && visual.container.scene) {
          visual.container.destroy();
        }
        this._heroVisuals.delete(hero.instanceId);
      },
    });
    this._tweens.push(tween);
  }

  _onBattleEnd({ result, kills, goldEarned }, session) {
    if (this._sessionId !== session) return;

    const scene = this._scene;
    const { width, height } = scene.scale;

    const isSuccess = result === 'defenseSuccess';
    const titleStr = isSuccess ? '防禦成功！' : '魔王被突破！';
    const titleColor = isSuccess ? '#2ecc71' : '#e74c3c';
    const subStr = isSuccess
      ? `擊殺 ${kills} 獲得 ${goldEarned}G`
      : '英雄突破了防線';

    // Banner container
    const bannerCont = scene.add.container(width / 2, height / 2);
    bannerCont.setDepth(2100);
    bannerCont.setAlpha(0);
    this._transients.push(bannerCont);

    const bg = scene.add.rectangle(0, 0, 280, 100, 0x000000, 0.85)
      .setStrokeStyle(2, isSuccess ? 0x2ecc71 : 0xe74c3c);

    const titleText = scene.add.text(0, -22, titleStr, {
      fontSize: '22px', color: titleColor, fontFamily: 'serif', fontStyle: 'bold',
    }).setOrigin(0.5);

    const subText = scene.add.text(0, 16, subStr, {
      fontSize: '14px', color: '#cccccc', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    bannerCont.add([bg, titleText, subText]);

    // Fade in 300ms
    const fadeInTween = scene.tweens.add({
      targets: bannerCont,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        if (this._sessionId !== session) {
          bannerCont.destroy();
          return;
        }
        // Hold 1.2s then emit battleUiComplete
        const holdTimer = scene.time.delayedCall(1200, () => {
          bannerCont.destroy();
          if (this._sessionId !== session) return;
          scene.events.emit('battleUiComplete');
        });
        this._timers.push(holdTimer);
      },
    });
    this._tweens.push(fadeInTween);
  }

  // ---------------------------------------------------------------------------
  // Damage popup
  // ---------------------------------------------------------------------------

  _spawnDamagePopup(x, y, damage, color) {
    const scene = this._scene;
    const text = scene.add.text(x, y, `-${damage}`, {
      fontSize: '14px',
      color: color || '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2000);

    // Add to map world container so it scrolls with map
    this._dungeonMapUI.getMapWorldContainer().add(text);
    this._transients.push(text);

    const tween = scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power1',
      onComplete: () => { text.destroy(); },
    });
    this._tweens.push(tween);
  }
}
