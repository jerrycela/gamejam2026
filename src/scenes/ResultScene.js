import Phaser from 'phaser';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data) {
    // data: { victory: bool, stats: {...} }
    this.result = data;
  }

  create() {
    const { width, height } = this.scale;

    // Record run result and snapshot summary before displaying
    const metaState = this.registry.get('metaState');
    const gameState = this.registry.get('gameState');
    if (metaState && this.result) {
      metaState.recordRunEnd(this.result.victory);
    }

    // Snapshot summary at this moment (immutable for display)
    const summary = {
      killCount: gameState?.killCount ?? 0,
      gold: gameState?.gold ?? 0,
      day: gameState?.day ?? 1,
      bossLevel: metaState?.bossLevel ?? 1,
      totalRuns: metaState?.totalRuns ?? 0,
    };

    const title = this.result?.victory ? '勝利！' : '失敗...';
    const color = this.result?.victory ? '#27ae60' : '#e74c3c';

    this.add.text(width / 2, height / 3, title, {
      fontSize: '48px', color, fontFamily: 'serif'
    }).setOrigin(0.5);

    // Run summary from snapshot
    const summaryLines = [
      `擊殺英雄: ${summary.killCount}`,
      `金幣: ${summary.gold}`,
      `天數: ${summary.day}`,
      `魔王等級: ${summary.bossLevel}`,
      `總遊玩次數: ${summary.totalRuns}`,
    ];
    if (summaryLines.length > 0) {
      this.add.text(width / 2, height / 2 - 40, summaryLines.join('\n'), {
        fontSize: '16px', color: '#cccccc', fontFamily: 'monospace',
        align: 'center', lineSpacing: 8
      }).setOrigin(0.5);
    }

    this.add.text(width / 2, height * 0.7, '點擊重新開始', {
      fontSize: '18px', color: '#aaa', fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
