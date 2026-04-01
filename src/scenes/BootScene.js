import Phaser from 'phaser';
import DataManager from '../models/DataManager.js';
import MetaState from '../models/MetaState.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Loading bar
    const { width, height } = this.scale;
    const barW = width * 0.6;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x333333);
    const fill = this.add.rectangle(barX + 2, barY, 0, barH - 4, 0xe74c3c).setOrigin(0, 0.5);

    this.load.on('progress', (v) => { fill.width = (barW - 4) * v; });

    // Title text
    this.add.text(width / 2, barY - 60, '魔王創業', {
      fontSize: '32px', color: '#e74c3c', fontFamily: 'serif'
    }).setOrigin(0.5);

    this.add.text(width / 2, barY + 40, 'Loading...', {
      fontSize: '14px', color: '#888', fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Register data loading
    this.dataManager = new DataManager();
    this.dataManager.registerPreload(this);
  }

  create() {
    // Initialize DataManager from cache
    this.dataManager.initialize(this);

    // Initialize MetaState
    this.metaState = new MetaState();
    this.metaState.load();
    console.log('[BootScene] MetaState loaded — bossLevel:', this.metaState.bossLevel, 'totalRuns:', this.metaState.totalRuns);

    // Store on registry for cross-scene access
    this.registry.set('dataManager', this.dataManager);
    this.registry.set('metaState', this.metaState);

    // Transition to GameScene after brief delay
    this.time.delayedCall(500, () => {
      this.scene.start('GameScene');
    });
  }
}
