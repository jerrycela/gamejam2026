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
    const title = this.result?.victory ? '勝利！' : '失敗...';
    const color = this.result?.victory ? '#27ae60' : '#e74c3c';

    this.add.text(width / 2, height / 3, title, {
      fontSize: '48px', color, fontFamily: 'serif'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, '點擊重新開始', {
      fontSize: '18px', color: '#aaa', fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}
