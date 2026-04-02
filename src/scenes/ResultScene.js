import Phaser from 'phaser';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data) {
    this.result = data;
  }

  create() {
    const { width, height } = this.scale;

    const metaState = this.registry.get('metaState');
    const gameState = this.registry.get('gameState');
    let newDiscoveries = [];
    if (metaState && this.result) {
      newDiscoveries = metaState.finalizeRun(
        gameState || { gold: this.result?.stats?.gold ?? 0, heroEncounters: this.result?.stats?.heroEncounters ?? {} },
        this.result.victory
      ) || [];
    }

    const stats = this.result?.stats || {};
    const victory = this.result?.victory;

    // Title
    const title = victory ? '魔王萬歲！' : '勇者得逞...';
    const color = victory ? '#27ae60' : '#e74c3c';
    this.add.text(width / 2, height / 4, title, {
      fontSize: '48px', color, fontFamily: 'serif'
    }).setOrigin(0.5);

    // Victory bonus text
    if (victory) {
      this.add.text(width / 2, height / 4 + 50, '魔王等級提升！', {
        fontSize: '20px', color: '#f1c40f', fontFamily: 'sans-serif'
      }).setOrigin(0.5);
    }

    // Gold saved line
    const goldSaved = stats.gold ?? 0;
    this.add.text(width / 2, height / 4 + 80, `+${goldSaved} 金幣存入 (總計: ${metaState?.metaGold ?? 0})`, {
      fontSize: '16px', color: '#f1c40f', fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Run summary
    const summaryLines = [
      `存活天數: ${stats.day ?? 1}`,
      `擊殺英雄: ${stats.killCount ?? 0}`,
      `剩餘金幣: ${stats.gold ?? 0}`,
      `擁有怪物: ${stats.monstersOwned ?? 0}`,
      `魔王等級: ${metaState?.bossLevel ?? 1}`,
      `總遊玩次數: ${metaState?.totalRuns ?? 0}`,
    ];
    this.add.text(width / 2, height / 2 - 20, summaryLines.join('\n'), {
      fontSize: '16px', color: '#cccccc', fontFamily: 'monospace',
      align: 'center', lineSpacing: 8
    }).setOrigin(0.5);

    // New bestiary discoveries
    if (newDiscoveries.length > 0) {
      const dataManager = this.registry.get('dataManager');
      const names = newDiscoveries.map(id => {
        const def = dataManager?.getHero(id);
        return def ? def.name : id;
      });
      const discoveryText = `新發現！${names.join('、')}`;
      this.add.text(width / 2, height / 2 + 60, discoveryText, {
        fontSize: '16px', color: '#f1c40f', fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    // Restart button
    this.add.text(width / 2, height * 0.72, '再次挑戰', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: 'rgba(44,62,80,0.8)', padding: { x: 24, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('GameScene');
      });

    // Back to Menu button
    this.add.text(width / 2, height * 0.86, '返回主選單', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'sans-serif',
      backgroundColor: '#333333', padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('BootScene');
      });
  }
}
