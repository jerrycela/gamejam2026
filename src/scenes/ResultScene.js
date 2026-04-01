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
    if (metaState && this.result) {
      metaState.recordRunEnd(this.result.victory);
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

    // Restart button
    this.add.text(width / 2, height * 0.75, '再次挑戰', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: 'rgba(44,62,80,0.8)', padding: { x: 24, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('GameScene');
      });
  }
}
