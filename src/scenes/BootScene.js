import Phaser from 'phaser';
import DataManager from '../models/DataManager.js';
import MetaState from '../models/MetaState.js';
import spriteManifest from '../data/spriteManifest.js';
import sfx from '../utils/SFXManager.js';
import { FONT_FAMILY } from '../utils/constants.js';

const SFX_LIST = [
  'card_flip', 'battle_hit', 'coin', 'trap_trigger',
  'victory', 'defeat', 'button_tap', 'torture_convert', 'boss_appear',
];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Set base URL for asset loading (handles GitHub Pages subpath)
    this.load.setBaseURL(import.meta.env.BASE_URL);

    // Loading bar
    const { width, height } = this.scale;
    const barW = width * 0.6;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x333333);
    const fill = this.add.rectangle(barX + 2, barY, 0, barH - 4, 0xe74c3c).setOrigin(0, 0.5);

    this.load.on('progress', (v) => { fill.width = (barW - 4) * v; });

    // Title text (uses fallback font during load, pixel font kicks in after)
    this.add.text(width / 2, barY - 60, '魔王創業', {
      fontSize: '32px', color: '#e74c3c', fontFamily: FONT_FAMILY
    }).setOrigin(0.5);

    this.add.text(width / 2, barY + 40, 'Loading...', {
      fontSize: '14px', color: '#888', fontFamily: FONT_FAMILY
    }).setOrigin(0.5);

    // Register data loading
    this.dataManager = new DataManager();
    this.dataManager.registerPreload(this);

    // Load sprite textures (image or spritesheet)
    spriteManifest.forEach((entry) => {
      if (entry.type === 'spritesheet') {
        this.load.spritesheet(entry.key, entry.path, {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      } else {
        this.load.image(entry.key, entry.path);
      }
    });

    // Load title background
    this.load.image('title_bg', 'sprites/title_bg.png');

    // Load SFX
    SFX_LIST.forEach((id) => this.load.audio(id, `audio/${id}.wav`));
  }

  async create() {
    // Ensure pixel font is fully loaded before rendering any UI
    await document.fonts.ready;

    const { width, height } = this.scale;

    // Register animations from spritesheet manifest entries (P026)
    spriteManifest.forEach((entry) => {
      if (entry.type === 'spritesheet' && entry.animation) {
        if (!this.anims.exists(entry.key)) {
          this.anims.create({
            key: entry.key,
            frames: this.anims.generateFrameNumbers(entry.key, {
              start: entry.animation.start,
              end: entry.animation.end,
            }),
            frameRate: entry.animation.frameRate,
            repeat: entry.animation.repeat,
          });
        }
      }
    });

    // Initialize DataManager from cache
    this.dataManager.initialize(this);

    // Initialize MetaState
    this.metaState = new MetaState();
    this.metaState.load();
    console.log('[BootScene] MetaState loaded — bossLevel:', this.metaState.bossLevel, 'totalRuns:', this.metaState.totalRuns);

    // Store on registry for cross-scene access
    this.registry.set('dataManager', this.dataManager);
    this.registry.set('metaState', this.metaState);

    // Initialize SFXManager
    sfx.init(this.game);

    // Clear loading UI
    this.children.removeAll();

    // Title background image
    if (this.textures.exists('title_bg')) {
      const titleBg = this.add.image(width / 2, height * 0.4, 'title_bg');
      const scale = width / titleBg.width;
      titleBg.setScale(scale);
      titleBg.setDepth(0);
    }

    // "Tap to Start" text with alpha pulse tween
    const tapText = this.add.text(width / 2, height * 0.75, 'Tap to Start', {
      fontSize: '22px', color: '#ffffff', fontFamily: FONT_FAMILY
    }).setOrigin(0.5).setDepth(1);

    this.tweens.add({
      targets: tapText,
      alpha: { from: 0.3, to: 1.0 },
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Full-screen hit zone — tap-anywhere to start (double-tap lock)
    let started = false;
    const hitZone = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive()
      .setDepth(2);

    hitZone.on('pointerdown', () => {
      if (started) return;
      started = true;
      sfx.play('button_tap');
      this.scene.start('GameScene');
    });
  }
}
