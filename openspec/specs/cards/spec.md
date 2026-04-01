---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
---

# Cards — Flip Matrix & Card Pick

## Requirements

### Requirement: Flip Matrix Layout

Each run SHALL present a matrix of face-down cards that the player flips one at a time.

#### Scenario: Matrix generation

WHEN a new run begins
THEN a 3x5 matrix (15 cards) SHALL be generated
AND each card SHALL be assigned a random event type:
- Normal Battle (30%)
- Elite Battle (15%)
- Dungeon Boss (5%)
- Activity (25%) — random reward: monster, room card, trap card, resources
- Treasure (15%) — direct gold/item reward
- Shop (10%) — spend gold to buy specific cards

#### Scenario: Card flip interaction

WHEN a player taps a face-down card
THEN the card SHALL play a Y-axis 3D flip animation (300ms, ease-out)
AND the revealed event SHALL be processed

---

### Requirement: Event Processing

Each event type SHALL trigger a specific flow.

#### Scenario: Battle events

WHEN a Normal/Elite/Boss battle card is flipped
THEN the game SHALL switch to the Battle substate within GameScene (NOT a separate scene)
AND generate heroes based on event difficulty and current glamour level

#### Scenario: Non-battle events

WHEN an Activity/Treasure/Shop card is flipped
THEN the reward/UI SHALL be processed inline (modal overlay on the matrix)
AND the player returns to the matrix after resolution

---

### Requirement: Card Pick (3-Choose-1)

The card draw system SHALL present 3 random cards for the player to choose from.

#### Scenario: Card pick trigger

WHEN the player initiates a card draw (button or activity reward)
THEN 3 cards SHALL be randomly generated from the card pool
AND displayed as a modal overlay with parchment-style card UI
AND the player SHALL select one card to add to hand, or skip

#### Scenario: Card pool composition

The card pool SHALL contain:
- Room cards: 5 types (孵化室, 研究室, 訓練室, 地牢, 寶藏室), weighted by rarity
- Trap cards: 5 types (箭矢, 焚燒, 冰霜, 毒沼, 落石), weighted by rarity
- Cards have star ratings (1-5) affecting their base stats

#### Scenario: Card stacking (upgrade)

WHEN a player places a card of the same type on a cell that already has that type
THEN the existing room/trap SHALL be upgraded (level +1)
AND the upgraded stats SHALL be applied immediately

---

### Requirement: Flip Matrix Navigation

The player SHALL be able to navigate between the flip matrix and other screens.

#### Scenario: Bottom tab navigation

WHEN the flip matrix is active
THEN bottom tabs SHALL provide access to: [翻牌] [地城] [刑求室] [怪物]
AND switching tabs SHALL preserve matrix state
