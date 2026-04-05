import Phaser from 'phaser';
import GameState from '../models/GameState.js';
import FlipMatrixUI from '../substates/FlipMatrixUI.js';
import FlipEventHandler from '../substates/FlipEventHandler.js';
import CardPickUI from '../substates/CardPickUI.js';
import TopHUD from '../substates/TopHUD.js';
import DungeonMapUI from '../substates/DungeonMapUI.js';
import BattleManager from '../models/BattleManager.js';
import BattleUI from '../substates/BattleUI.js';
import TortureUI from '../substates/TortureUI.js';
import MonsterListUI from '../substates/MonsterListUI.js';
import BestiaryUI from '../substates/BestiaryUI.js';
import { EVENT_TYPES } from '../utils/constants.js';
import { buildUnlockedPool } from '../utils/buildUnlockedPool.js';

// Substate keys
const SUBSTATES = ['flipMatrix', 'dungeonMap', 'cardPick', 'battle', 'torture', 'monsterList', 'bestiary'];

// Substates that participate in tab switching (cardPick and battle are modal/overlay)
const TAB_SUBSTATES = ['flipMatrix', 'dungeonMap', 'torture', 'monsterList', 'bestiary'];

// Tab bar entries
const TAB_DEFS = [
  { label: '翻牌', key: 'flipMatrix' },
  { label: '地圖', key: 'dungeonMap' },
  { label: '刑房', key: 'torture' },
  { label: '怪物', key: 'monsterList' },
  { label: '圖鑑', key: 'bestiary' },
];

