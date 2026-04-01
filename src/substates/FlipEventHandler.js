export default class FlipEventHandler {
  constructor(scene, gameState, gameScene) {
    this.scene = scene;
    this.gameState = gameState;
    this.gameScene = gameScene;
  }

  // Called after flip animation. unlockCallback() must be called when event is fully resolved.
  handleEvent(flipCard, unlockCallback) {
    switch (flipCard.eventType) {
      case 'normalBattle':
      case 'eliteBattle':
      case 'bossBattle':
        this._handleBattle(flipCard, unlockCallback);
        break;
      case 'activity':
        this._handleActivity(flipCard, unlockCallback);
        break;
      case 'treasure':
        this._handleTreasure(flipCard, unlockCallback);
        break;
      case 'shop':
        this._handleShop(flipCard, unlockCallback);
        break;
      default:
        console.warn('[FlipEventHandler] Unknown event type:', flipCard.eventType);
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        unlockCallback();
    }
  }

  _handleBattle(flipCard, unlockCallback) {
    // Show toast
    this._showToast('戰鬥開始！', 1000, () => {
      // Switch to dungeonMap + show battle overlay
      this.gameScene.switchSubstate('dungeonMap');
      this.gameScene.showBattleOverlay(flipCard.eventType);

      // Battle stub: "結束戰鬥" button will call hideBattleOverlay + return
      // The battle overlay's end button calls this resolve flow
      this.gameScene._onBattleEnd = () => {
        this.gameScene.hideBattleOverlay();
        this.gameScene.returnToPreviousSubstate();
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd();
        unlockCallback();
      };
    });
  }

  _handleActivity(flipCard, unlockCallback) {
    const roll = Math.random();
    if (roll < 0.6) {
      // 60%: CardPick (free)
      this.gameScene.openCardPick({
        source: 'activityReward',
        cost: 0,
      }, () => {
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd();
        unlockCallback();
      });
    } else if (roll < 0.8) {
      // 20%: Direct gold
      const gold = 50 + Math.floor(Math.random() * 101); // 50-150
      this.gameState.gold += gold;
      this._showToast(`獲得 ${gold} 金幣！`, 1200, () => {
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd();
        unlockCallback();
      });
    } else {
      // 20%: Random card to hand
      const dataManager = this.gameScene.dataManager;
      const allRooms = dataManager.rooms;
      const allTraps = dataManager.traps;
      const pool = [
        ...allRooms.map(r => ({ type: 'room', id: r.id })),
        ...allTraps.map(t => ({ type: 'trap', id: t.id })),
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const starRoll = Math.random() * 100;
      const starRating = starRoll < 70 ? 1 : (starRoll < 95 ? 2 : 3);
      this.gameState.hand.push({ ...pick, starRating });
      this._showToast(`獲得 ${pick.type === 'room' ? '房間' : '陷阱'}卡！`, 1200, () => {
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd();
        unlockCallback();
      });
    }
  }

  _handleTreasure(flipCard, unlockCallback) {
    const gold = 100 + Math.floor(Math.random() * 201); // 100-300
    this.gameState.gold += gold;
    this._showToast(`寶藏！獲得 ${gold} 金幣！`, 1500, () => {
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this._checkDayEnd();
      unlockCallback();
    });
  }

  _handleShop(flipCard, unlockCallback) {
    // Open shop via CardPick container (reusing the modal system)
    this.gameScene.openShop(() => {
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this._checkDayEnd();
      unlockCallback();
    });
  }

  _checkDayEnd() {
    if (this.gameState.isMatrixComplete()) {
      this._showToast('本日結束', 2000, () => {
        this.gameState.advanceDay();
        // Notify FlipMatrixUI to rebuild
        if (this.gameScene.flipMatrixUI) {
          this.gameScene.flipMatrixUI.rebuild();
        }
        // Update HUD
        if (this.gameScene.topHUD) {
          this.gameScene.topHUD.update();
        }
      });
    }
  }

  _showToast(text, duration, callback) {
    const { width, height } = this.scene.scale;
    const toast = this.scene.add.text(width / 2, height / 2, text, {
      fontSize: '24px', color: '#ffffff', fontFamily: 'sans-serif',
      backgroundColor: 'rgba(0,0,0,0.7)', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(1000);

    this.scene.time.delayedCall(duration, () => {
      toast.destroy();
      if (callback) callback();
    });
  }
}
