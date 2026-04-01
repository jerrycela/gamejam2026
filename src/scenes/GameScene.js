import Phaser from 'phaser';
import GameState from '../models/GameState.js';

// Substate keys
const SUBSTATES = ['flipMatrix', 'dungeonMap', 'cardPick', 'battle', 'torture', 'monsterList'];

// Tab bar entries: label + substate key
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

    // Build substate containers
    this.containers = {};
    const contentH = height - TAB_BAR_H;

    SUBSTATES.forEach((key) => {
      const container = this.add.container(0, 0);

      // Placeholder background
      const bg = this.add.rectangle(width / 2, contentH / 2, width, contentH, 0x1a1a2e);

      // Placeholder label
      const label = this.add.text(width / 2, contentH / 2, key, {
        fontSize: '24px',
        color: '#555577',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      container.add([bg, label]);
      container.setVisible(false);

      this.containers[key] = container;
    });

    // Build tab bar
    this._buildTabBar(width, height);

    // Show default substate
    this.currentSubstate = null;
    this.switchSubstate('flipMatrix');
  }

  // Switch visible substate
  switchSubstate(name) {
    if (!SUBSTATES.includes(name)) {
      console.warn(`[GameScene] Unknown substate: ${name}`);
      return;
    }

    if (this.currentSubstate === name) return;

    // Hide all containers
    SUBSTATES.forEach((key) => {
      this.containers[key].setVisible(false);
    });

    // Show target container
    this.containers[name].setVisible(true);
    this.currentSubstate = name;

    // Update tab highlight
    this._updateTabHighlight(name);

    console.log(`[GameScene] Switched to substate: ${name}`);
  }

  // Build bottom tab bar
  _buildTabBar(width, height) {
    const barY = height - TAB_BAR_H;
    const tabW = width / TAB_DEFS.length;

    // Tab bar background
    this.add.rectangle(width / 2, barY + TAB_BAR_H / 2, width, TAB_BAR_H, 0x2d2d4e);

    // Separator line
    this.add.rectangle(width / 2, barY, width, 1, 0x444466);

    this.tabButtons = [];

    TAB_DEFS.forEach(({ label, key }, i) => {
      const centerX = tabW * i + tabW / 2;
      const centerY = barY + TAB_BAR_H / 2;

      // Tap hit area (invisible rectangle for input)
      const hitZone = this.add.rectangle(centerX, centerY, tabW, TAB_BAR_H, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      // Tab label text
      const text = this.add.text(centerX, centerY, label, {
        fontSize: '14px',
        color: '#888899',
        fontFamily: 'sans-serif',
      }).setOrigin(0.5);

      hitZone.on('pointerdown', () => {
        this.switchSubstate(key);
      });

      // Hover feedback
      hitZone.on('pointerover', () => {
        if (this.currentSubstate !== key) text.setColor('#aaaacc');
      });
      hitZone.on('pointerout', () => {
        if (this.currentSubstate !== key) text.setColor('#888899');
      });

      this.tabButtons.push({ key, text, hitZone });
    });
  }

  // Update tab label colors to reflect active substate
  _updateTabHighlight(activeKey) {
    this.tabButtons.forEach(({ key, text }) => {
      text.setColor(key === activeKey ? '#e74c3c' : '#888899');
    });
  }
}
