import { rollStarRating } from '../utils/constants.js';
import { buildUnlockedPool } from '../utils/buildUnlockedPool.js';
import sfx from '../utils/SFXManager.js';

export default class FlipEventHandler {
  constructor(scene, gameState, gameScene) {
    this.scene = scene;
    this.gameState = gameState;
    this.gameScene = gameScene;
    this._currentToast = null;
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

        // Elite battle bonus: free card on victory
        if (flipCard.eventType === 'eliteBattle' && this.gameScene.battleManager.lastResult === 'defenseSuccess') {
          const dm = this.gameScene.dataManager;
          const ms = this.gameScene.metaState;
          const pool = [
            ...buildUnlockedPool(dm.rooms, 'rooms', ms).map(r => ({ type: 'room', id: r.id })),
            ...buildUnlockedPool(dm.traps, 'traps', ms).map(t => ({ type: 'trap', id: t.id })),
          ];
          if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            this.gameState.hand.push({ type: pick.type, id: pick.id, starRating: 2 });
            this._showToast('精英獎勵：獲得一張卡牌！', 1200, null, 'reward');
          }
        }

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
    }, 'battle');
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
    }, 'battle');
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
        heroEncounters: this.gameState.heroEncounters,
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
      }, 'reward');
      const cardObj = this.gameScene.flipMatrixUI?.cardObjects?.[flipCard.row]?.[flipCard.col];
      if (cardObj) {
        this._playCoinFlyAnimation(cardObj.x, cardObj.y, gold);
      } else {
        this._playCoinFlyAnimation(this.scene.scale.width / 2, this.scene.scale.height / 2, gold);
      }
    } else {
      // 20%: Random card to hand
      const dataManager = this.scene.registry.get('dataManager');
      const metaState = this.scene.registry.get('metaState');
      const pool = [
        ...buildUnlockedPool(dataManager.rooms, 'rooms', metaState).map(r => ({ type: 'room', id: r.id })),
        ...buildUnlockedPool(dataManager.traps, 'traps', metaState).map(t => ({ type: 'trap', id: t.id })),
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const starRating = rollStarRating();
      this.gameState.hand.push({ ...pick, starRating });
      this._showToast(`獲得 ${pick.type === 'room' ? '房間' : '陷阱'}卡！`, 1200, () => {
        this.gameState.resolveCard(flipCard.row, flipCard.col);
        this._checkDayEnd(unlockCallback);
      }, 'reward');
    }
  }

  _handleTreasure(flipCard, unlockCallback) {
    const gold = 100 + Math.floor(Math.random() * 201); // 100-300
    this.gameState.gold += gold;
    // Don't play coin SFX here — it plays when coins arrive at TopHUD
    this._showToast(`寶藏！獲得 ${gold} 金幣！`, 1500, () => {
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this._checkDayEnd(unlockCallback);
    }, 'treasure');

    // Coin fly animation — need card position
    const cardObj = this.gameScene.flipMatrixUI?.cardObjects?.[flipCard.row]?.[flipCard.col];
    if (cardObj) {
      this._playCoinFlyAnimation(cardObj.x, cardObj.y, gold);
    } else {
      // Fallback: animate from center
      const { width, height } = this.scene.scale;
      this._playCoinFlyAnimation(width / 2, height / 2, gold);
    }
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

  _showToast(text, duration, callback, toastType = 'default') {
    const { width, height } = this.scene.scale;

    // Destroy existing toast
    if (this._currentToast) {
      this._currentToast.destroy();
      this._currentToast = null;
    }

    // Toast colors by type (using Rectangle + Text for CANVAS compatibility)
    const TOAST_COLORS = {
      battle:   { bg: 0xc0392b, alpha: 0.85 },
      treasure: { bg: 0xb8860b, alpha: 0.85 },
      reward:   { bg: 0x27ae60, alpha: 0.85 },
      shop:     { bg: 0x2980b9, alpha: 0.85 },
      default:  { bg: 0x000000, alpha: 0.7 },
    };
    const colorDef = TOAST_COLORS[toastType] || TOAST_COLORS.default;

    // Create toast as container with bg rectangle + text
    const toastText = this.scene.add.text(0, 0, text, {
      fontSize: '24px', color: '#ffffff', fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    const padding = { x: 24, y: 12 };
    const bgRect = this.scene.add.rectangle(0, 0,
      toastText.width + padding.x * 2,
      toastText.height + padding.y * 2,
      colorDef.bg, colorDef.alpha
    ).setOrigin(0.5);

    const container = this.scene.add.container(width / 2, height / 2 - 20, [bgRect, toastText]);
    container.setDepth(1000);
    container.setAlpha(0);
    this._currentToast = container;

    // Fade in (200ms)
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      y: height / 2,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Hold, then fade out
        this.scene.time.delayedCall(duration, () => {
          if (!container.scene) return; // safety check
          this.scene.tweens.add({
            targets: container,
            alpha: 0,
            y: height / 2 - 10,
            duration: 300,
            ease: 'Quad.easeIn',
            onComplete: () => {
              container.destroy();
              if (this._currentToast === container) this._currentToast = null;
              if (callback) callback();
            }
          });
        });
      }
    });
  }

  _playCoinFlyAnimation(startX, startY, goldAmount) {
    const targetPos = this.gameScene.topHUD.getGoldPosition();
    const coinCount = Math.min(5, Math.max(3, Math.ceil(goldAmount / 50)));

    const controlY = Math.min(startY, targetPos.y) - 80;

    for (let i = 0; i < coinCount; i++) {
      const coin = this.scene.add.circle(startX, startY, 12, 0xf1c40f);
      const coinLabel = this.scene.add.text(startX, startY, 'G', {
        fontSize: '10px', color: '#8B6914', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);
      coin.setDepth(1500);
      coinLabel.setDepth(1501);

      const isLast = (i === coinCount - 1);

      this.scene.time.delayedCall(i * 80, () => {
        if (!coin.scene) return;

        const dummy = { t: 0 };
        this.scene.tweens.add({
          targets: dummy,
          t: 1,
          duration: 500,
          ease: 'Quad.easeIn',
          onUpdate: () => {
            if (!coin.scene) return;
            const t = dummy.t;
            const mt = 1 - t;
            // Quadratic bezier
            const controlX = (startX + targetPos.x) / 2;
            const x = mt * mt * startX + 2 * mt * t * controlX + t * t * targetPos.x;
            const y = mt * mt * startY + 2 * mt * t * controlY + t * t * targetPos.y;
            coin.setPosition(x, y);
            coinLabel.setPosition(x, y);
            // Scale down as approaching target
            const scale = 1 - t * 0.5;
            coin.setScale(scale);
            coinLabel.setScale(scale);
          },
          onComplete: () => {
            coin.destroy();
            coinLabel.destroy();
            if (isLast) {
              sfx.play('coin');
              this.gameScene.topHUD.animateGoldChange();
            }
          }
        });
      });
    }
  }
}
