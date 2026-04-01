# P004 Battle Core — Code Review

## R1 (Codex 58% NO + Gemini 60% NO)

### P1 Fixed:
1. 怪物死後同 tick 反擊 → 英雄攻擊後立即 check monster death
2. Boss 死後同 tick 反擊 → _tickBossSharedAttack 加 bossHp<=0 early return
3. 英雄被 boss 打死後下 tick 仍出手 → _tickBossFight 開頭加 hp<=0 check
4. converted monster buff 被忽略 → _getMonsterBuffFlags + atkMult/hpMult

### P2 Fixed:
5. _cellCombatOwner 未清理 → _endBattle 加 .clear()
6. 死路防禦 → _pickNextCell null 時 heroDefeated

### P3 Fixed:
7. forceEnd() public API
8. battleEnd callback 接收 result 參數

### Rejected:
- targetQueue FIFO 輪轉 → spec 設計就是集火隊首
- currentHp 未初始化 → setCellMonster 已用 baseHp
- BFS O(N²) → grid 最多 12 cells

## R2 (Codex 82% NO)

### Adjudicated:
- P1 prisoners 不可達 → PARTIAL 降 P2, 屬 P006 範圍
- P2 _pickNextCell null guard 不完整 → AGREE, 新增 _assignNextMove helper 統一 4 個呼叫點
- P3 battleEnd result 未使用 → REJECT, MVP 不需分支

## Exit: P1=0, R1 P1 全修, R2 P2 修, Gemini R1 有回覆但 R2 429
