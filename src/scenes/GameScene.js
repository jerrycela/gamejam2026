import Phaser from 'phaser';
import GameState from '../models/GameState.js';
import FlipMatrixUI from '../substates/FlipMatrixUI.js';
import FlipEventHandler from '../substates/FlipEventHandler.js';
import CardPickUI from '../substates/CardPickUI.js';
import TopHUD from '../substates/TopHUD.js';
import { EVENT_TYPES } from '../utils/constants.js';

// Substate keys
const SUBSTATES = ['flipMatrix', 'dungeonMap', 'cardPick', 'battle', 'torture', 'monsterList'];

// Substates that participate in tab switching (cardPick and battle are modal/overlay)
const TAB_SUBSTATES = ['flipMatrix', 'dungeonMap', 'torture', 'monsterList'];

// Tab bar entries
const TAB_DEFS = [
  { label: '翻牌', key: 'flipMatrix' },
  { label: '地圖', key: 'dungeonMap' },
  { label: '刑房', key: 'torture' },
  { label: '怪物', key: 'monsterList' },
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

    // Initialize game state for this run
    this.gameState = new GameState(this.metaState, this.dataManager);
    this.registry.set('gameState', this.gameState);

    // Substate navigation history
    this._substateHistory = [];

    // Build substate containers
    this.containers = {};
    const contentH = height - TAB_BAR_H;

    SUBSTATES.forEach((key) => {
      const container = this.add.container(0, 0);

      // Skip placeholder for flipMatrix (will be populated by FlipMatrixUI)
      if (key !== 'flipMatrix') {
        const bg = this.add.rectangle(width / 2, contentH / 2, width, contentH, 0x1a1a2e);
        const label = this.add.text(width / 2, contentH / 2, key, {
          fontSize: '24px', color: '#555577', fontFamily: 'monospace',
        }).setOrigin(0.5);
        container.add([bg, label]);
      }

      container.setVisible(false);
      this.containers[key] = container;
    });

    // --- Build FlipMatrix UI ---
    this.flipMatrixUI = new FlipMatrixUI(this, this.gameState);
    this.containers.flipMatrix.add(this.flipMatrixUI.getContainer());

    // --- Build Top HUD ---
    this.topHUD = new TopHUD(this, this.gameState);
    this.containers.flipMatrix.add(this.topHUD.getContainer());

    // --- Build Event Handler ---
    this.flipEventHandler = new FlipEventHandler(this, this.gameState, this);

    // Wire flip callback
    this.flipMatrixUI.onFlip((card, unlockCallback) => {
      this.topHUD.update();
      this.flipEventHandler.handleEvent(card, () => {
        this.topHUD.update();
        unlockCallback();
      });
    });

    // --- Build CardPick UI ---
    this.cardPickUI = new CardPickUI(this, this.gameState);
    this.cardPickUI.setContainer(this.containers.cardPick);

    // Wire draw button
    this.topHUD.onDraw(() => {
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
  }

  returnToPreviousSubstate() {
    const prev = this._substateHistory.pop();
    if (prev) {
      this.currentSubstate = null; // Reset to allow switch
      this.switchSubstate(prev);
    }
  }

  // --- Battle Overlay (stub) ---

  _buildBattleOverlay(width, contentH) {
    const container = this.containers.battle;
    container.removeAll(true);

    const overlay = this.add.rectangle(width / 2, contentH / 2, width, contentH, 0x000000, 0.6);
    const title = this.add.text(width / 2, contentH / 2 - 40, '戰鬥中...', {
      fontSize: '28px', color: '#e74c3c', fontFamily: 'serif'
    }).setOrigin(0.5);

    this._battleTypeText = this.add.text(width / 2, contentH / 2, '', {
      fontSize: '16px', color: '#cccccc', fontFamily: 'monospace'
    }).setOrigin(0.5);

    const endBtn = this.add.text(width / 2, contentH / 2 + 60, '結束戰鬥', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: '#27ae60', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    endBtn.on('pointerdown', () => {
      if (this._onBattleEnd) this._onBattleEnd();
    });

    container.add([overlay, title, this._battleTypeText, endBtn]);
    container.setVisible(false);
    container.setDepth(1500);
  }

  showBattleOverlay(eventType) {
    const def = EVENT_TYPES[eventType];
    this._battleTypeText.setText(def ? def.label : eventType);
    this.containers.battle.setVisible(true);
  }

  hideBattleOverlay() {
    this.containers.battle.setVisible(false);
    this._onBattleEnd = null;
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

    // Generate 3 shop items (rooms + traps, random)
    const pool = [
      ...this.dataManager.rooms.map(r => ({ type: 'room', id: r.id, name: r.name, price: 100 })),
      ...this.dataManager.traps.map(t => ({ type: 'trap', id: t.id, name: t.name, price: 80 })),
    ];

    const items = [];
    for (let i = 0; i < 3; i++) {
      items.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    const cardW = 100;
    const gap = 16;
    const totalW = cardW * 3 + gap * 2;
    const startX = (width - totalW) / 2 + cardW / 2;

    items.forEach((item, i) => {
      const x = startX + i * (cardW + gap);
      const y = height / 2;

      const bg = this.add.rectangle(x, y, cardW, 150, 0x34495e)
        .setStrokeStyle(2, 0x2980b9);

      const nameText = this.add.text(x, y - 30, item.name, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif'
      }).setOrigin(0.5);

      const priceText = this.add.text(x, y + 10, `${item.price}G`, {
        fontSize: '14px', color: '#f1c40f', fontFamily: 'monospace'
      }).setOrigin(0.5);

      const buyBtn = this.add.text(x, y + 50, '購買', {
        fontSize: '14px', color: '#ffffff', fontFamily: 'sans-serif',
        backgroundColor: '#27ae60', padding: { x: 12, y: 4 }
      }).setOrigin(0.5);

      const canBuy = this.gameState.gold >= item.price;
      if (canBuy) {
        buyBtn.setInteractive({ useHandCursor: true });
        buyBtn.on('pointerdown', () => {
          this.gameState.gold -= item.price;
          const starRating = 1 + Math.floor(Math.random() * 2); // 1-2 for shop
          this.gameState.hand.push({ type: item.type, id: item.id, starRating });
          buyBtn.setText('已購買').setAlpha(0.5).disableInteractive();
          bg.setStrokeStyle(2, 0x555555);
          this.topHUD.update();
        });
      } else {
        buyBtn.setAlpha(0.4);
      }

      container.add([bg, nameText, priceText, buyBtn]);
    });

    // Leave button
    const leaveBtn = this.add.text(width / 2, height * 0.8, '離開', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif',
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
        fontSize: '14px', color: '#888899', fontFamily: 'sans-serif',
      }).setOrigin(0.5);

      hitZone.on('pointerdown', () => {
        this.switchSubstate(key);
      });

      hitZone.on('pointerover', () => {
        if (this.currentSubstate !== key) text.setColor('#aaaacc');
      });
      hitZone.on('pointerout', () => {
        if (this.currentSubstate !== key) text.setColor('#888899');
      });

      this.tabButtons.push({ key, text, hitZone });
    });
  }

  _updateTabHighlight(activeKey) {
    this.tabButtons.forEach(({ key, text }) => {
      text.setColor(key === activeKey ? '#e74c3c' : '#888899');
    });
  }
}
