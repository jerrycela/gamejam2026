import { rollStarRating } from '../utils/constants.js';

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
      case 'finalBattle':
        this._handleFinalBattle(flipCard, unlockCallback);
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
    this._showToast('戰鬥開始！', 1000, () => {
      this.gameScene.switchSubstateForced('dungeonMap');
      this.gameScene.showBattleOverlay(flipCard.eventType);
      this.gameScene.battleManager.start(flipCard.eventType);
      this.gameScene.battleUI.start();

      // Single owner: wait for BattleUI to finish banner, then clean up
      this.scene.events.once('battleUiComplete', () => {
        this.gameScene.battleUI.stop();
        this.gameScene.hideBattleOverlay();
        this.gameScene.returnToPreviousSubstate();
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this.gameScene.topHUD.update();
        this._checkDayEnd(unlockCallback);
      });

      // Wire the existing "結束戰鬥" button as a force-end (for debug)
      this.gameScene._onBattleEnd = () => {
        if (this.gameScene.battleManager.isActive()) {
          this.gameScene.battleManager.forceEnd('defenseSuccess');
        }
      };
    });
  }

  // unlockCallback is intentionally not called — the run ends and GameScene is abandoned.
  _handleFinalBattle(flipCard, unlockCallback) {
    this.gameState.finalBattleTriggered = true;
    this._showToast('勇者來襲！終局決戰！', 1500, () => {
      this.gameScene.switchSubstateForced('dungeonMap');
      this.gameScene.showBattleOverlay('finalBattle');
      this.gameScene.battleManager.start('finalBattle');
      this.gameScene.battleUI.start();

      this.scene.events.once('battleUiComplete', () => {
        this.gameScene.battleUI.stop();
        this.gameScene.hideBattleOverlay();
        this._endRun(this.gameScene.battleManager.lastResult);
      });

      this.gameScene._onBattleEnd = () => {
        if (this.gameScene.battleManager.isActive()) {
          this.gameScene.battleManager.forceEnd('defenseSuccess');
        }
      };
    });
  }

  _endRun(result) {
    const victory = (result === 'defenseSuccess');
    const data = {
      victory,
      stats: {
        killCount: this.gameState.killCount,
        gold: this.gameState.gold,
        day: this.gameState.day,
        monstersOwned: this.gameState.monsterRoster.length,
      }
    };
    this.scene.scene.start('ResultScene', data);
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
        this._checkDayEnd(unlockCallback);
      });
    } else if (roll < 0.8) {
      // 20%: Direct gold
      const gold = 50 + Math.floor(Math.random() * 101); // 50-150
      this.gameState.gold += gold;
      this._showToast(`獲得 ${gold} 金幣！`, 1200, () => {
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd(unlockCallback);
      });
    } else {
      // 20%: Random card to hand
      const dataManager = this.scene.registry.get('dataManager');
      const pool = [
        ...dataManager.rooms.map(r => ({ type: 'room', id: r.id })),
        ...dataManager.traps.map(t => ({ type: 'trap', id: t.id })),
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const starRating = rollStarRating();
      this.gameState.hand.push({ ...pick, starRating });
      this._showToast(`獲得 ${pick.type === 'room' ? '房間' : '陷阱'}卡！`, 1200, () => {
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd(unlockCallback);
      });
    }
  }

  _handleTreasure(flipCard, unlockCallback) {
    const gold = 100 + Math.floor(Math.random() * 201); // 100-300
    this.gameState.gold += gold;
    this._showToast(`寶藏！獲得 ${gold} 金幣！`, 1500, () => {
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this._checkDayEnd(unlockCallback);
    });
  }

  _handleShop(flipCard, unlockCallback) {
    // Open shop via CardPick container (reusing the modal system)
    this.gameScene.openShop(() => {
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this._checkDayEnd(unlockCallback);
    });
  }

  _checkDayEnd(unlockCallback) {
    if (this.gameState.isMatrixComplete()) {
      this._showToast('本日結束', 2000, () => {
        this.gameState.advanceDay();
        if (this.gameScene.flipMatrixUI) {
          this.gameScene.flipMatrixUI.rebuild();
        }
        if (this.gameScene.topHUD) {
          this.gameScene.topHUD.update();
        }
        unlockCallback();
      });
    } else {
      // Check if only the finalBattle card remains unresolved
      const unresolved = this.gameState.flipMatrix.flat().filter(c => !c.resolved);
      if (unresolved.length === 1 && unresolved[0].eventType === 'finalBattle') {
        this._handleFinalBattle(unresolved[0], unlockCallback);
        return;
      }
      unlockCallback();
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
