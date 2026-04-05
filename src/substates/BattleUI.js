// BattleUI.js
// Visual layer for BattleManager: hero circles, HP bars, damage popups, result banner.

import { MOVE_DURATION, FONT_FAMILY } from '../utils/constants.js';
import SpriteHelper from '../utils/SpriteHelper.js';
import sfx from '../utils/SFXManager.js';

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
    this._dungeonMapUI.showRoomBuffIndicators();

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
    this._bind('trapParry',       (data) => this._onTrapParry(data, session));
    this._bind('trapSkip',        (data) => this._onTrapSkip(data, session));
    this._bind('burnDamage',      (data) => this._onBurnDamage(data, session));
    this._bind('bossSkill',       (data) => this._onBossSkill(data, session));
    this._bind('bossSkillEnd',    (data) => this._onBossSkillEnd(data, session));
    this._bind('heroHeal',        (data) => this._onHeroHeal(data, session));
    this._bind('heroShield',      (data) => this._onHeroShield(data, session));
    this._bind('goldSteal',       (data) => this._onGoldSteal(data, session));
    this._bind('goldReturn',      (data) => this._onGoldReturn(data, session));
    this._bind('bossPhaseChange', (data) => this._onBossPhaseChange(data, session));
    this._bind('bossSummon',      (data) => this._onBossSummon(data, session));
    this._bind('summonAttack',    (data) => this._onSummonAttack(data, session));

    // Draw forecast route for first hero's path
    const routes = this._battleManager.getHeroRoutes();
    if (routes.length > 0) {
      this._dungeonMapUI.drawForecastRoute(routes[0]);
    }
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
        visual.statusRing.setStrokeStyle(2, 0x3498db);
      } else if (hasDot) {
        visual.statusRing.setStrokeStyle(2, 0x2ecc71);
      } else {
        visual.statusRing.setStrokeStyle(0);
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

    // Stop all tweens (including paused ones like floatTween during move)
    for (const tween of this._tweens) {
      if (tween && tween.stop) tween.stop();
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
    this._dungeonMapUI.hideRoomBuffIndicators();
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
    const pos = portalCell ? (portalCell.visualPos ?? portalCell.position) : { x: 100, y: 100 };

    const mapCont = this._dungeonMapUI.getMapWorldContainer();
    const scene = this._scene;
    const isHighSpeed = this._battleManager.getSpeedMultiplier() >= 10;

    // Container at portal position
    const container = scene.add.container(pos.x, pos.y);

    // Derive sprite keys
    const baseId = hero.typeId.startsWith('hero_') ? hero.typeId : `hero_${hero.typeId}`;
    const walkKey = `${baseId}_walk`;

    // Idle sprite (static image)
    const idleSprite = SpriteHelper.createSprite(scene, baseId, 0, -4, 24);

    // Walk sprite (spritesheet, hidden by default)
    let walkSprite = null;
    if (scene.anims.exists(walkKey)) {
      walkSprite = scene.add.sprite(0, -4, walkKey).setOrigin(0.5);
      walkSprite.displayWidth = 24;
      walkSprite.displayHeight = 24;
      walkSprite.setVisible(false);
    }

    // Status ring for debuff indicators (transparent by default)
    const statusRing = scene.add.arc(0, -4, 14, 0, 360, false, 0x000000, 0);

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

    const children = [hpBg, hpFill, idleSprite, statusRing];
    if (walkSprite) children.splice(2, 0, walkSprite); // walk behind idle
    container.add(children);
    mapCont.add(container);

    // Float tween (idle breathing) — skip in high speed mode
    let floatTween = null;
    if (!isHighSpeed) {
      floatTween = scene.tweens.add({
        targets: idleSprite,
        y: -6,
        scaleY: 1.03,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this._tweens.push(floatTween);
    }

    this._heroVisuals.set(hero.instanceId, {
      container,
      sprite: idleSprite, // backward compat for existing HP/debuff code
      idleSprite,
      walkSprite,
      statusRing,
      hpBg,
      hpFill,
      floatTween,
      hurtTween: null,
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

    // Skip walk animation in high speed mode
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    // Switch to walk sprite
    if (visual.walkSprite) {
      visual.idleSprite.setVisible(false);
      visual.walkSprite.setVisible(true);
      visual.walkSprite.setFlipX(to.x < from.x);

      const walkKey = visual.walkSprite.texture.key;
      if (this._scene.anims.exists(walkKey)) {
        visual.walkSprite.play(walkKey);
      }
    }

    // Pause float tween
    if (visual.floatTween && visual.floatTween.isPlaying()) {
      visual.floatTween.pause();
    }
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

    // ALWAYS normalize visible state (even in high speed — speed may change mid-run)
    if (visual.walkSprite) {
      visual.walkSprite.stop();
      visual.walkSprite.setVisible(false);
    }
    visual.idleSprite.setVisible(true);

    // Resume float tween (only if it exists and is paused)
    if (visual.floatTween && !visual.floatTween.isPlaying()) {
      visual.floatTween.resume();
    }
  }

  /** Flash red + shake for hero taking damage. */
  _playHurtEffect(heroInstanceId) {
    const visual = this._heroVisuals.get(heroInstanceId);
    if (!visual) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const scene = this._scene;

    // Determine which sprite is visible
    const targetSprite = (visual.walkSprite && visual.walkSprite.visible)
      ? visual.walkSprite : visual.idleSprite;

    // Red tint flash
    targetSprite.setTint(0xff0000);
    const tintTimer = scene.time.delayedCall(100, () => {
      if (targetSprite.scene) targetSprite.clearTint();
    });
    this._timers.push(tintTimer);

    // Kill existing hurt tween and reset both sprites' x offset
    // (previous tween may have targeted the other sprite)
    if (visual.hurtTween && visual.hurtTween.isPlaying()) {
      visual.hurtTween.stop();
    }
    visual.idleSprite.x = 0;
    if (visual.walkSprite) visual.walkSprite.x = 0;

    // Shake the sprite (not container — container.x is mutated by lerp in update())
    visual.hurtTween = scene.tweens.add({
      targets: targetSprite,
      x: 2,
      duration: 50,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.InOut',
      onComplete: () => {
        targetSprite.x = 0;
      },
    });
    this._tweens.push(visual.hurtTween);
  }

  _onCombatStart({ cellId }, session) {
    if (this._sessionId !== session) return;
    this._dungeonMapUI.setCellHighlight(cellId, 0xff0000);
    // Pulse animation on the combat cell highlight
    this._pulseCellHighlight(cellId);
  }

  _pulseCellHighlight(cellId) {
    const cont = this._dungeonMapUI._cellContainers?.find(c => c.getData('cellId') === cellId);
    if (!cont) return;
    const border = cont.getData('highlightBorder');
    if (!border) return;
    // Stop any existing pulse on this border
    if (border._pulseTween) border._pulseTween.stop();
    border._pulseTween = this._scene.tweens.add({
      targets: border,
      alpha: { from: 1, to: 0.3 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this._tweens.push(border._pulseTween);
  }

  _onAttack({ attackerType, targetType, targetId, damage, cellId, holyBonus }, session) {
    if (this._sessionId !== session) return;
    sfx.play('battle_hit');
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    if (attackerType === 'boss') {
      // Boss attacks hero: show popup at hero visual position
      const visual = this._heroVisuals.get(targetId);
      if (visual) {
        const pos = visual.container;
        this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#e74c3c');
        this._playHurtEffect(targetId);
      }
    } else if (targetType === 'hero') {
      // Monster attacks hero
      const visual = this._heroVisuals.get(targetId);
      if (visual) {
        const pos = visual.container;
        this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#e74c3c');
        this._playHurtEffect(targetId);
      }
    } else if (targetType === 'monster') {
      // Hero attacks monster: show popup at cell position
      const color = holyBonus ? '#ffd700' : '#ffffff';
      const pos = this._dungeonMapUI.getCellPosition(cellId);
      if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, color);
    }
  }

  _onBossHit({ hero: _hero, damage, shielded }, session) {
    if (this._sessionId !== session) return;
    sfx.play('battle_hit');
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    // 護盾 active 時在數字後加標記
    const heartCell = this._gameState.dungeonGrid.find(c => c.type === 'heart');
    if (heartCell) {
      const label = shielded ? `${damage}(護盾)` : damage;
      const hp = heartCell.visualPos ?? heartCell.position;
      this._spawnDamagePopup(hp.x, hp.y - 20, label, '#9b59b6');
    }
  }

  _onTrapTrigger({ cellId, damage }, session) {
    if (this._sessionId !== session) return;
    sfx.play('trap_trigger');
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#f39c12');
  }

  _onDotDamage({ hero: _hero, cellId, damage }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#2ecc71');
  }

  _onTrapParry({ hero: _hero, cellId }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;
    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, 'Parry!', '#ffffff');
  }

  _onTrapSkip({ hero: _hero, cellId }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;
    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, 'Skip!', '#00bcd4');
  }

  _onBurnDamage({ hero: _hero, cellId, damage }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;
    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, damage, '#e67e22');
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

    // Stop walk animation if moving when killed
    if (visual.walkSprite && visual.walkSprite.visible) {
      visual.walkSprite.stop();
      visual.walkSprite.setVisible(false);
      visual.idleSprite.setVisible(true);
    }

    // Stop float tween
    if (visual.floatTween && visual.floatTween.isPlaying()) {
      visual.floatTween.stop();
    }

    // Stop hurt tween
    if (visual.hurtTween && visual.hurtTween.isPlaying()) {
      visual.hurtTween.stop();
    }

    if (captured) {
      // Show "Captured!" text at hero position
      const scene = this._scene;
      const capturedText = scene.add.text(
        visual.container.x,
        visual.container.y - 30,
        'Captured!',
        { fontSize: '12px', color: '#f1c40f', fontFamily: FONT_FAMILY }
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

    // Fade out + sink hero visual
    const tween = this._scene.tweens.add({
      targets: visual.container,
      alpha: 0,
      y: visual.container.y + 10,
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

  _onGoldSteal({ cellId, amount }, session) {
    if (this._sessionId !== session) return;
    sfx.play('coin');
    if (this._battleManager.getSpeedMultiplier() >= 10) return;
    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, `-${amount}G`, '#f1c40f');
    if (this._scene.topHUD) this._scene.topHUD.update();
  }

  _onGoldReturn({ cellId, amount }, session) {
    if (this._sessionId !== session) return;
    sfx.play('coin');
    const pos = this._dungeonMapUI.getCellPosition(cellId);
    if (pos) this._spawnDamagePopup(pos.x, pos.y - 20, `+${amount}G`, '#2ecc71');
    if (this._scene.topHUD) this._scene.topHUD.update();
  }

  _onBattleEnd({ result, kills, goldEarned }, session) {
    if (this._sessionId !== session) return;
    this._dungeonMapUI.clearForecastRoute();
    sfx.play(result === 'defenseSuccess' ? 'victory' : 'defeat');

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
      fontSize: '22px', color: titleColor, fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0.5);

    const subText = scene.add.text(0, 16, subStr, {
      fontSize: '14px', color: '#cccccc', fontFamily: FONT_FAMILY,
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

  _onBossSkill({ skillId, skillName }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;
    sfx.play('boss_appear');

    const heartCell = this._gameState.dungeonGrid.find(c => c.type === 'heart');
    if (!heartCell) return;

    // 大字技能名 popup
    const scene = this._scene;
    const hcPos = heartCell.visualPos ?? heartCell.position;
    const text = scene.add.text(hcPos.x, hcPos.y - 40, skillName, {
      fontSize: '18px',
      color: skillId === 'shockwave' ? '#ff4444' : '#4488ff',
      fontFamily: FONT_FAMILY,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2000);
    this._dungeonMapUI.getMapWorldContainer().add(text);
    this._transients.push(text);

    const tween = scene.tweens.add({
      targets: text,
      y: hcPos.y - 80,
      alpha: 0,
      duration: 1200,
      ease: 'Power1',
      onComplete: () => { text.destroy(); },
    });
    this._tweens.push(tween);

    // 震盪波加鏡頭搖晃
    if (skillId === 'shockwave') {
      scene.cameras.main.shake(200, 0.005);
    }
  }

  _onBossSkillEnd(_data, session) {
    if (this._sessionId !== session) return;
    // 護盾結束：未來可在此加視覺回饋
  }

  _onBossPhaseChange({ phase }, session) {
    if (this._sessionId !== session) return;

    const scene = this._scene;
    const { width, height } = scene.scale;

    // Full-screen overlay + warning text
    const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setDepth(2200);
    const text = scene.add.text(width / 2, height / 2, '魔王狂暴化！', {
      fontSize: '32px',
      color: '#ff2222',
      fontFamily: FONT_FAMILY,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2201);
    this._transients.push(overlay, text);

    // Fade out after 1.5s
    const timer = scene.time.delayedCall(1500, () => {
      if (this._sessionId !== session) return;
      scene.tweens.add({
        targets: [overlay, text],
        alpha: 0,
        duration: 300,
        onComplete: () => { overlay.destroy(); text.destroy(); },
      });
    });
    this._timers.push(timer);

    // Tint boss area: change heart cell highlight to red
    const heartCell = this._gameState.dungeonGrid.find(c => c.type === 'heart');
    if (heartCell) {
      this._dungeonMapUI.setCellHighlight(heartCell.id, 0xff2222);
    }
  }

  _onBossSummon({ skillName }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const heartCell = this._gameState.dungeonGrid.find(c => c.type === 'heart');
    if (!heartCell) return;

    const scene = this._scene;
    const hsPos = heartCell.visualPos ?? heartCell.position;
    const text = scene.add.text(hsPos.x, hsPos.y - 40, skillName, {
      fontSize: '18px',
      color: '#9b59b6',
      fontFamily: FONT_FAMILY,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2000);
    this._dungeonMapUI.getMapWorldContainer().add(text);
    this._transients.push(text);

    scene.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  _onSummonAttack({ targetId, damage }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const visual = this._heroVisuals.get(targetId);
    if (visual) {
      this._spawnDamagePopup(visual.container.x, visual.container.y - 20, damage, '#9b59b6');
      this._playHurtEffect(targetId);
    }
  }

  _onHeroHeal({ target: _target, amount, cellId }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    // Show heal popup at target's cell position (or heart cell for boss fight)
    const heartCell = this._gameState.dungeonGrid.find(c => c.type === 'heart');
    const pos = cellId ? this._dungeonMapUI.getCellPosition(cellId) : null;
    const hfp = heartCell ? (heartCell.visualPos ?? heartCell.position) : null;
    const displayPos = pos || (hfp ? { x: hfp.x, y: hfp.y } : null);
    if (displayPos) {
      this._spawnDamagePopup(displayPos.x, displayPos.y - 20, `+${amount}`, '#2ecc71');
    }
  }

  _onHeroShield({ target, amount }, session) {
    if (this._sessionId !== session) return;
    if (this._battleManager.getSpeedMultiplier() >= 10) return;

    const visual = this._heroVisuals.get(target.instanceId);
    if (visual) {
      this._spawnDamagePopup(visual.container.x, visual.container.y - 30, `護盾+${amount}`, '#3498db');
    }
  }

  // ---------------------------------------------------------------------------
  // Damage popup
  // ---------------------------------------------------------------------------

  _spawnDamagePopup(x, y, damage, color) {
    const scene = this._scene;
    const label = typeof damage === 'string' ? damage : `-${damage}`;
    const text = scene.add.text(x, y, label, {
      fontSize: '14px',
      color: color || '#ffffff',
      fontFamily: FONT_FAMILY,
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
