# P019: Visual Upgrade — Pixel Art Sprites + UI Polish

## Why

用戶 dogfood 後表示遊戲「像一坨屎」— 功能完整但視覺只有色塊和 monospace 文字。
Game Jam 評審第一印象靠視覺。JSON 已有 `spriteKey` 欄位，只差實際圖片和渲染邏輯。

## What

用 nano-banana (Gemini Imagen) 生成像素風 sprite，整合進 Phaser asset pipeline，
取代所有色塊+文字字母的實體渲染。分三階段推進。

### Phase 1: Sprite 生成 + Asset Pipeline

1. **生成 11 張 pixel art sprite**（**32x32 PNG**，透明背景，暗色系地城風格）：
   - 怪物 5：monster_skeleton_knight, monster_goblin, monster_bat_succubus, monster_rage_demon, monster_frost_witch
   - 英雄 5：hero_trainee_swordsman, hero_light_archer, hero_priest, hero_fire_mage, hero_holy_knight
   - Boss 1：hero_of_legend（傳說勇者，較大或有光環）
   - **檔名 = spriteKey + .png**（與 JSON `spriteKey` 一致）
2. **儲存** `public/sprites/{spriteKey}.png`
3. **Phaser config** 在 `src/main.js` 加入 `pixelArt: true, roundPixels: true, antialias: false`
4. **Asset Manifest**（`src/data/spriteManifest.js`）— 匯出 `{ key, path }[]`，集中管理所有 sprite 對應
5. **BootScene.preload** 用 manifest 迴圈 `this.load.image(key, path)`（與 DataManager.registerPreload 同層級）
6. **SpriteHelper**（`src/utils/SpriteHelper.js`）：
   - API: `createSprite(scene, key, x, y, displaySize)` → 回傳 `Phaser.GameObjects.Image | Phaser.GameObjects.Arc`
   - 內部用 `scene.textures.exists(key)` 判斷，缺圖回傳色塊 fallback
   - displaySize 只允許 16/24/32（整數倍縮放）

### Phase 2: 實體渲染替換

7. **BattleUI** — 英雄渲染替換：
   - `add.arc()` + letter → `SpriteHelper.createSprite(scene, spriteKey, 0, -4, 24)`
   - **Debuff overlay**: 新增 `add.arc()` 作為透明 status ring（半徑 14），`visual.statusRing`
   - `update()` 改用 `visual.statusRing.setStrokeStyle()` 顯示 slow/dot，不再依賴 `visual.circle`
   - `visual` 結構: `{ container, sprite, statusRing, hpBg, hpFill, lerpFrom, lerpTo }`
8. **DungeonMapUI** — cell 內怪物從單字母 → `SpriteHelper.createSprite(scene, spriteKey, 0, half-10, 16)`
9. **CardPickUI** — **不加 room sprite**（rooms.json 無 spriteKey）；陷阱卡用 `trap_*` sprite icon 裝飾

### Phase 3: UI Chrome 打磨

10. **FlipMatrixUI** — 事件卡面用 **unicode 符號**（⚔=戰鬥, ⭐=精英, 👑=Boss, 🎁=寶藏, 🏪=商店, 📜=事件），不生成額外圖
11. **BootScene** — 標題背景加入 hero_of_legend sprite（居中，半透明）
12. **MonsterListUI** — 每行左側加 32px sprite（行高已 44px 可容納）
13. **BestiaryUI** — 圖鑑每行左側加 32px sprite（行高已 100px）

## Asset Manifest

| spriteKey | path | source |
|-----------|------|--------|
| monster_skeleton_knight | sprites/monster_skeleton_knight.png | nano-banana |
| monster_goblin | sprites/monster_goblin.png | nano-banana |
| monster_bat_succubus | sprites/monster_bat_succubus.png | nano-banana |
| monster_rage_demon | sprites/monster_rage_demon.png | nano-banana |
| monster_frost_witch | sprites/monster_frost_witch.png | nano-banana |
| hero_trainee_swordsman | sprites/hero_trainee_swordsman.png | nano-banana |
| hero_light_archer | sprites/hero_light_archer.png | nano-banana |
| hero_priest | sprites/hero_priest.png | nano-banana |
| hero_fire_mage | sprites/hero_fire_mage.png | nano-banana |
| hero_holy_knight | sprites/hero_holy_knight.png | nano-banana |
| hero_of_legend | sprites/hero_of_legend.png | nano-banana |

## Affected Files

| File | Change |
|------|--------|
| `public/sprites/*.png` | **NEW** — 11 張 32x32 pixel art sprite |
| `src/data/spriteManifest.js` | **NEW** — asset key-path manifest |
| `src/utils/SpriteHelper.js` | **NEW** — sprite 建立 + fallback（textures.exists 判斷）|
| `src/main.js` | 加 pixelArt/roundPixels/antialias config |
| `src/scenes/BootScene.js` | 用 manifest 載入 sprites |
| `src/substates/BattleUI.js` | hero sprite + statusRing overlay 取代 circle |
| `src/substates/DungeonMapUI.js` | cell 內怪物 sprite |
| `src/substates/CardPickUI.js` | 陷阱卡 sprite icon |
| `src/substates/FlipMatrixUI.js` | 事件 unicode 符號 |
| `src/substates/MonsterListUI.js` | 列表行 sprite |
| `src/substates/BestiaryUI.js` | 圖鑑 sprite |

## Risk

- **nano-banana 生成品質不可控** — SpriteHelper fallback（textures.exists）確保缺圖不壞
- **32x32 像素量少** — 像素風本身適合低解析度，每個像素更重要
- **CANVAS renderer 限制** — 只用 image + tint，不用 shader/blend mode

## Review R1 Resolved

- [x] C-P1a: 改 32x32 原生 + pixelArt config（整數縮放 1x/0.75x/0.5x）
- [x] C-P1b: 加 statusRing overlay，visual 結構重新定義
- [x] C-P1c: CardPickUI 不依賴 room sprite，只用 trap sprite
- [x] G-P1: Phase 3 用 unicode icon，不生成額外圖
- [x] C-P2a: 加 Asset Manifest 表
- [x] C-P2b: SpriteHelper API spec 明確定義
- [x] G-P2: 明確 public/sprites/ + Vite 根路徑

## Verification

- [ ] `npm run build` 通過
- [ ] `npm run lint` 無新警告
- [ ] Phaser config 含 pixelArt: true
- [ ] 遊戲啟動後 sprite 正常顯示（BootScene 無 load error）
- [ ] 戰鬥畫面英雄用 sprite + statusRing 渲染
- [ ] 地圖 cell 顯示怪物 sprite
- [ ] 無 sprite 時 fallback 到色塊不報錯
- [ ] agent-browser 截圖確認視覺品質
