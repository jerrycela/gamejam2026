# P024: Boss Phase 2 — Rage Mode at HP 50%

## Why

Single-phase boss fight lacks climax. Players need a dramatic mid-fight escalation
to create tension and reward strategic monster/trap placement.

## What

- **Phase transition**: Boss enters Phase 2 when HP drops to 50%, with visual warning overlay
- **Stat multipliers**: ATK x1.3, skill CD x0.7 (faster + harder)
- **New skill — dark_summon**: Spawns timer-based shadow minions (max 2 active, 6s duration, 2.5s attack CD, 8 ATK) that attack random fighting heroes
- **Tick reorder**: Boss death check moved before boss action to prevent dead-boss attacks
- **Cleanup**: _bossContext nulled in _endBattle to prevent stale summons

## Affected Files

| File | Change |
|------|--------|
| `src/data/boss.json` | Added `phases` array + `dark_summon` skill definition |
| `src/models/BattleManager.js` | _bossContext phase fields, tick reorder, phase transition, summon type handler, _tickSummons, _endBattle cleanup |
| `src/substates/BattleUI.js` | 3 new event handlers: bossPhaseChange overlay, bossSummon popup, summonAttack damage numbers |

## Risk

Medium — tick reorder changes execution order of boss death check. Mitigated by:
- Phase transition frame skips all boss actions (no race condition)
- Summon tick runs independently of targetQueue gate
- _bossContext cleanup prevents stale state across battles

## Verification Criteria

1. Boss HP > 50%: phase 1 behavior identical to before (shockwave + dark_shield only)
2. Boss HP drops to 50%: "魔王狂暴化！" overlay appears, heart cell turns red
3. Phase transition frame skips boss action (no immediate attack)
4. After transition: skills fire faster (CD x0.7), boss hits harder (ATK x1.3)
5. dark_summon triggers: purple "暗影召喚" popup at heart cell
6. Summon attacks random fighting hero every 2.5s with purple damage numbers
7. Max 2 summons active simultaneously
8. Summons expire after 6 seconds
9. Boss death clears all summons, no stale damage
