# P026 英雄格子呈現優化 — 設計規格

## 目標

提升英雄在地城地圖格子上的視覺表現：可辨識（一眼看出英雄類型）+ 生命感（idle、走路動畫、受擊/死亡反饋）。

## 設計決策

- 英雄顯示大小維持 24-28px（80px 格子裡的入侵者，不搶怪物主體）
- UI 最小化：sprite + HP bar，詳細資訊點擊查看
- 走路用 4 幀 spritesheet 動畫，idle 用現有單張 + tween 浮動
- 素材透過 nano banana MCP 產生
- 方向性：素材面右，程式 flipX 處理面左

## 素材規格

| 項目 | 規格 |
|------|------|
| 格式 | 4 幀橫向 spritesheet PNG |
| 單幀尺寸 | 32x32px |
| 整張尺寸 | 128x32px |
| 風格 | 像素風，與現有 map sprites 一致 |
| 方向 | 面右 |
| 幀內容 | 走路循環：站立 → 跨步1 → 站立 → 跨步2 |

### 需產生素材清單

| sprite key | 檔名 | 對應英雄 |
|------------|-------|----------|
| hero_trainee_swordsman_walk | hero_trainee_swordsman_walk.png | 見習劍士 |
| hero_light_archer_walk | hero_light_archer_walk.png | 輕弓手 |
| hero_priest_walk | hero_priest_walk.png | 牧師 |
| hero_fire_mage_walk | hero_fire_mage_walk.png | 火法師 |
| hero_holy_knight_walk | hero_holy_knight_walk.png | 聖騎士 |
| hero_of_legend_walk | hero_of_legend_walk.png | 傳說英雄 |

現有 6 張單張 hero sprite 保留不動。

## 動畫系統

### Idle（站在格子上）

- 使用現有單張 sprite（`hero_{typeId}`）
- tween 浮動：y 偏移 -2px ~ +2px，週期 1.5s，ease Sine.InOut，yoyo loop
- 微 scale 呼吸：scaleY 1.0 ~ 1.03，與浮動同步
- walk sprite 隱藏

### Walking（格子間移動）

- 隱藏 idle sprite，顯示 walk sprite
- 播放 spritesheet 動畫：4 幀循環，8fps，repeat -1
- flipX 判斷：`targetPos.x > fromPos.x` 面右（flipX=false），反之面左（flipX=true）
- 位移：維持現有 lerp 插值（400ms）
- 暫停浮動 tween

### 到達格子（heroArrive）

- 停止走路動畫，隱藏 walk sprite
- 顯示 idle sprite，恢復浮動 tween
- snap 到目標格子位置

### 受傷（attack 事件，targetType === 'hero'）

- sprite tint 閃紅：setTint(0xff0000) → 100ms 後 clearTint()
- 左右抖動：x 偏移 ±2px，2 次，總時長 200ms

### 死亡（heroDefeated 事件）

- 淡出：alpha 1 → 0，300ms
- 下沉：y += 10px，300ms，與淡出同步
- 動畫結束後移除 container 及清理 `_heroVisuals` entry
- 停止所有相關 tween

## 程式架構變更

### spriteManifest.js

新增 6 筆 spritesheet 條目：

```js
{ key: 'hero_trainee_swordsman_walk', path: 'sprites/hero_trainee_swordsman_walk.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 }
// ... 其餘 5 個同上
```

### BootScene.js

preload 迴圈中根據 `type` 判斷：
- `type === 'spritesheet'` → `this.load.spritesheet(key, path, { frameWidth, frameHeight })`
- 否則 → `this.load.image(key, path)`（現有邏輯）

### BattleUI.js

**`_onHeroSpawn` 修改：**
- 建立 idleSprite（透過 SpriteHelper，現有邏輯）+ walkSprite（用 `scene.add.sprite` 直接建立，因為需要 spritesheet animation，SpriteHelper 只支援靜態 image）
- 建立 walk animation config（`scene.anims.create`）
- 啟動浮動 tween，存入 `floatTween` 引用
- container.add 加入 walkSprite

**`_heroVisuals` 結構擴充：**
```js
{
  container,
  idleSprite,    // 現有 sprite 欄位改名
  walkSprite,    // 新增
  statusRing,
  hpBg, hpFill,
  floatTween,    // 新增 tween 引用
  lerpFrom, lerpTo
}
```

**`_onHeroMove` 修改：**
- 設定 lerpFrom/lerpTo（現有）
- 暫停 floatTween
- 隱藏 idleSprite，顯示 walkSprite
- 計算 flipX，播放走路動畫

**新增 `_onHeroArrive` 監聽：**
- 停止走路動畫，隱藏 walkSprite
- 顯示 idleSprite，恢復 floatTween

**新增受傷反饋（監聽 `attack` 事件）：**
- 過濾 `targetType === 'hero'`
- 找到對應 heroVisual，執行閃紅 + 抖動 tween

**修改 `_onHeroDefeated`（或新增）：**
- 執行淡出 + 下沉 tween → onComplete 清理

### BattleManager.js

- 不需修改：`heroArrive`、`heroDefeated`、`attack` 事件皆已存在

### 不修改的檔案

- GameState.js — 不涉及
- DungeonMapUI.js — 不涉及
- HeroInstance.js — 不涉及
- HP bar 尺寸 / debuff ring 邏輯 — 不變

## 驗收條件

1. 6 張走路 spritesheet 正確載入（console 無 missing texture 警告）
2. 英雄 idle 時有浮動呼吸動畫
3. 英雄移動時播放走路動畫，方向正確（flipX）
4. 英雄到達格子後切回 idle 動畫
5. 英雄受傷時閃紅 + 抖動
6. 英雄死亡時淡出下沉後正確清理
7. HP bar、debuff ring 功能不受影響
8. 無 console error，不影響既有 battle 流程
