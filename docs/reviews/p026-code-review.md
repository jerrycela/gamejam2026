# P026 Code Review — 2026-04-05

## Diff Range
`b0cb844..0bf02a6` (6 commits, 3 source files, ~340 lines)

## Codex (gpt-5.4)
READINESS: 58% | VERDICT: NO

### Findings
- **P1**: swap 動畫期間 selectionState 未 reset（150ms 空窗），可再次觸發 placement → ghost sprite + 狀態脫鉤
- **P2**: deploy/remove/buff tween 未納入 lifecycle，refresh/destroy 時 callback 打到已銷毀物件
- **P2**: spritesheet 4 幀硬編碼，manifest 缺 frame metadata
- **P3**: _clearSelection 語意分裂，命名不夠明確

## Gemini (gemini-2.5-pro)
READINESS: 85% | VERDICT: YES

### Findings
- **P2**: swap 動畫期間狀態與畫面不一致（與 Codex P1 同一問題）
- **P3**: noBtn 用 _clearSelection 過度重建
- **P3**: BootScene 動畫 frameRate/end 硬編碼

## Adjudication (Opus)

| # | Sev | Finding | Decision | Action |
|---|-----|---------|----------|--------|
| 1 | P1 | swap animation race condition | AGREE (升為 P1) | 009 proposal B1: busy flag |
| 2 | P2 | tween lifecycle 未管理 | AGREE | 009 proposal B2: _activeAnimTweens + killAll |
| 3 | P2 | spritesheet metadata 硬編碼 | PARTIAL | 009 proposal B4: 移入 manifest |
| 4 | P3 | _clearSelection 語意分裂 | PARTIAL | 記錄，暫不修 |
| 5 | P3 | noBtn 過度重建 | AGREE | 009 proposal B3 |

## Resolution
所有 P1/P2 已納入 009-p026-visual-fix proposal 處理。

---

# 009 Code Review — 2026-04-05

## Diff Range
`0bf02a6..f2a64a5` (1 commit, 3 source files, +123 -47 lines)

## Codex (gpt-5.4)
READINESS: 82% | VERDICT: NO

### Findings
- **P2**: pedestal fade tween + buff tweens (baseSprite, roomIcon) 未追蹤到 _activeAnimTweens，refresh/destroy 可能打到已銷毀物件

## Gemini (gemini-2.5-pro)
READINESS: 95% | VERDICT: YES

### Findings
- **P3**: _isAnimating 在 _playRemoveAnimation 設定但依賴後續 _playDeployAnimation callback reset，獨立使用 remove 時未 reset

## Adjudication (Opus)

| # | Sev | Finding | Decision | Action |
|---|-----|---------|----------|--------|
| 1 | P2 | pedestal/buff tweens 未追蹤 | AGREE | 追蹤這三個 tween 到 _activeAnimTweens |
| 2 | P3 | _isAnimating 依賴鏈 | NOTED | 目前 remove 只在 swap 內使用，暫不改 |

## Resolution
P2 已修正：pedestal fade tween + 2 buff tweens 加入 _activeAnimTweens 追蹤。