const TAB_BAR_H = 56;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Retrieve shared state from registry
    this.dataManager = this.registry.get('dataManager');
    this.metaState = this.registry.get('metaState');
    if (this.metaState) this.metaState.beginRun();

    // Initialize game state for this run
    this.gameState = new GameState(this.metaState, this.dataManager);
    this.registry.set('gameState', this.gameState);

    // Scene-level interaction lock counter (supports nested lock/unlock)
    this._interactionLockCount = 0;

    // Substate navigation history
    this._substateHistory = [];

    // Build substate containers
    this.containers = {};
    const contentH = height - TAB_BAR_H;

    SUBSTATES.forEach((key) => {
      const container = this.add.container(0, 0);

      // Skip placeholder for substates with dedicated UI classes
      if (key !== 'flipMatrix' && key !== 'dungeonMap' && key !== 'torture' && key !== 'monsterList' && key !== 'bestiary') {
        const bg = this.add.rectangle(width / 2, contentH / 2, width, contentH, 0x1a1a2e);
        const label = this.add.text(width / 2, contentH / 2, key, {
          fontSize: '24px', color: '#9999bb', fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add([bg, label]);
      }

      container.setVisible(false);
      this.containers[key] = container;
    });

    // --- Build FlipMatrix UI ---
    this.flipMatrixUI = new FlipMatrixUI(this, this.gameState);
    this.containers.flipMatrix.add(this.flipMatrixUI.getContainer());

    // --- Build Top HUD (scene-level, not tied to any substate) ---
    this.topHUD = new TopHUD(this, this.gameState);
    this.topHUD.getContainer().setDepth(1000);

    // --- Build DungeonMap UI ---
    this.dungeonMapUI = new DungeonMapUI(this, this.gameState);
    this.containers.dungeonMap.add(this.dungeonMapUI.getContainer());

    // --- Build Battle Manager ---
    this.battleManager = new BattleManager(this.gameState, this.dataManager);

    // --- Build Battle UI ---
    this.battleUI = new BattleUI(this, this.battleManager, this.gameState, this.dungeonMapUI);

    // --- Build Torture UI ---
    this.tortureUI = new TortureUI(this, this.gameState);
    this.containers.torture.add(this.tortureUI.getContainer());

    this.battleManager.on('tortureConversion', (data) => this.tortureUI.onConversion(data));
    this.battleManager.on('battleEnd', () => this.tortureUI.onBattleEnd());

    // --- Build MonsterList UI ---
    this.monsterListUI = new MonsterListUI(this, this.gameState, this.dataManager);
    this.containers.monsterList.add(this.monsterListUI.getContainer());

    // --- Build Bestiary UI ---
    this.bestiaryUI = new BestiaryUI(this, this.metaState, this.gameState, this.dataManager);
    this.containers.bestiary.add(this.bestiaryUI.getContainer());

    // --- Build Event Handler ---
    this.flipEventHandler = new FlipEventHandler(this, this.gameState, this);

    // Wire flip callback
    this.flipMatrixUI.onFlip((card, unlockCallback) => {
      this.lockInteraction();
      this.topHUD.update();
      this.flipEventHandler.handleEvent(card, () => {
        this.topHUD.update();
        this.unlockInteraction();
        unlockCallback();
      });
    });

    // --- Build CardPick UI ---
    this.cardPickUI = new CardPickUI(this, this.gameState);
    this.cardPickUI.setContainer(this.containers.cardPick);

    // Wire draw button
    this.topHUD.onDraw(() => {
      if (this._interactionLockCount > 0) return;
      const cost = this.gameState.getDrawCost();
      if (this.gameState.gold < cost) return;
      this.gameState.gold -= cost;
      this.gameState.drawCount++;
      this.topHUD.update();
      this.openCardPick({ source: 'paidDraw', cost }, () => {
        this.topHUD.update();
      });
    });

    // --- Build Battle Overlay stub ---
    this._buildBattleOverlay(width, contentH);

    // --- Build Tab Bar ---
    this._buildTabBar(width, height);

    // Show default substate
    this.currentSubstate = null;
    this.switchSubstate('flipMatrix');
  }

  // --- Substate Navigation ---

  switchSubstate(name) {
    if (this._interactionLockCount > 0) return;
    if (!SUBSTATES.includes(name)) {
      console.warn(`[GameScene] Unknown substate: ${name}`);
      return;
    }
    if (this.currentSubstate === name) return;

    // Push current to history (max 5)
    if (this.currentSubstate) {
      this._substateHistory.push(this.currentSubstate);
      if (this._substateHistory.length > 5) this._substateHistory.shift();
    }

    // Hide tab-switchable containers only (not modal/overlay)
    TAB_SUBSTATES.forEach((key) => {
      this.containers[key].setVisible(false);
    });

    this.containers[name].setVisible(true);
    this.currentSubstate = name;
    this._updateTabHighlight(name);

    // Refresh DungeonMapUI hand area when switching to dungeonMap
    if (name === 'dungeonMap' && this.dungeonMapUI) {
      this.dungeonMapUI.refresh();
    }

    if (name === 'torture' && this.tortureUI) {
      this.tortureUI.rebuild();
      this.tortureUI.onShown();
    }

    if (name === 'monsterList' && this.monsterListUI) {
      this.monsterListUI.rebuild();
    }

    if (name === 'bestiary' && this.bestiaryUI) {
      this.bestiaryUI.rebuild();
    }
  }

  returnToPreviousSubstate() {
    const prev = this._substateHistory.pop();
    if (prev) {
      this.currentSubstate = null; // Reset to allow switch
      this.switchSubstateForced(prev);
    }
  }

  lockInteraction() {
    this._interactionLockCount++;
  }

  unlockInteraction() {
    this._interactionLockCount = Math.max(0, this._interactionLockCount - 1);
  }

  // Force a substate switch regardless of interaction lock (for internal system use)
  switchSubstateForced(name) {
    const saved = this._interactionLockCount;
    this._interactionLockCount = 0;
    this.switchSubstate(name);
    this._interactionLockCount = saved;
  }

  // --- Phaser update loop ---

  update(time, delta) {
    if (this.battleManager && this.battleManager.isActive()) {
      this.battleManager.update(delta);
      const alive = this.battleManager.getHeroes().filter(h => h.state !== 'dead' && h.state !== 'captured').length;
      if (this._battleHeroCountText) this._battleHeroCountText.setText(`存活: ${alive}`);
    }
    if (this.battleUI) {
      this.battleUI.update(delta);
    }
  }

  // --- Battle Overlay ---

  _buildBattleOverlay(width, height) {
    const container = this.containers.battle;
    container.removeAll(true);

    // --- Top bar (y=0..48): title + event type + hero alive count ---
    const topBg = this.add.rectangle(width / 2, 24, width, 48, 0x1a1a2e, 0.92)
      .setInteractive(); // blocks clicks on top bar

    const titleText = this.add.text(16, 24, '戰鬥中...', {
      fontSize: '18px', color: '#e74c3c', fontFamily: 'serif',
    }).setOrigin(0, 0.5);

    this._battleTypeText = this.add.text(width / 2, 24, '', {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this._battleHeroCountText = this.add.text(width - 12, 24, '', {
      fontSize: '13px', color: '#aaaaff', fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    // --- Middle zone (y=48..height-104): TRANSPARENT, no interactive ---
    // Intentionally no rectangle here so scroll/clicks pass through to map

    // --- Bottom bar (y=height-104..height-56): speed buttons + debug end ---
    const botBarY = height - 80; // center of the 48px bottom bar (height-104 to height-56)
    const botBg = this.add.rectangle(width / 2, botBarY, width, 48, 0x1a1a2e, 0.92)
      .setInteractive(); // blocks clicks on bottom bar

    // Speed buttons
    const btnDefs = [
      { label: 'x1',   x: 44,  speed: 1 },
      { label: 'x2',   x: 112, speed: 2 },
      { label: 'Skip', x: 188, speed: 10 },
    ];
    this._speedButtons = [];

    for (const def of btnDefs) {
      const btn = this.add.text(def.x, botBarY, `[${def.label}]`, {
        fontSize: '16px', color: '#aaaaff', fontFamily: 'monospace',
        backgroundColor: '#2d2d5e', padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        if (this.battleManager) this.battleManager.setSpeedMultiplier(def.speed);
        this._updateSpeedButtonHighlight(def.speed);
      });

      this._speedButtons.push({ btn, speed: def.speed });
    }

    // Debug: force end button
    const endBtn = this.add.text(width - 16, botBarY, '結束戰鬥', {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'sans-serif',
      backgroundColor: '#333333', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    endBtn.on('pointerdown', () => {
      if (this._onBattleEnd) this._onBattleEnd();
    });

    const speedBtns = this._speedButtons.map(s => s.btn);
    container.add([topBg, titleText, this._battleTypeText, this._battleHeroCountText, botBg, ...speedBtns, endBtn]);
    container.setVisible(false);
    container.setDepth(1500);
  }

  _updateSpeedButtonHighlight(activeSpeed) {
    if (!this._speedButtons) return;
    for (const { btn, speed } of this._speedButtons) {
      btn.setColor(speed === activeSpeed ? '#f1c40f' : '#aaaaff');
    }
  }

  showBattleOverlay(eventType) {
    const def = EVENT_TYPES[eventType];
    this._battleTypeText.setText(def ? def.label : eventType);
    this._battleHeroCountText.setText('');
    this._updateSpeedButtonHighlight(1);
    if (this.battleManager) this.battleManager.setSpeedMultiplier(1);
    this.containers.battle.setVisible(true);
    this.lockInteraction();
  }

  hideBattleOverlay() {
    this.containers.battle.setVisible(false);
    this._onBattleEnd = null;
    this.unlockInteraction();
  }

  // --- CardPick / Shop Modal ---

  openCardPick(request, onComplete) {
    this.cardPickUI.open(request, onComplete);
  }

  openShop(onComplete) {
    // Shop uses cardPick container as modal
    const container = this.containers.cardPick;
    container.removeAll(true);

    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    container.add(overlay);

    const title = this.add.text(width / 2, height / 4, '商店', {
      fontSize: '28px', color: '#2980b9', fontFamily: 'serif'
    }).setOrigin(0.5);
    container.add(title);

    // Generate up to 3 unique shop items (rooms + traps, filtered by unlock status)
    const unlockedRooms = buildUnlockedPool(this.dataManager.rooms, 'rooms', this.metaState);
    const unlockedTraps = buildUnlockedPool(this.dataManager.traps, 'traps', this.metaState);
    const pool = [
      ...unlockedRooms.map(r => ({ type: 'room', id: r.id, name: r.name, price: r.shopPrice || 100, label: '房間' })),
      ...unlockedTraps.map(t => ({ type: 'trap', id: t.id, name: t.name, price: t.shopPrice || 80, label: '陷阱' })),
    ];

    // Shuffle and take unique items
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const items = pool.slice(0, Math.min(3, pool.length));

    const cardW = 100;
    const gap = 16;
    const totalW = cardW * items.length + gap * (items.length - 1);
    const startX = (width - totalW) / 2 + cardW / 2;

    const shopItems = [];

    items.forEach((item, i) => {
      const x = startX + i * (cardW + gap);
      const y = height / 2;

      const bg = this.add.rectangle(x, y, cardW, 150, 0x34495e)
        .setStrokeStyle(2, 0x2980b9);

      const typeText = this.add.text(x, y - 50, item.label, {
        fontSize: '11px', color: '#95a5a6', fontFamily: 'sans-serif'
      }).setOrigin(0.5);

      const nameText = this.add.text(x, y - 30, item.name, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif'
      }).setOrigin(0.5);

      const priceText = this.add.text(x, y + 10, `${item.price}G`, {
        fontSize: '14px', color: '#f1c40f', fontFamily: 'monospace'
      }).setOrigin(0.5);

      const buyBtn = this.add.text(x, y + 50, '購買', {
        fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif',
        backgroundColor: '#27ae60', padding: { x: 12, y: 4 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      shopItems.push({ buyBtn, bg, item });

      buyBtn.on('pointerdown', () => {
        if (this.gameState.gold < item.price) return;
        this.gameState.gold -= item.price;
        const starRating = 1 + Math.floor(Math.random() * 2); // 1-2 for shop
        this.gameState.hand.push({ type: item.type, id: item.id, starRating });
        buyBtn.setText('已購買').setAlpha(0.5).disableInteractive();
        bg.setStrokeStyle(2, 0x555555);
        this.topHUD.update();
        // Refresh remaining buttons to reflect updated gold
        shopItems.forEach(si => {
          if (si.buyBtn !== buyBtn && si.buyBtn.input?.enabled !== false) {
            const canStillBuy = this.gameState.gold >= si.item.price;
            si.buyBtn.setAlpha(canStillBuy ? 1 : 0.4);
            if (!canStillBuy) si.buyBtn.disableInteractive();
          }
        });
      });

      // Set initial alpha based on affordability
      if (this.gameState.gold < item.price) {
        buyBtn.setAlpha(0.4).disableInteractive();
      }

      container.add([bg, typeText, nameText, priceText, buyBtn]);
    });

    // Leave button
    const leaveBtn = this.add.text(width / 2, height * 0.8, '離開', {
      fontSize: '18px', color: '#cccccc', fontFamily: 'sans-serif',
      backgroundColor: '#333333', padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    leaveBtn.on('pointerdown', () => {
      container.setVisible(false);
      container.removeAll(true);
      if (onComplete) onComplete();
    });

    container.add(leaveBtn);
    container.setVisible(true);
    container.setDepth(2000);
  }

  // --- Tab Bar ---

  _buildTabBar(width, height) {
    const barY = height - TAB_BAR_H;
    const tabW = width / TAB_DEFS.length;

    this.add.rectangle(width / 2, barY + TAB_BAR_H / 2, width, TAB_BAR_H, 0x2d2d4e);
    this.add.rectangle(width / 2, barY, width, 1, 0x444466);

    this.tabButtons = [];

    TAB_DEFS.forEach(({ label, key }, i) => {
      const centerX = tabW * i + tabW / 2;
      const centerY = barY + TAB_BAR_H / 2;

      const hitZone = this.add.rectangle(centerX, centerY, tabW, TAB_BAR_H, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(centerX, centerY, label, {
        fontSize: '16px', color: '#aaaacc', fontFamily: 'sans-serif',
      }).setOrigin(0.5);

      hitZone.on('pointerdown', () => {
        if (this._interactionLockCount > 0) return;
        this.switchSubstate(key);
      });

      hitZone.on('pointerover', () => {
        if (this.currentSubstate !== key) text.setColor('#ccccee');
      });
      hitZone.on('pointerout', () => {
        if (this.currentSubstate !== key) text.setColor('#aaaacc');
      });

      this.tabButtons.push({ key, text, hitZone });
    });
  }

  _updateTabHighlight(activeKey) {
    this.tabButtons.forEach(({ key, text }) => {
      text.setColor(key === activeKey ? '#ff6b6b' : '#aaaacc');
    });
  }
}
