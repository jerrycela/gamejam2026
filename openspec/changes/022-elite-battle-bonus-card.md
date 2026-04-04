# Proposal 022 — Elite Battle Bonus Card Reward (v1.0, approved)

**Status:** approved (fast path — <30 lines, single behavioral addition)
**Author:** Claude (Opus 4.6)

## Why

Elite battles spawn 2-4 stronger heroes but give no special reward beyond normal per-kill gold. No strategic reason to prefer elite encounters over normal ones.

## What

After elite battle defense success, grant 1 free random card (room or trap from unlocked pool) to hand. Show toast notification. starRating 2 (guaranteed better quality than shop's 1-2).

### Implementation

In `FlipEventHandler._handleBattle`, after `battleUiComplete`:
- Check if `flipCard.eventType === 'eliteBattle'` AND `battleManager.lastResult === 'defenseSuccess'`
- If yes: pick random from unlocked rooms+traps, push to hand with starRating=2, show toast

## Affected files

| File | Change |
|------|--------|
| `src/substates/FlipEventHandler.js` | Add bonus card logic in _handleBattle after battleUiComplete |

## Verification

1. Win elite battle → get 1 bonus card in hand + toast
2. Lose elite battle → no bonus
3. Normal/boss battle → no bonus
4. Bonus card is starRating 2
