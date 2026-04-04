import Phaser from 'phaser';
import DataManager from '../models/DataManager.js';
import MetaState from '../models/MetaState.js';
import spriteManifest from '../data/spriteManifest.js';

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

    // Load sprite textures
    spriteManifest.forEach((entry) => {
      this.load.image(entry.key, entry.path);
    });
  }

  create() {
    const { width, height } = this.scale;

    // Initialize DataManager from cache
    this.dataManager.initialize(this);

    // Initialize MetaState
    this.metaState = new MetaState();
    this.metaState.load();
    console.log('[BootScene] MetaState loaded — bossLevel:', this.metaState.bossLevel, 'totalRuns:', this.metaState.totalRuns);

    // Store on registry for cross-scene access
    this.registry.set('dataManager', this.dataManager);
    this.registry.set('metaState', this.metaState);

    // Clear loading UI
    this.children.removeAll();

    // Title background: hero_of_legend sprite (semi-transparent)
    if (this.textures.exists('hero_of_legend')) {
      const bgSprite = this.add.image(width / 2, height / 2 - 40, 'hero_of_legend');
      bgSprite.displayWidth = 160;
      bgSprite.displayHeight = 160;
      bgSprite.setAlpha(0.15);
      bgSprite.setDepth(0);
    }

    // --- Menu container ---
    this.menuContainer = this.add.container(0, 0);
    this.menuContainer.setDepth(1);

    const titleText = this.add.text(width / 2, height / 3, '魔王創業', {
      fontSize: '48px', color: '#e74c3c', fontFamily: 'serif'
    }).setOrigin(0.5);

    const startBtn = this.add.text(width / 2, height / 2, '開始遊戲', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: '#e74c3c', padding: { x: 24, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
    startBtn.on('pointerover', () => startBtn.setAlpha(0.8));
    startBtn.on('pointerout', () => startBtn.setAlpha(1));

    const shopBtn = this.add.text(width / 2, height / 2 + 60, '解鎖商店', {
      fontSize: '20px', color: '#f1c40f', fontFamily: 'sans-serif',
      backgroundColor: '#2c3e50', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    shopBtn.on('pointerdown', () => {
      this.menuContainer.setVisible(false);
      this._buildShopContainer();
      this.shopContainer.setVisible(true);
    });
    shopBtn.on('pointerover', () => shopBtn.setAlpha(0.8));
    shopBtn.on('pointerout', () => shopBtn.setAlpha(1));

    this.menuContainer.add([titleText, startBtn, shopBtn]);

    // --- Shop container (hidden initially) ---
    this.shopContainer = this.add.container(0, 0);
    this.shopContainer.setVisible(false);
  }

  _buildShopContainer() {
    this.shopContainer.removeAll(true);
    const { width, height } = this.scale;
    const metaState = this.metaState;
    const dataManager = this.dataManager;

    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);
    this.shopContainer.add(bg);

    const titleText = this.add.text(width / 2, 40, '解鎖商店', {
      fontSize: '28px', color: '#e74c3c', fontFamily: 'serif'
    }).setOrigin(0.5);
    this.shopContainer.add(titleText);

    const goldText = this.add.text(width / 2, 80, `持有金幣: ${metaState.metaGold}`, {
      fontSize: '18px', color: '#f1c40f', fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.shopContainer.add(goldText);

    const items = dataManager.getUnlockShopItems();
    const startY = 120;
    const rowH = 44;

    items.forEach((item, i) => {
      const y = startY + i * rowH;
      const name = dataManager.lookupName(item.type, item.id);

      const unlockMap = {
        monsters: metaState.unlockedMonsters,
        rooms: metaState.unlockedRooms,
        traps: metaState.unlockedTraps,
      };
      const owned = (unlockMap[item.type] || []).includes(item.id);

      const nameText = this.add.text(24, y, name, {
        fontSize: '15px', color: owned ? '#888888' : '#ffffff', fontFamily: 'sans-serif'
      }).setOrigin(0, 0.5);
      this.shopContainer.add(nameText);

      const typeLabel = this.add.text(width * 0.45, y, item.type, {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace'
      }).setOrigin(0.5, 0.5);
      this.shopContainer.add(typeLabel);

      if (owned) {
        const ownedText = this.add.text(width - 24, y, '已擁有', {
          fontSize: '14px', color: '#27ae60', fontFamily: 'sans-serif'
        }).setOrigin(1, 0.5);
        this.shopContainer.add(ownedText);
      } else {
        const canAfford = metaState.metaGold >= item.cost;
        const buyBtn = this.add.text(width - 24, y, `${item.cost}G 購買`, {
          fontSize: '14px', color: canAfford ? '#ffffff' : '#666666', fontFamily: 'sans-serif',
          backgroundColor: canAfford ? '#8e44ad' : '#333333', padding: { x: 10, y: 4 }
        }).setOrigin(1, 0.5);

        if (canAfford) {
          buyBtn.setInteractive({ useHandCursor: true });
          buyBtn.on('pointerdown', () => {
            const purchased = metaState.purchaseUnlock(item.type, item.id, item.cost);
            if (purchased) {
              this._buildShopContainer();
            }
          });
        }
        this.shopContainer.add(buyBtn);
      }
    });

    const backBtn = this.add.text(width / 2, height - 40, '返回', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif',
      backgroundColor: '#333333', padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.shopContainer.setVisible(false);
      this.menuContainer.setVisible(true);
    });
    this.shopContainer.add(backBtn);
  }
}
